"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateShortId } from "@/lib/short-id";

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  role: "admin" | "manager" | "user";
};

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "manager" | "user";
  department: string | null;
  name: string | null;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  token: string | null;
};

const roleLabel: Record<ProfileRow["role"], string> = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};

export default function UserRoleManager() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<ProfileRow["role"]>(
    "user"
  );
  const [invitationEmail, setInvitationEmail] = useState("");
  const [invitationName, setInvitationName] = useState("");
  const [invitationRole, setInvitationRole] =
    useState<ProfileRow["role"]>("user");
  const [invitationDepartment, setInvitationDepartment] = useState("");
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [needsOrganization, setNeedsOrganization] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    setNeedsOrganization(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (!profileData?.organization_id) {
      setNeedsOrganization(true);
      setLoading(false);
      return;
    }

    setOrganizationId(profileData.organization_id);
    setCurrentUserId(user.id);
    setCurrentUserRole(profileData.role ?? "user");

    // Load departments for invitation
    const { data: deptData } = await supabase
      .from("departments")
      .select("id,name")
      .eq("organization_id", profileData.organization_id);
    
    if (deptData) {
      // 순서 정보 로드
      let departmentOrder: string[] = [];
      try {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("department_order")
          .eq("id", profileData.organization_id)
          .maybeSingle();

        if (orgData?.department_order) {
          departmentOrder = orgData.department_order as string[];
        }
      } catch (error) {
        // department_order 컬럼이 없을 수 있음 - 무시하고 계속 진행
        console.warn("department_order 컬럼을 읽을 수 없습니다:", error);
      }

      // 순서 정보가 있으면 그에 따라 정렬, 없으면 이름순 정렬
      let sortedDepartments = deptData;
      if (departmentOrder.length > 0) {
        const deptMap = new Map(sortedDepartments.map((d) => [d.id, d]));
        sortedDepartments = departmentOrder
          .map((id) => deptMap.get(id))
          .filter((d): d is { id: string; name: string } => d !== undefined)
          .concat(sortedDepartments.filter((d) => !departmentOrder.includes(d.id)));
      } else {
        sortedDepartments.sort((a, b) => a.name.localeCompare(b.name));
      }

      setAvailableDepartments(sortedDepartments.map((d) => d.name));
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,name,department,role")
      .eq("organization_id", profileData.organization_id)
      .order("created_at", { ascending: true });

    // Try to select token, but handle case where column doesn't exist yet
    let inviteData: InviteRow[] | null = null;
    let inviteError: any = null;
    
    try {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id,email,role,department,name,created_at,accepted_at,revoked_at,token")
        .eq("organization_id", profileData.organization_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      
      inviteData = data as InviteRow[] | null;
      inviteError = error;
    } catch (err: any) {
      // If token column doesn't exist, try without it
      if (err?.message?.includes("token") || err?.code === "42703") {
        const { data, error } = await supabase
          .from("organization_invites")
          .select("id,email,role,department,name,created_at,accepted_at,revoked_at")
          .eq("organization_id", profileData.organization_id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false });
        
        inviteData = (data ?? []).map((inv: any) => ({ ...inv, token: null })) as InviteRow[];
        inviteError = error;
      } else {
        inviteError = err;
      }
    }

    if (error) {
      setMessage(error.message);
      setProfiles([]);
    } else {
      setProfiles((data ?? []) as ProfileRow[]);
    }

    if (inviteError) {
      setMessage(inviteError.message);
      setInvites([]);
    } else {
      const pendingInvites = (inviteData ?? []) as InviteRow[];
      const expiredIds = pendingInvites
        .filter((invite) => isInviteExpired(invite.created_at))
        .map((invite) => invite.id);

      if (expiredIds.length > 0) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("organization_invites")
          .update({ revoked_at: nowIso })
          .in("id", expiredIds);
      }

      setInvites(
        pendingInvites.filter((invite) => !isInviteExpired(invite.created_at))
      );
    }

    setLastLoadedAt(new Date().toISOString());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateRole = async (profileId: string, role: ProfileRow["role"]) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("권한 변경은 관리자만 가능합니다.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", profileId)
      .eq("organization_id", organizationId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === profileId ? { ...profile, role } : profile
      )
    );

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "role_update",
      target_type: "profile",
      target_id: profileId,
      metadata: { role },
    });
  };

  const sendInvite = async () => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("초대는 관리자만 가능합니다.");
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    // 이메일은 선택사항이므로 빈 문자열도 허용
    const email = invitationEmail.trim() || null;

    // 클라이언트에서 직접 초대 토큰 생성
    const token = generateShortId(10);

    // 초대 생성
    const { data: invite, error: inviteError } = await supabase
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        email: email || null,
        role: invitationRole,
        department: invitationDepartment.trim() || null,
        name: invitationName.trim() || null,
        token,
      })
      .select("id")
      .maybeSingle();

    if (inviteError || !invite) {
      setMessage(inviteError?.message ?? "초대 생성에 실패했습니다.");
      return;
    }

    const inviteLink = `${window.location.origin}/join?token=${token}`;

    // Get organization name for email
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    // Send email via API (이메일이 있는 경우에만)
    if (email) {
      try {
        const emailResponse = await fetch("/api/invite/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            inviteLink,
            organizationName: orgData?.name ?? "기관",
            role: invitationRole,
          }),
        });

        const emailResult = await emailResponse.json();

        if (emailResult.ok) {
          // Copy to clipboard as backup
          try {
            await navigator.clipboard.writeText(inviteLink);
            setMessage(
              `초대 이메일을 발송했습니다. 링크도 클립보드에 복사되었습니다.`
            );
          } catch {
            setMessage(`초대 이메일을 발송했습니다.`);
          }
        } else {
          // Email failed, but invite link is still valid
          try {
            await navigator.clipboard.writeText(inviteLink);
            setMessage(
              `초대 링크가 생성되었고 클립보드에 복사되었습니다. (이메일 발송 실패: ${emailResult.message}) 링크: ${inviteLink}`
            );
          } catch {
            setMessage(
              `초대 링크가 생성되었습니다. (이메일 발송 실패: ${emailResult.message}) 링크: ${inviteLink}`
            );
          }
        }
      } catch (error) {
        // API call failed, but invite link is still valid
        try {
          await navigator.clipboard.writeText(inviteLink);
          setMessage(
            `초대 링크가 생성되었고 클립보드에 복사되었습니다. (이메일 발송 오류) 링크: ${inviteLink}`
          );
        } catch {
          setMessage(`초대 링크가 생성되었습니다. (이메일 발송 오류) 링크: ${inviteLink}`);
        }
      }
    } else {
      // 이메일이 없으면 링크만 복사
      try {
        await navigator.clipboard.writeText(inviteLink);
        setMessage(
          `초대 링크가 생성되었고 클립보드에 복사되었습니다. 링크: ${inviteLink}`
        );
      } catch {
        setMessage(`초대 링크가 생성되었습니다. 링크: ${inviteLink}`);
      }
    }

    setInvitationEmail("");
    setInvitationName("");
    setInvitationRole("user");
    setInvitationDepartment("");

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_sent",
      target_type: "email",
      metadata: { email, role: invitationRole, has_link: true },
    });

    await load();
  };

  const resendInvite = async (invite: InviteRow) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("초대 재전송은 관리자만 가능합니다.");
      return;
    }

    if (!invite.token) {
      setMessage("초대 링크가 없습니다. 새로 생성해주세요.");
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    const inviteLink = `${window.location.origin}/join?token=${invite.token}`;

    // Get organization name for email
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    // Send email via API
    try {
      const emailResponse = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          inviteLink,
          organizationName: orgData?.name ?? "기관",
          role: invite.role,
        }),
      });

      const emailResult = await emailResponse.json();

      if (emailResult.ok) {
        setMessage("초대 이메일을 재전송했습니다.");
      } else {
        // Email failed, but provide link as backup
        try {
          await navigator.clipboard.writeText(inviteLink);
          setMessage(
            `초대 링크가 클립보드에 복사되었습니다. (이메일 발송 실패: ${emailResult.message})`
          );
        } catch {
          setMessage(
            `초대 링크: ${inviteLink} (이메일 발송 실패: ${emailResult.message})`
          );
        }
      }
    } catch (error) {
      // API call failed, provide link as backup
      try {
        await navigator.clipboard.writeText(inviteLink);
        setMessage("초대 링크가 클립보드에 복사되었습니다. (이메일 발송 오류)");
      } catch {
        setMessage(`초대 링크: ${inviteLink} (이메일 발송 오류)`);
      }
    }

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_resent",
      target_type: "email",
      metadata: { email: invite.email, role: invite.role },
    });
  };

  const copyInviteLink = async (invite: InviteRow) => {
    if (!invite.token) {
      setMessage("초대 링크가 없습니다.");
      return;
    }

    const inviteLink = `${window.location.origin}/join?token=${invite.token}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("초대 링크가 클립보드에 복사되었습니다.");
    } catch {
      setMessage(`초대 링크: ${inviteLink}`);
    }
  };

  const revokeInvite = async (invite: InviteRow) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("초대 취소는 관리자만 가능합니다.");
      return;
    }

    const { error } = await supabase
      .from("organization_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("organization_id", organizationId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setInvites((prev) => prev.filter((item) => item.id !== invite.id));

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_revoked",
      target_type: "organization_invite",
      target_id: invite.id,
      metadata: { email: invite.email, role: invite.role },
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
        사용자 목록을 불러오는 중입니다.
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">
        {message}
      </div>
    );
  }

  if (needsOrganization) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        기관 설정이 필요합니다.{" "}
        <a href="/settings/org" className="underline">
          기관 설정
        </a>
        으로 이동해 생성/참여를 완료해주세요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">내 역할:</span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 text-neutral-900">
              {roleLabel[currentUserRole]}
            </span>
          </div>
          {lastLoadedAt && (
            <span className="text-xs text-neutral-400">
              최근 갱신: {formatDateTime(lastLoadedAt)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
        >
          새로고침
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="form-input flex-1"
            placeholder="이름 (필수)"
            value={invitationName}
            onChange={(event) => setInvitationName(event.target.value)}
            disabled={currentUserRole === "user"}
            required
          />
          <input
            className="form-input flex-1"
            placeholder="이메일 (선택사항, 가입 시 변경 가능)"
            value={invitationEmail}
            onChange={(event) => setInvitationEmail(event.target.value)}
            disabled={currentUserRole === "user"}
            type="email"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="form-input"
            value={invitationRole}
            onChange={(event) =>
              setInvitationRole(event.target.value as ProfileRow["role"])
            }
            disabled={currentUserRole === "user"}
          >
            <option value="user">일반 사용자</option>
            <option value="manager">부서 관리자</option>
            <option value="admin">관리자</option>
          </select>
          <select
            className="form-input flex-1"
            value={invitationDepartment}
            onChange={(event) => setInvitationDepartment(event.target.value)}
            disabled={currentUserRole === "user"}
          >
            <option value="">부서 선택 (선택사항)</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={sendInvite}
            disabled={currentUserRole === "user" || !invitationName.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800"
          >
            초대 링크 생성
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          이름, 역할, 부서는 초대 시 지정되며 가입 시 확인됩니다. 이메일은 가입 시 변경 가능합니다.
        </p>
        {currentUserRole === "user" && (
          <span className="text-xs text-neutral-500">
            초대는 관리자만 가능합니다.
          </span>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs">
        <h3 className="text-sm font-semibold">대기 중인 초대</h3>
        {invites.length === 0 ? (
          <div className="mt-2 text-neutral-500">
            <p>대기 중인 초대가 없습니다.</p>
            <p className="mt-1 text-[11px] text-neutral-400">
              위에서 이메일을 입력해 초대를 발송할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {invite.name || invite.email}
                    {invite.name && <span className="text-neutral-500"> ({invite.email || "이메일 없음"})</span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    역할: {roleLabel[invite.role]}
                    {invite.department && ` · 부서: ${invite.department}`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    생성: {formatDateTime(invite.created_at)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    만료: {formatDateTime(getExpiresAt(invite.created_at))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {invite.token && (
                    <button
                      type="button"
                      onClick={() => copyInviteLink(invite)}
                      className="btn-ghost text-xs"
                    >
                      링크 복사
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => resendInvite(invite)}
                    className="btn-ghost text-xs"
                  >
                    재전송
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvite(invite)}
                    className="h-10 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition-all duration-200 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            <p>등록된 사용자가 없습니다.</p>
            <p className="mt-2 text-xs text-neutral-400">
              초대를 보내 새 사용자를 추가해 주세요.
            </p>
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            >
              <div>
                <p className="text-sm font-medium">
                  {profile.name ?? "이름 없음"}
                </p>
                <p className="text-xs text-neutral-500">{profile.email}</p>
                <p className="text-xs text-neutral-400">
                  {profile.department ?? "부서 미등록"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-sm font-medium text-neutral-900">
                  {roleLabel[profile.role]}
                </span>
                <select
                  className="form-select"
                  value={profile.role}
                  onChange={(event) =>
                    updateRole(
                      profile.id,
                      event.target.value as ProfileRow["role"]
                    )
                  }
                  disabled={
                    currentUserId === profile.id || currentUserRole === "user"
                  }
                >
                  <option value="admin">관리자</option>
                  <option value="manager">부서 관리자</option>
                  <option value="user">일반 사용자</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const INVITE_EXPIRES_DAYS = 7;

const getExpiresAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setDate(date.getDate() + INVITE_EXPIRES_DAYS);
  return date.toISOString();
};

const isInviteExpired = (value: string) => {
  const expiresAt = new Date(getExpiresAt(value));
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }
  return expiresAt.getTime() < Date.now();
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
