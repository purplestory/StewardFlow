"use client";

import { useEffect, useState, useRef } from "react";
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

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [pendingRequest, setPendingRequest] = useState<DepartmentChangeRequest | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestedDepartment, setRequestedDepartment] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          
          // 부서 목록 로드
          if (profileData.organization_id) {
            loadDepartments(profileData.organization_id);
            loadPendingRequest(user.id);
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
    } else {
      setPendingRequest(data as DepartmentChangeRequest);
      setShowRequestForm(false);
      setRequestedDepartment("");
      setRequestNote("");
      setMessage("부서 변경 요청이 제출되었습니다. 승인 대기 중입니다.");
    }

    setRequesting(false);
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

  const handleDeleteAccount = async () => {
    if (!profile) return;

    // 부서 관리자인 경우 경고
    if (profile.role === "manager") {
      setMessage("부서 관리자는 탈퇴 전에 관리자에게 연락하여 권한을 양도해야 합니다.");
      return;
    }

    setDeleting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setMessage("로그인 정보를 확인할 수 없습니다.");
      setDeleting(false);
      return;
    }

    // 프로필 삭제
    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (deleteError) {
      setMessage(`계정 탈퇴 실패: ${deleteError.message}`);
      setDeleting(false);
      return;
    }

    // Audit log 기록
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

    // 로그아웃 및 리다이렉트
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user || !profile) {
      setMessage("로그인 후 프로필 정보를 수정할 수 있습니다.");
      setSaving(false);
      return;
    }

    // Get form element - try multiple methods
    const formElement = 
      (event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null) ||
      (event.target instanceof HTMLFormElement ? event.target : null) ||
      (event.target instanceof HTMLElement ? (event.target as HTMLElement).closest('form') : null);
    
    if (!(formElement instanceof HTMLFormElement)) {
      console.error("Could not find form element:", { 
        currentTarget: event.currentTarget, 
        target: event.target,
        targetType: event.target?.constructor?.name 
      });
      setMessage("폼 제출 중 오류가 발생했습니다.");
      setSaving(false);
      return;
    }

    const formData = new FormData(formElement);
    const updates = {
      name: formData.get("name")?.toString() || null,
      // department는 사용자가 직접 변경할 수 없도록 제외
      phone: formData.get("phone")?.toString() || null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setProfile({ ...profile, ...updates });
      setMessage("프로필이 저장되었습니다.");
    }

    setSaving(false);
  };

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
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="form-label">이메일</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="form-input bg-neutral-50 text-neutral-600"
          />
          <p className="text-xs text-neutral-500">이메일은 변경할 수 없습니다.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="form-label">역할</label>
          <input
            type="text"
            value={roleLabel[profile.role || "user"] || profile.role || "일반 사용자"}
            disabled
            className="form-input bg-neutral-50 text-neutral-600"
          />
          <p className="text-xs text-neutral-500">역할은 관리자가 변경할 수 있습니다.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="form-label">
            이름
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={profile.name || ""}
            className="form-input"
            placeholder="예: 김철수"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="department" className="form-label">
            소속 부서
          </label>
          <div className="flex items-center gap-2">
            <input
              id="department"
              name="department"
              type="text"
              value={profile.department || ""}
              disabled
              className="form-input bg-neutral-50 text-neutral-600 flex-1"
              placeholder="예: 유년부"
            />
            {!pendingRequest && (
              <button
                type="button"
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="flex-shrink-0 p-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
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
          </div>
          <p className="text-xs text-neutral-500">부서는 관리자가 변경할 수 있습니다.</p>
          
          {pendingRequest && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
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
          
          {showRequestForm && !pendingRequest && (
            <div className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="requestedDepartment" className="text-sm font-medium text-neutral-700">
                  변경할 부서
                </label>
                <select
                  id="requestedDepartment"
                  value={requestedDepartment}
                  onChange={(e) => setRequestedDepartment(e.target.value)}
                  className="form-select"
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
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="requestNote" className="text-sm font-medium text-neutral-700">
                  변경 사유 (선택)
                </label>
                <textarea
                  id="requestNote"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  className="form-input min-h-[80px]"
                  placeholder="부서 변경 사유를 입력해주세요"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRequestDepartmentChange}
                  disabled={requesting || !requestedDepartment}
                  className="btn-primary flex-1"
                >
                  {requesting ? "요청 중..." : "요청 제출"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestForm(false);
                    setRequestedDepartment("");
                    setRequestNote("");
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="phone" className="form-label">
            연락처
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone || ""}
            className="form-input"
            placeholder="010-0000-0000"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full"
        >
          {saving ? "저장 중..." : "프로필 저장"}
        </button>
      </div>

      {/* 탈퇴 섹션 */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h3 className="text-sm font-semibold text-rose-900 mb-2">계정 탈퇴</h3>
          <p className="text-xs text-rose-700 mb-4">
            계정을 탈퇴하면 모든 데이터가 삭제되며 복구할 수 없습니다.
            {profile.role === "manager" && (
              <span className="block mt-1 font-medium">
                부서 관리자인 경우, 탈퇴 전에 다른 사용자에게 부서 관리자 권한을 양도해야 합니다.
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="btn-outline border-rose-300 text-rose-700 hover:bg-rose-100"
          >
            계정 탈퇴
          </button>
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
                <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside">
                  <li>모든 프로필 정보가 삭제됩니다</li>
                  <li>대여 이력 및 예약 정보가 삭제됩니다</li>
                  <li>이 작업은 되돌릴 수 없습니다</li>
                  {profile.role === "manager" && (
                    <li className="font-medium text-rose-900">
                      부서 관리자인 경우, 부서의 다른 사용자에게 권한을 양도해야 합니다
                    </li>
                  )}
                </ul>
              </div>
              {profile.role === "manager" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    <strong>주의:</strong> 부서 관리자 권한을 가진 상태에서 탈퇴하면 부서 관리 기능이 중단될 수 있습니다.
                    탈퇴 전에 관리자에게 연락하여 권한을 양도하거나 다른 사용자에게 부서 관리자 권한을 부여해주세요.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || (profile.role === "manager")}
                className="flex-1 btn-primary bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "탈퇴 중..." : "탈퇴하기"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 btn-ghost"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
