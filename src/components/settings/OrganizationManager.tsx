"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
import { createOrganizationForAdmin } from "@/actions/admin-organization-actions";
import DepartmentManager from "./DepartmentManager";

type Organization = {
  id: string;
  name: string;
};

export default function OrganizationManager() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading=true to prevent flash
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalOrganizationName, setAdditionalOrganizationName] = useState("");
  const [isCreatingAdditionalOrganization, setIsCreatingAdditionalOrganization] = useState(false);

  const load = async (preserveExistingState = false) => {
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setIsAuthenticated(false);
      setLoading(false);
      if (!preserveExistingState) {
        setOrganization(null);
        setOrganizationId(null);
        setCurrentUserId(null);
      }
      return;
    }
    setIsAuthenticated(true);
    setCurrentUserId(user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Profile load error:", profileError);
      // Don't clear state if preserveExistingState is true
      if (!preserveExistingState) {
        setOrganization(null);
        setOrganizationId(null);
      }
      return;
    }

    const orgId = profileData?.organization_id ?? null;
    const role = (profileData?.role as "admin" | "manager" | "user") ?? "user";
    setUserRole(role);
    
    if (orgId) {
      setOrganizationId(orgId);
    } else if (!preserveExistingState) {
      setOrganizationId(null);
    }

    if (!orgId) {
      if (!preserveExistingState) {
        setOrganization(null);
      }
      return;
    }

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id,name")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      console.warn("Organization load error:", orgError);
      // Don't clear state if preserveExistingState is true
      if (!preserveExistingState) {
        setOrganization(null);
      }
      return;
    }

    if (orgData) {
      setOrganization(orgData as Organization);
      setEditingName(orgData.name);
    } else if (!preserveExistingState) {
      setOrganization(null);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (isAuthenticated === false) {
    return (
      <Notice variant="warning" className="text-left">
        로그인 후 기관 설정을 이용할 수 있습니다.{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
        으로 이동해 주세요.
      </Notice>
    );
  }

  if (loading && isAuthenticated === null) {
    return <Notice>기관 정보를 불러오는 중입니다.</Notice>;
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const name = organizationName.trim();
    if (!name) {
      setMessage("기관 이름을 입력해주세요.");
      setLoading(false);
      return;
    }

    // Use client-side Supabase directly (server actions have session issues)
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    
    if (!user) {
      setMessage("로그인 후 기관 설정을 이용할 수 있습니다.");
      setLoading(false);
      return;
    }

    const { data: orgData, error } = await supabase
      .from("organizations")
      .insert({ name })
      .select("id,name")
      .maybeSingle();

    if (error) {
      console.error("Organization create error:", error);
      if (error.code === "42501" || error.message?.includes("row-level security")) {
        setMessage(
          `기관 생성 오류: RLS 정책 오류입니다. Supabase SQL Editor에서 RLS를 일시적으로 비활성화하거나 정책을 확인해주세요. (${error.message})`
        );
      } else {
        setMessage(`기관 생성 오류: ${error.message}`);
      }
      setLoading(false);
      return;
    }

    if (!orgData?.id) {
      setMessage("기관 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        organization_id: orgData.id,
        role: "admin"
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      setMessage(`기관은 생성되었지만 프로필 업데이트에 실패했습니다: ${updateError.message}`);
    } else {
      setMessage("기관이 생성되었습니다.");
    }

    setOrganizationName("");
    setOrganizationId(orgData.id);
    setOrganization({ id: orgData.id, name: name });
    setLoading(false);
    
    setTimeout(async () => {
      try {
        await load(true);
      } catch (loadError) {
        console.warn("Error loading organization data:", loadError);
      }
    }, 2000);
  };

  const handleCreateAdditionalOrganization = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (userRole !== "admin") {
      setMessage("기관 추가 생성은 최고 관리자만 가능합니다.");
      return;
    }

    const name = additionalOrganizationName.trim();
    if (!name) {
      setMessage("기관 이름을 입력해주세요.");
      return;
    }

    setIsCreatingAdditionalOrganization(true);
    setMessage(null);

    const result = await createOrganizationForAdmin(name);
    if (!result.success || !result.organization) {
      setMessage(result.error ?? "기관 추가 생성에 실패했습니다.");
      setIsCreatingAdditionalOrganization(false);
      return;
    }

    setAdditionalOrganizationName("");
    setIsCreatingAdditionalOrganization(false);
    setMessage(
      `기관 "${result.organization.name}"이 생성되었습니다. 사용자/초대 관리의 "사용자 기관 지정/이관"에서 바로 지정할 수 있습니다.`
    );
  };

  const handleUpdateName = async () => {
    if (!organizationId || !editingName.trim()) {
      setMessage("기관 이름을 입력해주세요.");
      return;
    }

    if (editingName.trim() === organization?.name) {
      setIsEditingName(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({ name: editingName.trim() })
      .eq("id", organizationId);

    if (error) {
      setMessage(`기관명 수정 오류: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrganization({ ...organization!, name: editingName.trim() });
    setIsEditingName(false);
    setMessage("기관명이 수정되었습니다.");
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!organizationId || !currentUserId) {
      setMessage("기관 정보가 없습니다.");
      return;
    }

    if (userRole !== "admin") {
      setMessage("기관 삭제는 관리자만 가능합니다.");
      setShowDeleteConfirm(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    // 먼저 모든 멤버의 organization_id를 null로 업데이트
    // (기관 삭제 전에 해야 RLS 정책이 작동함)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ organization_id: null })
      .eq("organization_id", organizationId);

    if (updateError) {
      setMessage(`멤버 정보 업데이트 오류: ${updateError.message}`);
      setLoading(false);
      setShowDeleteConfirm(false);
      return;
    }

    // 잠시 대기 (RLS 정책 반영)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 기관 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", organizationId);

    if (error) {
      setMessage(`기관 삭제 오류: ${error.message}`);
      setLoading(false);
      setShowDeleteConfirm(false);
      return;
    }

    setShowDeleteConfirm(false);
    setOrganization(null);
    setOrganizationId(null);
    setMessage("기관이 삭제되었습니다.");
    setLoading(false);
    
    // 페이지 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };


  return (
    <div className="space-y-6">
      {message && (
        <Notice 
          variant={message.includes("오류") || message.includes("실패") ? "error" : "success"} 
          className="text-left"
        >
          {message}
        </Notice>
      )}

      {organizationId && organization ? (
        <section className="surface-card p-5 md:p-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">내 기관</h2>
            {isEditingName && userRole === "admin" ? (
              <div className="flex gap-2">
                <input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="form-input flex-1"
                  placeholder="기관 이름"
                />
                <button
                  type="button"
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="btn-secondary btn-sm"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditingName(organization.name);
                  }}
                  disabled={loading}
                  className="btn-secondary btn-sm"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="module-head">
                <p className="text-sm text-neutral-900 font-medium">
                  {organization.name}
                </p>
                {userRole === "admin" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="icon-button"
                      title="기관명 수정"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={loading}
                      className="icon-button icon-button-danger disabled:opacity-50"
                      title="기관 삭제"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      ) : (
        <form
          onSubmit={handleCreate}
          className="surface-card space-y-3 p-5 md:p-6"
        >
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">기관 생성</h2>
          <p className="text-sm text-neutral-600">
            새로운 기관을 생성합니다. 기관 생성자는 자동으로 관리자 권한을 받습니다.
          </p>
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            className="form-input"
            placeholder="기관 이름 입력 (예: OO교회)"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            기관 생성
          </button>
        </form>
      )}

      {organizationId && userRole === "admin" && (
        <form
          onSubmit={handleCreateAdditionalOrganization}
          className="surface-card space-y-3 p-5 md:p-6"
        >
          <h3 className="text-base font-semibold text-slate-900">신규 기관 추가 생성</h3>
          <p className="text-sm text-neutral-600">
            현재 내 소속은 유지한 채, 다른 기관을 추가로 생성합니다.
          </p>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={additionalOrganizationName}
              onChange={(event) => setAdditionalOrganizationName(event.target.value)}
              className="form-input"
              placeholder="기관 이름 입력 (예: OO교회)"
            />
            <button
              type="submit"
              disabled={isCreatingAdditionalOrganization || !additionalOrganizationName.trim()}
              className="btn-outline w-full whitespace-nowrap px-4 md:w-auto"
            >
              {isCreatingAdditionalOrganization ? "생성 중..." : "기관 추가 생성"}
            </button>
          </div>
        </form>
      )}

      {organizationId && (
        <DepartmentManager organizationId={organizationId} />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && userRole === "admin" && (
        <div className="modal-backdrop">
          <div className="modal-surface max-w-md">
            <h3 className="text-lg font-semibold text-slate-900">기관 삭제</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-900 mb-2">
                  정말 &quot;{organization?.name}&quot; 기관을 삭제하시겠습니까?
                </p>
                <p className="text-xs text-rose-700">
                  기관을 삭제하면 모든 데이터(부서, 물품, 공간, 예약 등)가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="btn-danger flex-1 disabled:opacity-50"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
                className="btn-outline flex-1"
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
