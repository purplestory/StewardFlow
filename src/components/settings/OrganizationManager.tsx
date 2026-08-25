"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
import {
  createOrganizationForAdmin,
  createOrganizationForCurrentPlatformAdmin,
  listOrganizationsForAdmin,
} from "@/actions/admin-organization-actions";
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
  const [additionalOrganizationName, setAdditionalOrganizationName] = useState("");
  const [isCreatingAdditionalOrganization, setIsCreatingAdditionalOrganization] = useState(false);
  const [canManageAllOrganizations, setCanManageAllOrganizations] = useState(false);

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
        setCanManageAllOrganizations(false);
      }
      return;
    }
    setIsAuthenticated(true);

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
    if (role === "admin") {
      const capabilityResult = await listOrganizationsForAdmin();
      setCanManageAllOrganizations(
        capabilityResult.success && capabilityResult.canManageAllOrganizations
      );
    } else {
      setCanManageAllOrganizations(false);
    }
    
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

    if (!canManageAllOrganizations) {
      setMessage("기관 생성은 플랫폼 관리자 권한이 필요합니다.");
      setLoading(false);
      return;
    }

    const result = await createOrganizationForCurrentPlatformAdmin(name);
    if (!result.success || !result.organization) {
      setMessage(result.error ?? "기관 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    setOrganizationName("");
    setOrganizationId(result.organization.id);
    setOrganization(result.organization);
    setMessage("기관이 생성되었습니다.");
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
    if (userRole !== "admin" || !canManageAllOrganizations) {
      setMessage("기관 추가 생성은 플랫폼 관리자 권한이 필요합니다.");
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

  return (
    <div className="space-y-6">
      {message && (
        <Notice 
          variant={
            message.includes("오류") || message.includes("실패")
              ? "error"
              : message.includes("권한")
                ? "warning"
                : "success"
          }
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
              <>
                <div className="module-head">
                  <p className="min-w-0 break-words text-sm font-medium text-neutral-900">
                    {organization.name}
                  </p>
                  {userRole === "admin" && (
                    <div className="flex shrink-0 items-center gap-2">
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
                    </div>
                  )}
                </div>
                {userRole === "admin" && (
                  <p className="mt-2 text-xs text-neutral-500">
                    기관 삭제는 데이터 보호를 위해 운영자에게 문의해주세요.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      ) : canManageAllOrganizations ? (
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
      ) : (
        <Notice variant="warning" className="text-left">
          기관 생성 권한이 없습니다. 기관 관리자가 발급한 초대 링크로 참여해주세요.
        </Notice>
      )}

      {organizationId && userRole === "admin" && canManageAllOrganizations && (
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
    </div>
  );
}
