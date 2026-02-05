"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
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
    load();
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

    console.log("Creating organization with user:", user.id);

    const { data: orgData, error } = await supabase
      .from("organizations")
      .insert({ name })
      .select("id,name")
      .maybeSingle();

    console.log("Organization insert result:", { orgData, error });

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

    console.log("Updating profile with organization_id:", orgData.id);

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

  // This function is no longer used - approval policies can be created manually
  // Keeping it for potential future use, but it's not called anymore
  const ensureDefaultApprovalPoliciesClient = async (orgId: string) => {
    // This function is deprecated - approval policies should be created manually
    // through the settings page after organization creation
    console.warn("ensureDefaultApprovalPoliciesClient is deprecated - policies should be created manually");
    return;

    // Check existing policies (may fail if RLS hasn't updated yet)
    const { data, error: selectError } = await supabase
      .from("approval_policies")
      .select("id,scope,department")
      .eq("organization_id", orgId);

    // If select fails due to RLS, try again after a short delay
    if (selectError) {
      console.warn("Approval policy select error (will retry):", selectError);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const { data: retryData, error: retryError } = await supabase
        .from("approval_policies")
        .select("id,scope,department")
        .eq("organization_id", orgId);

      if (retryError) {
        throw new Error(`Failed to check existing policies: ${retryError?.message || "Unknown error"}`);
      }

      const existingScopes = new Set(
        (retryData ?? [])
          .filter((row) => row.department === null)
          .map((row) => row.scope)
      );

      const rows = [
        { scope: "asset", required_role: "admin" },
        { scope: "space", required_role: "admin" },
      ]
        .filter((row) => !existingScopes.has(row.scope))
        .map((row) => ({
          organization_id: orgId,
          scope: row.scope,
          department: null,
          required_role: row.required_role,
        }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("approval_policies")
          .insert(rows);

        if (insertError) {
          throw new Error(`Failed to create default policies: ${insertError?.message || "Unknown error"}`);
        }
      }
      return;
    }

    // Normal flow if select succeeded
    const existingScopes = new Set(
      (data ?? [])
        .filter((row) => row.department === null)
        .map((row) => row.scope)
    );

    const rows = [
      { scope: "asset", required_role: "admin" },
      { scope: "space", required_role: "admin" },
    ]
      .filter((row) => !existingScopes.has(row.scope))
      .map((row) => ({
        organization_id: orgId,
        scope: row.scope,
        department: null,
        required_role: row.required_role,
      }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("approval_policies")
        .insert(rows);

      if (insertError) {
        throw new Error(`Failed to create default policies: ${insertError?.message || "Unknown error"}`);
      }
    }
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
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">내 기관</h2>
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
              <div className="flex items-center gap-2">
                <p className="text-sm text-neutral-900 font-medium">
                  {organization.name}
                </p>
                {userRole === "admin" && (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="text-xs text-neutral-500 hover:text-neutral-700"
                  >
                    수정
                  </button>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-neutral-500">
              기관 ID: {organizationId}
            </p>
          </div>

          {userRole === "admin" && (
            <div className="pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="text-sm text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                기관 삭제
              </button>
              {showDeleteConfirm && (
                <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-sm text-rose-900 mb-3">
                    기관을 삭제하면 모든 데이터(부서, 물품, 공간, 예약 등)가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="btn-sm bg-rose-600 text-white hover:bg-rose-700"
                    >
                      삭제 확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={loading}
                      className="btn-secondary btn-sm"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-neutral-200 bg-white p-6 space-y-3"
        >
          <h2 className="text-lg font-semibold">기관 생성</h2>
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

      {organizationId && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <DepartmentManager organizationId={organizationId} />
        </div>
      )}
    </div>
  );
}
