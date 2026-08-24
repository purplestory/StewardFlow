"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Role = "admin" | "manager" | "user";
const VALID_ROLES: readonly Role[] = ["admin", "manager", "user"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminOrganizationUser = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  role: Role | null;
  organization_id: string | null;
  created_at: string;
};

type AdminContext =
  | {
      ok: true;
      actorId: string;
      actorOrganizationId: string | null;
      isPlatformAdmin: boolean;
      supabaseAdmin: ReturnType<typeof getServiceRoleClient> extends null
        ? never
        : NonNullable<ReturnType<typeof getServiceRoleClient>>;
    }
  | {
      ok: false;
      message: string;
    };

type DepartmentApprovalContext =
  | {
      ok: true;
      actorId: string;
      actorOrganizationId: string;
      actorDepartment: string | null;
      actorRole: "admin" | "manager";
      supabaseAdmin: NonNullable<ReturnType<typeof getServiceRoleClient>>;
    }
  | {
      ok: false;
      message: string;
    };

const getServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

// Comma-separated auth.users IDs. An unset allowlist grants no platform access.
const isPlatformAdminUser = (userId: string) =>
  (process.env.PLATFORM_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((configuredId) => configuredId.trim().toLowerCase())
    .filter(Boolean)
    .includes(userId.toLowerCase());

async function getAdminContext(): Promise<AdminContext> {
  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "로그인 정보가 유효하지 않습니다." };
  }

  const supabaseAdmin = getServiceRoleClient();
  if (!supabaseAdmin) {
    return {
      ok: false,
      message:
        "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL이 없습니다.",
    };
  }

  const { data: actorProfile, error: actorError } = await supabaseAdmin
    .from("profiles")
    .select("role,organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError) {
    console.error("Admin organization permission lookup failed:", actorError);
    return { ok: false, message: "관리자 권한을 확인할 수 없습니다." };
  }

  if (!actorProfile || actorProfile.role !== "admin") {
    return { ok: false, message: "최고 관리자만 수행할 수 있습니다." };
  }

  return {
    ok: true,
    actorId: user.id,
    actorOrganizationId: actorProfile.organization_id,
    isPlatformAdmin: isPlatformAdminUser(user.id),
    supabaseAdmin,
  };
}

async function getDepartmentApprovalContext(): Promise<DepartmentApprovalContext> {
  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "로그인 정보가 유효하지 않습니다." };
  }

  const supabaseAdmin = getServiceRoleClient();
  if (!supabaseAdmin) {
    console.error("Department approval service-role client is not configured.");
    return { ok: false, message: "승인 기능을 사용할 수 없습니다." };
  }

  const { data: actorProfile, error: actorError } = await supabaseAdmin
    .from("profiles")
    .select("role,organization_id,department")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError) {
    console.error("Department approval permission lookup failed:", actorError);
    return { ok: false, message: "승인 권한을 확인할 수 없습니다." };
  }

  if (
    !actorProfile ||
    (actorProfile.role !== "admin" && actorProfile.role !== "manager")
  ) {
    return { ok: false, message: "부서 변경 승인 권한이 없습니다." };
  }

  if (!actorProfile.organization_id) {
    return { ok: false, message: "소속 기관 정보를 확인할 수 없습니다." };
  }

  return {
    ok: true,
    actorId: user.id,
    actorOrganizationId: actorProfile.organization_id,
    actorDepartment: actorProfile.department,
    actorRole: actorProfile.role,
    supabaseAdmin,
  };
}

export async function listOrganizationsForAdmin() {
  const context = await getAdminContext();
  if (!context.ok) {
    return {
      success: false as const,
      error: context.message,
      organizations: [],
      canManageAllOrganizations: false,
    };
  }

  let query = context.supabaseAdmin.from("organizations").select("id,name");
  if (!context.isPlatformAdmin) {
    if (!context.actorOrganizationId) {
      return {
        success: false as const,
        error: "소속 기관 정보를 확인할 수 없습니다.",
        organizations: [],
        canManageAllOrganizations: false,
      };
    }
    query = query.eq("id", context.actorOrganizationId);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("Admin organization list failed:", error);
    return {
      success: false as const,
      error: "기관 목록을 불러오지 못했습니다.",
      organizations: [],
      canManageAllOrganizations: context.isPlatformAdmin,
    };
  }

  return {
    success: true as const,
    organizations: (data ?? []) as Array<{ id: string; name: string }>,
    canManageAllOrganizations: context.isPlatformAdmin,
  };
}

export async function listUsersForAdminOrganizationManagement() {
  const context = await getAdminContext();
  if (!context.ok) {
    return {
      success: false as const,
      error: context.message,
      users: [] as AdminOrganizationUser[],
      canManageAllOrganizations: false,
    };
  }

  let query = context.supabaseAdmin
    .from("profiles")
    .select("id,email,name,department,role,organization_id,created_at");

  if (!context.isPlatformAdmin) {
    if (!context.actorOrganizationId) {
      return {
        success: false as const,
        error: "소속 기관 정보를 확인할 수 없습니다.",
        users: [] as AdminOrganizationUser[],
        canManageAllOrganizations: false,
      };
    }
    query = query.eq("organization_id", context.actorOrganizationId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Admin organization user list failed:", error);
    return {
      success: false as const,
      error: "사용자 목록을 불러오지 못했습니다.",
      users: [] as AdminOrganizationUser[],
      canManageAllOrganizations: context.isPlatformAdmin,
    };
  }

  return {
    success: true as const,
    users: (data ?? []) as AdminOrganizationUser[],
    canManageAllOrganizations: context.isPlatformAdmin,
  };
}

export async function listDepartmentsForAdminOrganization(organizationId: string) {
  const context = await getAdminContext();
  if (!context.ok) {
    return { success: false as const, error: context.message, departments: [] };
  }

  if (typeof organizationId !== "string") {
    return { success: false as const, error: "올바르지 않은 기관 ID입니다.", departments: [] };
  }

  if (!organizationId) {
    return { success: true as const, departments: [] as string[] };
  }

  if (!UUID_PATTERN.test(organizationId)) {
    return { success: false as const, error: "올바르지 않은 기관 ID입니다.", departments: [] };
  }

  if (
    !context.isPlatformAdmin &&
    context.actorOrganizationId !== organizationId
  ) {
    return {
      success: false as const,
      error: "소속 기관의 부서만 조회할 수 있습니다.",
      departments: [],
    };
  }

  const { data, error } = await context.supabaseAdmin
    .from("departments")
    .select("name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Admin department list failed:", error);
    return { success: false as const, error: "부서 목록을 불러오지 못했습니다.", departments: [] };
  }

  return {
    success: true as const,
    departments: (data ?? []).map((department) => department.name),
  };
}

export async function createOrganizationForAdmin(name: string) {
  const context = await getAdminContext();
  if (!context.ok) {
    return { success: false as const, error: context.message };
  }

  if (!context.isPlatformAdmin) {
    return {
      success: false as const,
      error: "플랫폼 관리자만 새 기관을 추가할 수 있습니다.",
    };
  }

  if (typeof name !== "string") {
    return { success: false as const, error: "올바르지 않은 기관 이름입니다." };
  }

  const organizationName = name.trim();
  if (!organizationName) {
    return { success: false as const, error: "기관 이름을 입력해주세요." };
  }

  const { data, error } = await context.supabaseAdmin
    .from("organizations")
    .insert({ name: organizationName })
    .select("id,name")
    .single();

  if (error) {
    console.error("Platform organization create failed:", error);
    return { success: false as const, error: "기관 생성에 실패했습니다." };
  }

  return {
    success: true as const,
    organization: data as { id: string; name: string },
  };
}

export async function createOrganizationForCurrentPlatformAdmin(name: string) {
  const context = await getAdminContext();
  if (!context.ok) {
    return { success: false as const, error: context.message };
  }

  if (!context.isPlatformAdmin) {
    return {
      success: false as const,
      error: "플랫폼 관리자만 새 기관을 생성할 수 있습니다.",
    };
  }

  if (context.actorOrganizationId) {
    return {
      success: false as const,
      error: "이미 소속 기관이 있습니다.",
    };
  }

  if (typeof name !== "string" || !name.trim()) {
    return { success: false as const, error: "기관 이름을 입력해주세요." };
  }

  const { data: organization, error: createError } = await context.supabaseAdmin
    .from("organizations")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();

  if (createError || !organization) {
    console.error("Platform initial organization create failed:", createError);
    return { success: false as const, error: "기관 생성에 실패했습니다." };
  }

  const { data: updatedActor, error: assignError } = await context.supabaseAdmin
    .from("profiles")
    .update({ organization_id: organization.id })
    .eq("id", context.actorId)
    .is("organization_id", null)
    .select("id")
    .maybeSingle();

  if (assignError || !updatedActor) {
    console.error("Platform initial organization assignment failed:", assignError);
    const { error: cleanupError } = await context.supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", organization.id);
    if (cleanupError) {
      console.error("Platform initial organization cleanup failed:", cleanupError);
    }
    return { success: false as const, error: "기관 생성에 실패했습니다." };
  }

  return {
    success: true as const,
    organization: organization as { id: string; name: string },
  };
}

export async function reassignUserOrganizationForAdmin(input: {
  targetUserId: string;
  targetOrganizationId: string;
  department: string | null;
  role: Role;
}) {
  const context = await getAdminContext();
  if (!context.ok) {
    return { success: false as const, error: context.message };
  }

  if (
    !input ||
    typeof input.targetUserId !== "string" ||
    typeof input.targetOrganizationId !== "string" ||
    (input.department !== null && typeof input.department !== "string") ||
    typeof input.role !== "string"
  ) {
    return { success: false as const, error: "올바르지 않은 요청입니다." };
  }

  if (!input.targetUserId || !input.targetOrganizationId) {
    return { success: false as const, error: "대상 사용자와 기관을 선택해주세요." };
  }

  if (
    !UUID_PATTERN.test(input.targetUserId) ||
    !UUID_PATTERN.test(input.targetOrganizationId)
  ) {
    return { success: false as const, error: "올바르지 않은 사용자 또는 기관 ID입니다." };
  }

  if (!VALID_ROLES.includes(input.role)) {
    return { success: false as const, error: "올바르지 않은 사용자 권한입니다." };
  }

  if (input.targetUserId === context.actorId) {
    return {
      success: false as const,
      error: "현재 로그인한 본인 계정은 이 화면에서 기관을 변경할 수 없습니다.",
    };
  }

  const { data: targetProfile, error: targetProfileError } = await context.supabaseAdmin
    .from("profiles")
    .select("id,organization_id,department,role")
    .eq("id", input.targetUserId)
    .maybeSingle();

  if (targetProfileError || !targetProfile) {
    if (targetProfileError) {
      console.error("Organization reassignment target lookup failed:", targetProfileError);
    }
    return {
      success: false as const,
      error: "대상 사용자를 찾을 수 없습니다.",
    };
  }

  if (
    !context.isPlatformAdmin &&
    (!context.actorOrganizationId ||
      targetProfile.organization_id !== context.actorOrganizationId ||
      input.targetOrganizationId !== context.actorOrganizationId)
  ) {
    return {
      success: false as const,
      error: "소속 기관의 사용자만 관리할 수 있습니다.",
    };
  }

  const { data: targetOrganization, error: targetOrganizationError } = await context.supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("id", input.targetOrganizationId)
    .maybeSingle();

  if (targetOrganizationError || !targetOrganization) {
    if (targetOrganizationError) {
      console.error("Organization reassignment organization lookup failed:", targetOrganizationError);
    }
    return {
      success: false as const,
      error: "대상 기관을 찾을 수 없습니다.",
    };
  }

  const nextDepartment = input.department?.trim() ? input.department.trim() : null;

  if (nextDepartment) {
    const { data: targetDepartment, error: targetDepartmentError } =
      await context.supabaseAdmin
        .from("departments")
        .select("id")
        .eq("organization_id", input.targetOrganizationId)
        .eq("name", nextDepartment)
        .maybeSingle();

    if (targetDepartmentError) {
      console.error(
        "Organization reassignment department lookup failed:",
        targetDepartmentError
      );
      return {
        success: false as const,
        error: "대상 부서를 확인할 수 없습니다.",
      };
    }

    if (!targetDepartment) {
      return {
        success: false as const,
        error: "대상 기관에 존재하는 부서를 선택해주세요.",
      };
    }
  }

  const isNoChange =
    targetProfile.organization_id === input.targetOrganizationId &&
    (targetProfile.department ?? null) === nextDepartment &&
    targetProfile.role === input.role;

  if (isNoChange) {
    return { success: false as const, error: "변경할 내용이 없습니다." };
  }

  const removesAdminFromOrganization =
    targetProfile.role === "admin" &&
    Boolean(targetProfile.organization_id) &&
    (targetProfile.organization_id !== input.targetOrganizationId ||
      input.role !== "admin");

  if (removesAdminFromOrganization && targetProfile.organization_id) {
    const { count: otherAdminCount, error: adminCountError } =
      await context.supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", targetProfile.organization_id)
        .eq("role", "admin")
        .neq("id", input.targetUserId);

    if (adminCountError) {
      console.error(
        "Organization reassignment remaining admin lookup failed:",
        adminCountError
      );
      return {
        success: false as const,
        error: "기관의 관리자 구성을 확인할 수 없습니다.",
      };
    }

    if ((otherAdminCount ?? 0) === 0) {
      return {
        success: false as const,
        error: "기관에는 최소 한 명의 최고 관리자가 남아 있어야 합니다.",
      };
    }
  }

  let updateQuery = context.supabaseAdmin
    .from("profiles")
    .update({
      organization_id: input.targetOrganizationId,
      department: nextDepartment,
      role: input.role,
    })
    .eq("id", input.targetUserId);

  updateQuery =
    targetProfile.organization_id === null
      ? updateQuery.is("organization_id", null)
      : updateQuery.eq("organization_id", targetProfile.organization_id);

  updateQuery =
    targetProfile.department === null
      ? updateQuery.is("department", null)
      : updateQuery.eq("department", targetProfile.department);

  updateQuery =
    targetProfile.role === null
      ? updateQuery.is("role", null)
      : updateQuery.eq("role", targetProfile.role);

  const { data: updatedProfile, error: updateError } = await updateQuery
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Organization reassignment failed:", updateError);
    return { success: false as const, error: "기관 지정/이관에 실패했습니다." };
  }

  if (!updatedProfile) {
    return {
      success: false as const,
      error: "사용자 정보가 변경되었습니다. 새로고침 후 다시 시도해주세요.",
    };
  }

  await context.supabaseAdmin.from("audit_logs").insert({
    organization_id: input.targetOrganizationId,
    actor_id: context.actorId,
    action: "user_org_reassigned",
    target_type: "profile",
    target_id: input.targetUserId,
    metadata: {
      from_organization_id: targetProfile.organization_id,
      to_organization_id: input.targetOrganizationId,
      from_department: targetProfile.department,
      to_department: nextDepartment,
      from_role: targetProfile.role,
      to_role: input.role,
    },
  });

  return { success: true as const };
}

export async function approveDepartmentChangeForOrganization(
  requestId: string
) {
  if (typeof requestId !== "string") {
    return { success: false as const, error: "올바른 요청이 아닙니다." };
  }

  const normalizedRequestId = requestId.trim();
  if (!UUID_PATTERN.test(normalizedRequestId)) {
    return { success: false as const, error: "올바른 요청이 아닙니다." };
  }

  const context = await getDepartmentApprovalContext();
  if (!context.ok) {
    return { success: false as const, error: context.message };
  }

  const { data: request, error: requestError } = await context.supabaseAdmin
    .from("department_change_requests")
    .select(
      "id,organization_id,requester_id,from_department,to_department,status"
    )
    .eq("id", normalizedRequestId)
    .eq("status", "pending")
    .maybeSingle();

  if (requestError) {
    console.error("Department approval request lookup failed:", requestError);
    return {
      success: false as const,
      error: "부서 변경 요청을 확인할 수 없습니다.",
    };
  }

  if (!request) {
    return {
      success: false as const,
      error: "대기 중인 부서 변경 요청을 찾을 수 없습니다.",
    };
  }

  if (request.organization_id !== context.actorOrganizationId) {
    return { success: false as const, error: "이 요청을 승인할 수 없습니다." };
  }

  if (
    typeof request.to_department !== "string" ||
    !request.to_department.trim()
  ) {
    return {
      success: false as const,
      error: "변경할 부서 정보가 올바르지 않습니다.",
    };
  }

  if (
    context.actorRole === "manager" &&
    request.requester_id === context.actorId
  ) {
    return {
      success: false as const,
      error: "자신의 부서 변경 요청은 직접 승인할 수 없습니다.",
    };
  }

  if (
    context.actorRole === "manager" &&
    (context.actorDepartment === null ||
      (context.actorDepartment !== request.from_department &&
        context.actorDepartment !== request.to_department))
  ) {
    return {
      success: false as const,
      error: "담당 부서의 변경 요청만 승인할 수 있습니다.",
    };
  }

  const { data: targetDepartment, error: departmentError } =
    await context.supabaseAdmin
      .from("departments")
      .select("id")
      .eq("organization_id", context.actorOrganizationId)
      .eq("name", request.to_department)
      .maybeSingle();

  if (departmentError) {
    console.error("Department approval destination lookup failed:", departmentError);
    return {
      success: false as const,
      error: "변경할 부서를 확인할 수 없습니다.",
    };
  }

  if (!targetDepartment) {
    return {
      success: false as const,
      error: "변경할 부서가 존재하지 않습니다.",
    };
  }

  const { data: targetProfile, error: targetError } =
    await context.supabaseAdmin
      .from("profiles")
      .select("id,organization_id,department,role")
      .eq("id", request.requester_id)
      .maybeSingle();

  if (targetError) {
    console.error("Department approval target lookup failed:", targetError);
    return {
      success: false as const,
      error: "요청자의 현재 정보를 확인할 수 없습니다.",
    };
  }

  if (
    !targetProfile ||
    targetProfile.organization_id !== context.actorOrganizationId
  ) {
    return { success: false as const, error: "이 요청을 승인할 수 없습니다." };
  }

  if (context.actorRole === "manager" && targetProfile.role !== "user") {
    return {
      success: false as const,
      error: "부서 관리자는 일반 사용자의 요청만 승인할 수 있습니다.",
    };
  }

  if (targetProfile.department !== request.from_department) {
    return {
      success: false as const,
      error: "요청자의 부서가 변경되었습니다. 새로고침 후 다시 확인해주세요.",
    };
  }

  let profileUpdate = context.supabaseAdmin
    .from("profiles")
    .update({ department: request.to_department })
    .eq("id", request.requester_id)
    .eq("organization_id", context.actorOrganizationId);

  if (context.actorRole === "manager") {
    profileUpdate = profileUpdate.eq("role", "user");
  }

  profileUpdate =
    request.from_department === null
      ? profileUpdate.is("department", null)
      : profileUpdate.eq("department", request.from_department);

  const { data: updatedProfile, error: profileUpdateError } =
    await profileUpdate.select("id").maybeSingle();

  if (profileUpdateError) {
    console.error("Department approval profile update failed:", profileUpdateError);
    return {
      success: false as const,
      error: "부서 변경을 적용하지 못했습니다. 다시 시도해주세요.",
    };
  }

  if (!updatedProfile) {
    return {
      success: false as const,
      error: "요청자의 부서가 변경되었습니다. 새로고침 후 다시 확인해주세요.",
    };
  }

  const resolvedAt = new Date().toISOString();
  let requestResolution = context.supabaseAdmin
    .from("department_change_requests")
    .update({
      status: "approved",
      resolved_at: resolvedAt,
      resolved_by: context.actorId,
    })
    .eq("id", request.id)
    .eq("organization_id", context.actorOrganizationId)
    .eq("requester_id", request.requester_id)
    .eq("to_department", request.to_department)
    .eq("status", "pending");

  requestResolution =
    request.from_department === null
      ? requestResolution.is("from_department", null)
      : requestResolution.eq("from_department", request.from_department);

  const { data: resolvedRequest, error: requestUpdateError } =
    await requestResolution.select("id").maybeSingle();

  if (requestUpdateError || !resolvedRequest) {
    if (requestUpdateError) {
      console.error(
        "Department approval request resolution failed:",
        requestUpdateError
      );
    }

    let compensationUpdate = context.supabaseAdmin
      .from("profiles")
      .update({ department: request.from_department })
      .eq("id", request.requester_id)
      .eq("organization_id", context.actorOrganizationId);

    if (context.actorRole === "manager") {
      compensationUpdate = compensationUpdate.eq("role", "user");
    }

    compensationUpdate =
      request.to_department === null
        ? compensationUpdate.is("department", null)
        : compensationUpdate.eq("department", request.to_department);

    const { data: compensatedProfile, error: compensationError } =
      await compensationUpdate.select("id").maybeSingle();

    if (compensationError || !compensatedProfile) {
      console.error("Department approval compensation failed:", {
        requestId: request.id,
        error: compensationError,
      });
      return {
        success: false as const,
        error: "승인 처리에 실패했습니다. 관리자에게 문의해주세요.",
      };
    }

    return {
      success: false as const,
      error: "요청 상태가 변경되었습니다. 새로고침 후 다시 시도해주세요.",
    };
  }

  const { error: auditError } = await context.supabaseAdmin
    .from("audit_logs")
    .insert({
      organization_id: context.actorOrganizationId,
      actor_id: context.actorId,
      action: "department_change_approved",
      target_type: "department_change_request",
      target_id: request.id,
      metadata: {
        requester_id: request.requester_id,
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

  const auditWarning = auditError
    ? "부서 변경은 승인되었지만 처리 기록을 저장하지 못했습니다. 관리자에게 문의해주세요."
    : null;

  if (auditError) {
    console.error("Department approval audit log failed:", auditError);
  }

  return { success: true as const, warning: auditWarning };
}

export async function rejectDepartmentChangeForOrganization(
  requestId: string
) {
  if (typeof requestId !== "string") {
    return { success: false as const, error: "올바른 요청이 아닙니다." };
  }

  const normalizedRequestId = requestId.trim();
  if (!UUID_PATTERN.test(normalizedRequestId)) {
    return { success: false as const, error: "올바른 요청이 아닙니다." };
  }

  const context = await getDepartmentApprovalContext();
  if (!context.ok) {
    return { success: false as const, error: context.message };
  }

  const { data: request, error: requestError } = await context.supabaseAdmin
    .from("department_change_requests")
    .select(
      "id,organization_id,requester_id,from_department,to_department,status"
    )
    .eq("id", normalizedRequestId)
    .eq("status", "pending")
    .maybeSingle();

  if (requestError) {
    console.error("Department rejection request lookup failed:", requestError);
    return {
      success: false as const,
      error: "부서 변경 요청을 확인할 수 없습니다.",
    };
  }

  if (!request) {
    return {
      success: false as const,
      error: "대기 중인 부서 변경 요청을 찾을 수 없습니다.",
    };
  }

  if (request.organization_id !== context.actorOrganizationId) {
    return { success: false as const, error: "이 요청을 거부할 수 없습니다." };
  }

  if (
    context.actorRole === "manager" &&
    (context.actorDepartment === null ||
      (context.actorDepartment !== request.from_department &&
        context.actorDepartment !== request.to_department))
  ) {
    return {
      success: false as const,
      error: "담당 부서의 변경 요청만 거부할 수 있습니다.",
    };
  }

  const { data: targetProfile, error: targetError } =
    await context.supabaseAdmin
      .from("profiles")
      .select("id,organization_id,role")
      .eq("id", request.requester_id)
      .maybeSingle();

  if (targetError) {
    console.error("Department rejection target lookup failed:", targetError);
    return {
      success: false as const,
      error: "요청자의 현재 정보를 확인할 수 없습니다.",
    };
  }

  if (
    !targetProfile ||
    targetProfile.organization_id !== context.actorOrganizationId
  ) {
    return { success: false as const, error: "이 요청을 거부할 수 없습니다." };
  }

  if (context.actorRole === "manager" && targetProfile.role !== "user") {
    return {
      success: false as const,
      error: "부서 관리자는 일반 사용자의 요청만 거부할 수 있습니다.",
    };
  }

  const resolvedAt = new Date().toISOString();
  let requestResolution = context.supabaseAdmin
    .from("department_change_requests")
    .update({
      status: "rejected",
      resolved_at: resolvedAt,
      resolved_by: context.actorId,
    })
    .eq("id", request.id)
    .eq("organization_id", context.actorOrganizationId)
    .eq("requester_id", request.requester_id)
    .eq("to_department", request.to_department)
    .eq("status", "pending");

  requestResolution =
    request.from_department === null
      ? requestResolution.is("from_department", null)
      : requestResolution.eq("from_department", request.from_department);

  const { data: resolvedRequest, error: requestUpdateError } =
    await requestResolution.select("id").maybeSingle();

  if (requestUpdateError) {
    console.error("Department rejection request resolution failed:", requestUpdateError);
    return {
      success: false as const,
      error: "부서 변경 요청을 거부하지 못했습니다. 다시 시도해주세요.",
    };
  }

  if (!resolvedRequest) {
    return {
      success: false as const,
      error: "요청 상태가 변경되었습니다. 새로고침 후 다시 시도해주세요.",
    };
  }

  const { error: auditError } = await context.supabaseAdmin
    .from("audit_logs")
    .insert({
      organization_id: context.actorOrganizationId,
      actor_id: context.actorId,
      action: "department_change_rejected",
      target_type: "department_change_request",
      target_id: request.id,
      metadata: {
        requester_id: request.requester_id,
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

  const auditWarning = auditError
    ? "부서 변경은 거부되었지만 처리 기록을 저장하지 못했습니다. 관리자에게 문의해주세요."
    : null;

  if (auditError) {
    console.error("Department rejection audit log failed:", auditError);
  }

  return { success: true as const, warning: auditWarning };
}
