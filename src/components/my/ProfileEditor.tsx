"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DepartmentChangeRequest } from "@/types/database";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  phone: string | null;
  role: string | null;
  organization_id: string | null;
};

type Organization = {
  id: string;
  name: string;
};

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [pendingRequest, setPendingRequest] = useState<DepartmentChangeRequest | null>(null);
  const [requestedDepartment, setRequestedDepartment] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sameDepartmentUsers, setSameDepartmentUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [transferToUserId, setTransferToUserId] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [pendingDeletionRequest, setPendingDeletionRequest] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      // Wait a bit for session to be fully established after OAuth callback
      await new Promise((resolve) => setTimeout(resolve, 300));

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id,email,name,department,phone,role,organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch error:", error);
        if (isMounted) {
          setMessage(`프로필 조회 오류: ${error.message}`);
          setLoading(false);
        }
        return;
      }

      if (profileData) {
        if (isMounted) {
          setProfile(profileData as Profile);
          setPhoneValue(profileData.phone || "");
          
          // 부서 목록 및 기관 정보 로드
          if (profileData.organization_id) {
            loadDepartments(profileData.organization_id);
            loadPendingRequest(user.id);
            loadOrganization(profileData.organization_id);
          }
          
          setLoading(false);
        }
        return;
      }

      // Profile doesn't exist, try to create it
      const userEmail = user.email || user.user_metadata?.email || "";
      const userName = user.user_metadata?.name || user.user_metadata?.full_name || null;

      console.log("Creating profile for user:", user.id, { email: userEmail, name: userName });

      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: userEmail,
          name: userName,
        })
        .select("id,email,name,department,phone,role,organization_id")
        .single();

      if (insertError) {
        console.error("Profile insert error:", insertError);
        if (isMounted) {
          setMessage(`프로필 생성 오류: ${insertError.message}. 새로고침해주세요.`);
          // Try to fetch again after a delay (maybe AuthCard created it)
          setTimeout(async () => {
            if (!isMounted) return;
            const { data: retryData } = await supabase
              .from("profiles")
              .select("id,email,name,department,phone,role,organization_id")
              .eq("id", user.id)
              .maybeSingle();
            if (isMounted && retryData) {
              setProfile(retryData as Profile);
              setLoading(false);
            } else if (isMounted) {
              setLoading(false);
            }
          }, 2000);
        }
      } else if (newProfile && isMounted) {
        setProfile(newProfile as Profile);
        setLoading(false);
      } else if (isMounted) {
        setLoading(false);
      }
    };

    loadProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        loadProfile();
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const loadDepartments = async (organizationId: string) => {
    // 기관 설정에서 등록된 부서 목록 가져오기
    const { data: orgData } = await supabase
      .from("organizations")
      .select("department_order")
      .eq("id", organizationId)
      .maybeSingle();

    let departmentOrder: string[] = [];
    if (orgData?.department_order) {
      departmentOrder = orgData.department_order as string[];
    }

    // profiles, assets, spaces, vehicles에서 사용된 부서 목록 수집
    const [profileDepts, assetDepts, spaceDepts, vehicleDepts] = await Promise.all([
      supabase.from("profiles").select("department").eq("organization_id", organizationId),
      supabase.from("assets").select("owner_department").eq("organization_id", organizationId),
      supabase.from("spaces").select("owner_department").eq("organization_id", organizationId),
      supabase.from("vehicles").select("owner_department").eq("organization_id", organizationId),
    ]);

    const allDepartments = new Set<string>();
    [
      ...(profileDepts.data ?? []).map((r) => r.department),
      ...(assetDepts.data ?? []).map((r) => r.owner_department),
      ...(spaceDepts.data ?? []).map((r) => r.owner_department),
      ...(vehicleDepts.data ?? []).map((r) => r.owner_department),
    ]
      .filter((d): d is string => !!d)
      .forEach((d) => allDepartments.add(d));

    const sortedDepartments = departmentOrder.length > 0
      ? [
          ...departmentOrder.filter((d) => allDepartments.has(d)),
          ...Array.from(allDepartments).filter((d) => !departmentOrder.includes(d)).sort(),
        ]
      : Array.from(allDepartments).sort();

    setAvailableDepartments(sortedDepartments);
  };

  const loadPendingRequest = async (userId: string) => {
    const { data, error } = await supabase
      .from("department_change_requests")
      .select("*")
      .eq("requester_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!error && data) {
      setPendingRequest(data as DepartmentChangeRequest);
    } else {
      setPendingRequest(null);
    }
  };

  const loadOrganization = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

    if (!error && data) {
      setOrganization(data as Organization);
    }
  };

  const handleRequestDepartmentChange = async () => {
    if (!profile || !requestedDepartment || requestedDepartment === profile.department) {
      setMessage("변경할 부서를 선택해주세요.");
      return;
    }

    setRequesting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user || !profile.organization_id) {
      setMessage("로그인 후 부서 변경을 요청할 수 있습니다.");
      setRequesting(false);
      return;
    }

    const { data, error } = await supabase
      .from("department_change_requests")
      .insert({
        organization_id: profile.organization_id,
        requester_id: user.id,
        from_department: profile.department,
        to_department: requestedDepartment,
        note: requestNote || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      setMessage(`부서 변경 요청 실패: ${error.message}`);
      setRequesting(false);
    } else {
      setPendingRequest(data as DepartmentChangeRequest);
      setRequestedDepartment("");
      setRequestNote("");
      setMessage("부서 변경 요청이 제출되었습니다. 승인 대기 중입니다.");
      setTimeout(() => setMessage(null), 2000);
      setRequesting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest) return;

    setRequesting(true);
    const { error } = await supabase
      .from("department_change_requests")
      .update({ status: "cancelled" })
      .eq("id", pendingRequest.id);

    if (error) {
      setMessage(`요청 취소 실패: ${error.message}`);
    } else {
      setPendingRequest(null);
      setMessage("부서 변경 요청이 취소되었습니다.");
    }

    setRequesting(false);
  };

  const loadSameDepartmentUsers = async () => {
    if (!profile || !profile.department || !profile.organization_id) {
      setSameDepartmentUsers([]);
      return;
    }

    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("organization_id", profile.organization_id)
      .eq("department", profile.department)
      .neq("id", profile.id) // 자기 자신 제외
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading same department users:", error);
      setSameDepartmentUsers([]);
    } else {
      setSameDepartmentUsers((data || []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
      })));
    }
    setLoadingUsers(false);
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;

    setDeleting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setMessage("로그인 정보를 확인할 수 없습니다.");
      setDeleting(false);
      return;
    }

    // 부서 관리자인 경우 탈퇴 요청 생성 (최고 관리자 승인 필요)
    if (profile.role === "manager") {
      if (!transferToUserId) {
        setMessage("부서 관리자 권한을 위임할 사용자를 선택해주세요.");
        setDeleting(false);
        return;
      }

      // 위임받을 사용자 정보 조회
      const { data: transferUser } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", transferToUserId)
        .single();

      // 탈퇴 요청 생성
      const { data: requestData, error: requestError } = await supabase
        .from("account_deletion_requests")
        .insert({
          organization_id: profile.organization_id,
          requester_id: user.id,
          requester_name: profile.name,
          requester_email: profile.email,
          requester_role: profile.role,
          requester_department: profile.department,
          transfer_to_user_id: transferToUserId,
          transfer_to_user_name: transferUser?.name || null,
          status: "pending",
          note: requestNote || null,
        })
        .select()
        .single();

      if (requestError) {
        setMessage(`탈퇴 요청 생성 실패: ${requestError.message}`);
        setDeleting(false);
        return;
      }

      setPendingDeletionRequest(requestData);
      setShowDeleteConfirm(false);
      setMessage("탈퇴 요청이 제출되었습니다. 최고 관리자의 승인을 기다리는 중입니다.");
      setTimeout(() => setMessage(null), 3000);
      setDeleting(false);
      return;
    }

    // 일반 사용자는 즉시 탈퇴
    // Audit log 기록 (계정 삭제 전에 기록)
    if (profile.organization_id) {
      await supabase.from("audit_logs").insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        action: "account_deleted",
        target_type: "profile",
        target_id: user.id,
        metadata: {
          deleted_user_name: profile.name,
          deleted_user_email: profile.email,
        },
      });
    }

    // Server Action을 사용하여 auth.users와 profiles 모두 삭제
    try {
      const { deleteUserAccount } = await import("@/actions/auth-actions");
      const result = await deleteUserAccount(user.id);

      if (!result.success) {
        setMessage(result.error || "계정 탈퇴 실패");
        setDeleting(false);
        return;
      }
    } catch (error: any) {
      console.error("Account deletion error:", error);
      setMessage(`계정 탈퇴 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
      setDeleting(false);
      return;
    }

    // 로그아웃 및 리다이렉트
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleCancelDeletionRequest = async () => {
    if (!pendingDeletionRequest) return;

    setRequesting(true);
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({ status: "cancelled" })
      .eq("id", pendingDeletionRequest.id);

    if (error) {
      setMessage(`요청 취소 실패: ${error.message}`);
      setRequesting(false);
    } else {
      setPendingDeletionRequest(null);
      setMessage("탈퇴 요청이 취소되었습니다.");
      setTimeout(() => setMessage(null), 2000);
      setRequesting(false);
    }
  };

  const handleSavePhone = async () => {
    if (!profile) return;

    setSavingPhone(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setMessage("로그인 후 프로필 정보를 수정할 수 있습니다.");
      setSavingPhone(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ phone: phoneValue || null })
      .eq("id", user.id);

    if (error) {
      setMessage(`연락처 저장 실패: ${error.message}`);
      setSavingPhone(false);
    } else {
      setProfile({ ...profile, phone: phoneValue || null });
      setEditingPhone(false);
      setMessage("연락처가 저장되었습니다.");
      setTimeout(() => setMessage(null), 2000);
      setSavingPhone(false);
    }
  };

  const handleCancelPhone = () => {
    setPhoneValue(profile?.phone || "");
    setEditingPhone(false);
  };

  // 모달이 열릴 때 부서 관리자인 경우 사용자 목록 로드
  useEffect(() => {
    if (showDeleteConfirm && profile?.role === "manager") {
      loadSameDepartmentUsers();
    }
  }, [showDeleteConfirm, profile?.role]);

  if (loading) {
    return <p className="text-sm text-neutral-500">프로필 정보를 불러오는 중...</p>;
  }

  if (!profile) {
    return (
      <p className="text-sm text-neutral-500">
        로그인 후 프로필 정보를 확인할 수 있습니다.
      </p>
    );
  }

  const roleLabel: Record<string, string> = {
    admin: "관리자",
    manager: "부서 관리자",
    user: "일반 사용자",
  };

  return (
    <div className="space-y-6">
      {/* 프로필 정보 표시 섹션 */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700 min-w-[80px]">이름</label>
            <input
              type="text"
              value={profile.name || ""}
              disabled
              className="form-input bg-neutral-50 text-neutral-600 flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700 min-w-[80px]">전화번호</label>
            <div className="flex items-center gap-2 flex-1">
              {editingPhone ? (
                <>
                  <input
                    type="tel"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    className="form-input flex-1"
                    placeholder="010-0000-0000"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSavePhone}
                    disabled={savingPhone}
                    className="flex-shrink-0 h-[38px] px-3 rounded-lg text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {savingPhone ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPhone}
                    disabled={savingPhone}
                    className="flex-shrink-0 h-[38px] px-3 rounded-lg text-sm font-medium border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="tel"
                    value={profile.phone || ""}
                    disabled
                    className="form-input bg-neutral-50 text-neutral-600 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneValue(profile.phone || "");
                      setEditingPhone(true);
                    }}
                    className="flex-shrink-0 p-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors h-[38px] w-[38px] flex items-center justify-center"
                    title="연락처 수정"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700 min-w-[80px]">이메일</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="form-input bg-neutral-50 text-neutral-600 flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700 min-w-[80px]">기관</label>
            <input
              type="text"
              value={organization?.name || "기관 정보 없음"}
              disabled
              className="form-input bg-neutral-50 text-neutral-600 flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700 min-w-[80px]">소속 부서</label>
            <div className="flex items-center gap-2 flex-1">
              {editingDepartment ? (
                <>
                  <select
                    value={requestedDepartment}
                    onChange={(e) => setRequestedDepartment(e.target.value)}
                    className="form-select flex-1 h-[38px]"
                  >
                    <option value="">부서 선택</option>
                    {availableDepartments
                      .filter((dept) => dept !== profile.department)
                      .map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!requestedDepartment || requestedDepartment === profile.department) {
                        setEditingDepartment(false);
                        setRequestedDepartment("");
                        setRequestNote("");
                        return;
                      }
                      await handleRequestDepartmentChange();
                      setEditingDepartment(false);
                    }}
                    disabled={requesting || !requestedDepartment}
                    className="flex-shrink-0 h-[38px] px-3 rounded-lg text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {requesting ? "요청 중..." : "요청"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDepartment(false);
                      setRequestedDepartment("");
                      setRequestNote("");
                    }}
                    disabled={requesting}
                    className="flex-shrink-0 h-[38px] px-3 rounded-lg text-sm font-medium border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={profile.department || "부서 미등록"}
                    disabled
                    className="form-input bg-neutral-50 text-neutral-600 flex-1"
                  />
                  {!pendingRequest && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDepartment(true);
                        setRequestedDepartment("");
                        setRequestNote("");
                      }}
                      className="flex-shrink-0 p-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors h-[38px] w-[38px] flex items-center justify-center"
                      title="부서 변경 요청"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                        />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {pendingRequest && (
            <div className="ml-[92px] mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">부서 변경 요청 대기 중</p>
              <p className="text-xs text-blue-700 mt-1">
                {profile.department || "(없음)"} → {pendingRequest.to_department}
              </p>
              {pendingRequest.note && (
                <p className="text-xs text-blue-600 mt-1">사유: {pendingRequest.note}</p>
              )}
              <button
                type="button"
                onClick={handleCancelRequest}
                disabled={requesting}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {requesting ? "취소 중..." : "요청 취소"}
              </button>
            </div>
          )}
          {editingDepartment && (
            <div className="ml-[92px] mt-2">
              <label className="text-xs text-neutral-600 mb-1 block">변경 사유 (선택)</label>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                className="form-input min-h-[60px] text-sm"
                placeholder="부서 변경 사유를 입력해주세요"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700 min-w-[80px]">역할</label>
            <input
              type="text"
              value={roleLabel[profile.role || "user"] || profile.role || "일반 사용자"}
              disabled
              className="form-input bg-neutral-50 text-neutral-600 flex-1"
            />
          </div>
        </div>
      </div>

      {/* 탈퇴 섹션 */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">계정 탈퇴</h3>
            <p className="text-xs text-neutral-500">
              {profile.role === "manager" 
                ? "부서 관리자는 최고 관리자 승인 후 탈퇴됩니다"
                : "계정을 영구적으로 삭제합니다"}
            </p>
          </div>
          {pendingDeletionRequest ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-blue-900 font-medium">탈퇴 요청 대기 중</p>
                <p className="text-xs text-blue-700">최고 관리자 승인 대기</p>
              </div>
              <button
                type="button"
                onClick={handleCancelDeletionRequest}
                disabled={requesting}
                className="btn-outline border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm"
              >
                {requesting ? "취소 중..." : "요청 취소"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
              }}
              disabled={deleting}
              className="btn-outline border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              계정 탈퇴
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="text-sm text-neutral-600" role="status">
          {message}
        </p>
      )}

      {/* 탈퇴 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="rounded-t-lg bg-rose-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">계정 탈퇴 확인</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-900 font-medium mb-2">
                  정말로 계정을 탈퇴하시겠습니까?
                </p>
                <p className="text-xs text-rose-700 mb-3">
                  계정을 탈퇴하면 모든 데이터가 삭제되며 복구할 수 없습니다.
                </p>
                <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside">
                  <li>모든 프로필 정보가 삭제됩니다</li>
                  <li>대여 이력 및 예약 정보가 삭제됩니다</li>
                  <li>이 작업은 되돌릴 수 없습니다</li>
                </ul>
                {profile.role === "manager" && (
                  <p className="text-xs text-rose-800 font-medium mt-3 pt-3 border-t border-rose-300">
                    부서 관리자인 경우, 탈퇴 전에 다른 사용자에게 부서 관리자 권한을 양도해야 합니다.
                  </p>
                )}
              </div>
              
              {/* 부서 관리자 권한 양도 섹션 */}
              {profile.role === "manager" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-sm text-amber-900 font-medium mb-1">
                      부서 관리자 권한 위임 (필수)
                    </p>
                    <p className="text-xs text-amber-800">
                      탈퇴 전에 같은 부서의 다른 사용자에게 부서 관리자 권한을 반드시 위임해야 합니다.
                    </p>
                  </div>
                  {loadingUsers ? (
                    <div className="py-2">
                      <p className="text-xs text-amber-700">사용자 목록을 불러오는 중...</p>
                    </div>
                  ) : sameDepartmentUsers.length === 0 ? (
                    <div className="rounded border border-amber-300 bg-amber-100 px-3 py-2">
                      <p className="text-xs text-amber-900 font-medium mb-1">
                        ⚠️ 같은 부서의 다른 사용자가 없습니다
                      </p>
                      <p className="text-xs text-amber-800">
                        최고 관리자에게 연락하여 권한을 위임한 후 탈퇴할 수 있습니다.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-amber-900">
                        부서 관리자 권한을 위임할 사용자 선택 <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={transferToUserId}
                        onChange={(e) => setTransferToUserId(e.target.value)}
                        className="w-full form-select text-sm h-[38px]"
                        required
                      >
                        <option value="">-- 사용자를 선택하세요 --</option>
                        {sameDepartmentUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || "이름 없음"} ({user.email})
                          </option>
                        ))}
                      </select>
                      {transferToUserId && (
                        <p className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          ✓ 선택한 사용자가 부서 관리자 권한을 받게 됩니다.
                        </p>
                      )}
                      {!transferToUserId && (
                        <p className="text-xs text-amber-700">
                          사용자를 선택해야 탈퇴할 수 있습니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  deleting || 
                  (profile.role === "manager" && (!transferToUserId || sameDepartmentUsers.length === 0))
                }
                className="flex-1 btn-primary bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "탈퇴 중..." : "탈퇴하기"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTransferToUserId("");
                }}
                disabled={deleting}
                className="flex-1 btn-ghost"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
