"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Role = "admin" | "manager" | "user";

type AdminContext =
  | {
      ok: true;
      actorId: string;
      supabaseAdmin: ReturnType<typeof getServiceRoleClient> extends null
        ? never
        : NonNullable<ReturnType<typeof getServiceRoleClient>>;
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError) {
    return { ok: false, message: `권한 확인 실패: ${actorError.message}` };
  }

  if (!actorProfile || actorProfile.role !== "admin") {
    return { ok: false, message: "최고 관리자만 수행할 수 있습니다." };
  }

  return { ok: true, actorId: user.id, supabaseAdmin };
}

export async function listOrganizationsForAdmin() {
  const context = await getAdminContext();
  if (!context.ok) {
    return { success: false as const, error: context.message, organizations: [] };
  }

  const { data, error } = await context.supabaseAdmin
    .from("organizations")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    return { success: false as const, error: error.message, organizations: [] };
  }

  return {
    success: true as const,
    organizations: (data ?? []) as Array<{ id: string; name: string }>,
  };
}

export async function listDepartmentsForAdminOrganization(organizationId: string) {
  const context = await getAdminContext();
  if (!context.ok) {
    return { success: false as const, error: context.message, departments: [] };
  }

  if (!organizationId) {
    return { success: true as const, departments: [] as string[] };
  }

  const { data, error } = await context.supabaseAdmin
    .from("departments")
    .select("name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    return { success: false as const, error: error.message, departments: [] };
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
    return { success: false as const, error: `기관 생성 실패: ${error.message}` };
  }

  return {
    success: true as const,
    organization: data as { id: string; name: string },
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

  if (!input.targetUserId || !input.targetOrganizationId) {
    return { success: false as const, error: "대상 사용자와 기관을 선택해주세요." };
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
    return {
      success: false as const,
      error: targetProfileError?.message ?? "대상 사용자를 찾을 수 없습니다.",
    };
  }

  const { data: targetOrganization, error: targetOrganizationError } = await context.supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("id", input.targetOrganizationId)
    .maybeSingle();

  if (targetOrganizationError || !targetOrganization) {
    return {
      success: false as const,
      error: targetOrganizationError?.message ?? "대상 기관을 찾을 수 없습니다.",
    };
  }

  const nextDepartment = input.department?.trim() ? input.department.trim() : null;
  const isNoChange =
    targetProfile.organization_id === input.targetOrganizationId &&
    (targetProfile.department ?? null) === nextDepartment &&
    targetProfile.role === input.role;

  if (isNoChange) {
    return { success: false as const, error: "변경할 내용이 없습니다." };
  }

  const { error: updateError } = await context.supabaseAdmin
    .from("profiles")
    .update({
      organization_id: input.targetOrganizationId,
      department: nextDepartment,
      role: input.role,
    })
    .eq("id", input.targetUserId);

  if (updateError) {
    return { success: false as const, error: `기관 지정/이관 실패: ${updateError.message}` };
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
