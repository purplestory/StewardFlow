"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type ApprovalPolicy = {
  id: string;
  scope: "asset" | "space" | "vehicle";
  department: string | null;
  required_role: "admin" | "manager" | "user";
};

type Profile = {
  organization_id: string | null;
  role: "admin" | "manager" | "user" | null;
};

const scopeLabels = {
  asset: "물품",
  space: "공간",
  vehicle: "차량",
};

const roleLabels = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};

export default function ApprovalPolicyManager() {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [role, setRole] = useState<Profile["role"]>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [templateDepartment, setTemplateDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [previewScope, setPreviewScope] = useState<ApprovalPolicy["scope"]>(
    "asset"
  );
  const [previewOwnerScope, setPreviewOwnerScope] = useState<
    "organization" | "department"
  >("department");
  const [previewDepartment, setPreviewDepartment] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setMessage("로그인 후 승인 정책을 설정할 수 있습니다.");
      setPolicies([]);
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
      setPolicies([]);
      setLoading(false);
      return;
    }

    const profile = profileData as Profile | null;
    const orgId = profile?.organization_id ?? null;
    setOrganizationId(orgId);
    setRole(profile?.role ?? null);
    setCurrentUserId(user.id);

    if (profile?.role !== "admin" && profile?.role !== "manager") {
      setPolicies([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("approval_policies")
      .select("id,scope,department,required_role")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      setPolicies([]);
    } else {
      setPolicies((data ?? []) as ApprovalPolicy[]);
    }

    const [profileDepartments, assetDepartments, spaceDepartments, vehicleDepartments] =
      await Promise.all([
        supabase.from("profiles").select("department"),
        supabase.from("assets").select("owner_department"),
        supabase.from("spaces").select("owner_department"),
        supabase.from("vehicles").select("owner_department"),
      ]);

    const merged = [
      ...(profileDepartments.data ?? []).map((row) => row.department),
      ...(assetDepartments.data ?? []).map((row) => row.owner_department),
      ...(spaceDepartments.data ?? []).map((row) => row.owner_department),
      ...(vehicleDepartments.data ?? []).map((row) => row.owner_department),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    setDepartments(Array.from(new Set(merged)).sort());

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleUpdate = async (
    policyId: string,
    requiredRole: ApprovalPolicy["required_role"]
  ) => {
    setMessage(null);

    const targetPolicy = policies.find((policy) => policy.id === policyId);
    const { error } = await supabase
      .from("approval_policies")
      .update({ required_role: requiredRole })
      .eq("id", policyId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPolicies((prev) =>
      prev.map((policy) =>
        policy.id === policyId
          ? { ...policy, required_role: requiredRole }
          : policy
      )
    );

    if (organizationId && currentUserId) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "approval_policy_update",
        target_type: "approval_policy",
        target_id: policyId,
        metadata: {
          scope: targetPolicy?.scope ?? null,
          department: targetPolicy?.department ?? null,
          required_role: requiredRole,
        },
      });
    }
  };

  const handleDelete = async (policyId: string) => {
    setMessage(null);

    const targetPolicy = policies.find((policy) => policy.id === policyId);
    const { error } = await supabase
      .from("approval_policies")
      .delete()
      .eq("id", policyId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPolicies((prev) => prev.filter((policy) => policy.id !== policyId));

    if (organizationId && currentUserId) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "approval_policy_delete",
        target_type: "approval_policy",
        target_id: policyId,
        metadata: {
          scope: targetPolicy?.scope ?? null,
          department: targetPolicy?.department ?? null,
        },
      });
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const scope = formData.get("scope")?.toString() as ApprovalPolicy["scope"];
    const departmentInput = formData.get("department")?.toString().trim();
    const requiredRole = formData.get("required_role")?.toString() as
      | "admin"
      | "manager"
      | "user";

    if (!organizationId) {
      setMessage("기관 정보가 없습니다.");
      return;
    }

    const normalizedDepartment = departmentInput || null;

    const { data: existing } = await supabase
      .from("approval_policies")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("scope", scope)
      .eq("department", normalizedDepartment)
      .maybeSingle();

    if (existing) {
      setMessage("이미 동일한 승인 정책이 존재합니다.");
      return;
    }

    const { error } = await supabase.from("approval_policies").insert({
      organization_id: organizationId,
      scope,
      department: normalizedDepartment,
      required_role: requiredRole,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const form = event.currentTarget;
    if (form) {
      form.reset();
    }
    if (organizationId && currentUserId) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "approval_policy_create",
        target_type: "approval_policy",
        metadata: {
          scope,
          department: normalizedDepartment,
          required_role: requiredRole,
        },
      });
    }
    await load();
  };

  const handleCreateOrgTemplates = async () => {
    setMessage(null);

    if (!organizationId) {
      setMessage("기관 정보가 없습니다.");
      return;
    }

    const { data: existing } = await supabase
      .from("approval_policies")
      .select("id,scope,department")
      .eq("organization_id", organizationId)
      .eq("department", null);

    const existingScopes = new Set(
      (existing ?? []).map((row) => row.scope)
    );

    const rows = [
      { scope: "asset", required_role: "admin" },
      { scope: "space", required_role: "admin" },
      { scope: "vehicle", required_role: "admin" },
    ]
      .filter((row) => !existingScopes.has(row.scope))
      .map((row) => ({
        organization_id: organizationId,
        scope: row.scope,
        department: null,
        required_role: row.required_role,
      }));

    if (rows.length === 0) {
      setMessage("기관 공용 정책이 이미 모두 등록되어 있습니다.");
      return;
    }

    const { error } = await supabase.from("approval_policies").insert(rows);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (organizationId && currentUserId) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "approval_policy_template_create",
        target_type: "approval_policy",
        metadata: {
          template_type: "organization",
          count: rows.length,
        },
      });
    }
    await load();
  };

  const handleCreateDepartmentTemplates = async () => {
    setMessage(null);
    const department = templateDepartment.trim();

    if (!organizationId) {
      setMessage("기관 정보가 없습니다.");
      return;
    }

    if (!department) {
      setMessage("부서명을 입력해주세요.");
      return;
    }

    const { data: existing } = await supabase
      .from("approval_policies")
      .select("id,scope,department")
      .eq("organization_id", organizationId)
      .eq("department", department);

    const existingScopes = new Set(
      (existing ?? []).map((row) => row.scope)
    );

    const rows = [
      { scope: "asset", required_role: "manager" },
      { scope: "space", required_role: "manager" },
      { scope: "vehicle", required_role: "manager" },
    ]
      .filter((row) => !existingScopes.has(row.scope))
      .map((row) => ({
        organization_id: organizationId,
        scope: row.scope,
        department,
        required_role: row.required_role,
      }));

    if (rows.length === 0) {
      setMessage("해당 부서 정책이 이미 모두 등록되어 있습니다.");
      return;
    }

    const { error } = await supabase.from("approval_policies").insert(rows);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTemplateDepartment("");
    if (organizationId && currentUserId) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "approval_policy_template_create",
        target_type: "approval_policy",
        metadata: {
          template_type: "department",
          department,
          count: rows.length,
        },
      });
    }
    await load();
  };

  if (loading) {
    return (
      <Notice>승인 정책을 불러오는 중입니다.</Notice>
    );
  }

  if (!role) {
    return (
      <Notice>
        로그인 후 승인 정책을 설정할 수 있습니다.{" "}
        <a href="/login" className="underline">
          로그인
        </a>
        으로 이동해 주세요.
      </Notice>
    );
  }

  if (role !== "admin" && role !== "manager") {
    return (
      <Notice variant="warning">
        승인 정책 설정은 관리자/부서 관리자만 가능합니다.
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Notice variant="error" className="text-left">
          {message}
        </Notice>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">기본 템플릿</h3>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            onClick={handleCreateOrgTemplates}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 whitespace-nowrap"
          >
            기관 공용 정책 생성
          </button>
          <span className="text-xs text-neutral-500">
            기관 공용 물품/공간/차량은 관리자 승인으로 설정됩니다.
          </span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={templateDepartment}
            onChange={(event) => setTemplateDepartment(event.target.value)}
            className="form-input"
            placeholder="부서명 입력 (예: 유년부)"
            list="department-options"
          />
          <datalist id="department-options">
            {departments.map((department) => (
              <option key={department} value={department} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={handleCreateDepartmentTemplates}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 whitespace-nowrap"
          >
            부서 정책 생성
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">승인 정책 적용 미리보기</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="form-label">대상</span>
            <select
              value={previewScope}
              onChange={(event) =>
                setPreviewScope(event.target.value as ApprovalPolicy["scope"])
              }
              className="form-select"
            >
              <option value="asset">물품</option>
              <option value="space">공간</option>
              <option value="vehicle">차량</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">소유 범위</span>
            <select
              value={previewOwnerScope}
              onChange={(event) =>
                setPreviewOwnerScope(
                  event.target.value as "organization" | "department"
                )
              }
              className="form-select"
            >
              <option value="department">부서 소유</option>
              <option value="organization">기관 공용</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">부서명</span>
            <input
              value={previewDepartment}
              onChange={(event) => setPreviewDepartment(event.target.value)}
              className="form-input"
              placeholder="부서명 입력 (예: 유년부)"
              list="department-options"
              disabled={previewOwnerScope === "organization"}
            />
          </label>
        </div>
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          적용 권한:{" "}
          {
            roleLabels[
              resolveRequiredRole(
                policies,
                previewScope,
                previewOwnerScope,
                previewDepartment
              )
            ]
          }
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-6 md:grid-cols-4"
      >
        <select
          name="scope"
          className="form-select"
        >
          <option value="asset">물품</option>
          <option value="space">공간</option>
          <option value="vehicle">차량</option>
        </select>
        <input
          name="department"
          className="form-input"
          placeholder="부서명 (비워두면 기관 공용)"
        />
        <select
          name="required_role"
          className="form-select"
        >
          <option value="manager">부서 관리자</option>
          <option value="admin">관리자</option>
          <option value="user">일반 사용자</option>
        </select>
        <button className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800 whitespace-nowrap">
          정책 추가
        </button>
      </form>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        {policies.length === 0 ? (
          <div className="text-center text-sm text-neutral-500">
            <p>등록된 승인 정책이 없습니다.</p>
            <p className="mt-2 text-xs text-neutral-400">
              위에서 정책을 추가하거나 템플릿을 생성해 주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2"
              >
                <div className="text-neutral-700 flex-shrink-0 min-w-0">
                  {scopeLabels[policy.scope]} ·{" "}
                  {policy.department ?? "기관 공용"}
                </div>
                <select
                  value={policy.required_role}
                  onChange={(event) =>
                    handleRoleUpdate(
                      policy.id,
                      event.target.value as ApprovalPolicy["required_role"]
                    )
                  }
                  className="form-select flex-1 min-w-0"
                >
                  <option value="manager">부서 관리자</option>
                  <option value="admin">관리자</option>
                  <option value="user">일반 사용자</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleDelete(policy.id)}
                  className="flex-shrink-0 p-2 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                  title="삭제"
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
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const resolveRequiredRole = (
  policies: ApprovalPolicy[],
  scope: ApprovalPolicy["scope"],
  ownerScope: "organization" | "department",
  departmentInput: string
): ApprovalPolicy["required_role"] => {
  const department =
    ownerScope === "organization" ? null : departmentInput.trim() || null;
  const exactPolicy = policies.find(
    (policy) =>
      policy.scope === scope &&
      policy.department === department
  );
  const fallbackPolicy = policies.find(
    (policy) => policy.scope === scope && policy.department === null
  );
  return (
    exactPolicy?.required_role ??
    fallbackPolicy?.required_role ??
    "manager"
  );
};
