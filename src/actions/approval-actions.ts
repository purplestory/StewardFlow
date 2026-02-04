"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ApprovalPolicy } from "@/types/database";

export async function listApprovalPoliciesByOrg(
  scope: ApprovalPolicy["scope"],
  organizationId: string | null
): Promise<ApprovalPolicy[]> {
  if (!organizationId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("scope", scope)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ApprovalPolicy[];
}

/**
 * Create default approval policies for a newly created organization
 * This is called after organization creation and profile update
 * @param organizationId - The ID of the organization
 * @param userId - The ID of the user creating the policies (for RLS)
 */
export async function ensureDefaultApprovalPolicies(
  organizationId: string,
  userId: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    if (!userId) {
      return { ok: false, message: "사용자 ID가 필요합니다." };
    }

    // Wait a bit for profile update to be reflected in RLS policies
    // This is especially important after organization creation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const supabase = await createSupabaseServerClient();
    
    // Check existing policies
    const { data: existingPolicies, error: selectError } = await supabase
      .from("approval_policies")
      .select("id,scope,department")
      .eq("organization_id", organizationId);

    if (selectError) {
      // If select fails, wait a bit and retry (RLS might not be updated yet)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { data: retryData, error: retryError } = await supabase
        .from("approval_policies")
        .select("id,scope,department")
        .eq("organization_id", organizationId);

      if (retryError) {
        return {
          ok: false,
          message: `기존 정책 조회 실패: ${retryError.message}`,
        };
      }

      const existingScopes = new Set(
        (retryData ?? [])
          .filter((row) => row.department === null)
          .map((row) => row.scope)
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

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("approval_policies")
          .insert(rows);

        if (insertError) {
          return {
            ok: false,
            message: `기본 정책 생성 실패: ${insertError.message}`,
          };
        }
      }

      return { ok: true };
    }

    // Normal flow if select succeeded
    const existingScopes = new Set(
      (existingPolicies ?? [])
        .filter((row) => row.department === null)
        .map((row) => row.scope)
    );

    const rows = [
      { scope: "asset", required_role: "admin" },
      { scope: "space", required_role: "admin" },
    ]
      .filter((row) => !existingScopes.has(row.scope))
      .map((row) => ({
        organization_id: organizationId,
        scope: row.scope,
        department: null,
        required_role: row.required_role,
      }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("approval_policies")
        .insert(rows);

      if (insertError) {
        return {
          ok: false,
          message: `기본 정책 생성 실패: ${insertError.message}`,
        };
      }
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
