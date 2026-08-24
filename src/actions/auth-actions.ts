"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SupabaseFunctionError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type ClaimedAccountDeletionRequest = {
  result_request_id: string;
  result_requester_id: string;
  result_organization_id: string;
  result_transfer_to_user_id: string;
  result_operation_id: string;
};

const getServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const isMissingAccountDeletionRpc = (error: SupabaseFunctionError) => {
  if (error.code === "PGRST202" || error.code === "42883") {
    return true;
  }

  const description = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    description.includes("account_deletion_request") &&
    (description.includes("does not exist") ||
      description.includes("could not find") ||
      description.includes("not found") ||
      description.includes("schema cache"))
  );
};

const getAccountDeletionActionContext = async () => {
  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user: actor },
    error: actorAuthError,
  } = await supabaseServer.auth.getUser();

  if (actorAuthError || !actor) {
    return { ok: false as const, error: "로그인이 필요합니다." };
  }

  const supabaseAdmin = getServiceRoleClient();
  if (!supabaseAdmin) {
    return {
      ok: false as const,
      error: "계정 탈퇴 승인 기능의 서버 설정을 확인할 수 없습니다.",
    };
  }

  return {
    ok: true as const,
    actorId: actor.id,
    supabaseAdmin,
  };
};

const normalizeAdminNote = (adminNote: unknown) => {
  if (adminNote !== null && adminNote !== undefined && typeof adminNote !== "string") {
    return { ok: false as const, error: "관리자 메모 형식이 올바르지 않습니다." };
  }

  const normalized = typeof adminNote === "string" ? adminNote.trim() || null : null;
  if (normalized && normalized.length > 2000) {
    return { ok: false as const, error: "관리자 메모는 2,000자 이내로 입력해주세요." };
  }

  return { ok: true as const, value: normalized };
};

const migrationRequiredMessage =
  "계정 탈퇴 승인 보안 마이그레이션이 적용되지 않았습니다. 관리자에게 문의해 주세요.";

const parseClaimedAccountDeletionRequest = (value: unknown) => {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") {
    return null;
  }

  const row = rows[0] as Partial<ClaimedAccountDeletionRequest>;
  if (
    !row.result_request_id ||
    !row.result_requester_id ||
    !row.result_organization_id ||
    !row.result_transfer_to_user_id ||
    !row.result_operation_id
  ) {
    return null;
  }

  return row as ClaimedAccountDeletionRequest;
};

const isAuthUserNotFound = (error: { status?: number; message?: string } | null) => {
  if (!error) return false;
  return (
    error.status === 404 ||
    error.message?.toLowerCase().includes("not found") === true ||
    error.message?.toLowerCase().includes("does not exist") === true
  );
};

const isDefiniteAuthDeleteRejection = (error: { status?: number }) => {
  const status = error.status;
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    ![408, 409, 425, 429].includes(status)
  );
};

/**
 * 사용자 계정을 완전히 삭제합니다 (auth.users와 profiles 모두 삭제)
 * @param userId 삭제할 사용자 ID
 * @returns 성공 여부와 에러 메시지
 */
export async function deleteUserAccount(userId: string) {
  try {
    if (!UUID_PATTERN.test(userId)) {
      return {
        success: false,
        error: "올바르지 않은 사용자 ID입니다.",
      };
    }

    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user: actor },
      error: actorAuthError,
    } = await supabaseServer.auth.getUser();

    if (actorAuthError || !actor) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl) {
      return {
        success: false,
        error: "서버 설정 오류: NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다.",
      };
    }

    if (!serviceRoleKey) {
      return {
        success: false,
        error: "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다. Vercel 환경 변수 설정을 확인하세요.",
      };
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const targetProfileResult = await supabaseAdmin
      .from("profiles")
      .select("role,organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileResult.error) {
      console.error("Account deletion target lookup failed:", targetProfileResult.error);
      return {
        success: false,
        error: "계정 삭제 대상을 확인할 수 없습니다.",
      };
    }

    const targetProfile = targetProfileResult.data;

    if (targetProfile?.role === "manager") {
      return {
        success: false,
        error: "부서 관리자는 권한 양도 대상을 지정한 승인 절차로만 삭제할 수 있습니다.",
      };
    }

    if (actor.id !== userId) {
      const actorProfileResult = await supabaseAdmin
        .from("profiles")
        .select("role,organization_id")
        .eq("id", actor.id)
        .maybeSingle();

      if (actorProfileResult.error) {
        console.error("Account deletion permission lookup failed:", actorProfileResult.error);
        return {
          success: false,
          error: "계정 삭제 권한을 확인할 수 없습니다.",
        };
      }

      const actorProfile = actorProfileResult.data;
      const canDeleteOrganizationUser =
        actorProfile?.role === "admin" &&
        Boolean(actorProfile.organization_id) &&
        actorProfile.organization_id === targetProfile?.organization_id;

      if (!canDeleteOrganizationUser) {
        return {
          success: false,
          error: "같은 기관의 최고 관리자만 다른 사용자를 삭제할 수 있습니다.",
        };
      }
    }

    if (targetProfile?.role === "admin" && targetProfile.organization_id) {
      const { count: otherAdminCount, error: adminCountError } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", targetProfile.organization_id)
        .eq("role", "admin")
        .neq("id", userId);

      if (adminCountError) {
        console.error("Remaining organization admin lookup failed:", adminCountError);
        return {
          success: false,
          error: "기관의 관리자 구성을 확인할 수 없습니다.",
        };
      }

      if ((otherAdminCount ?? 0) === 0) {
        return {
          success: false,
          error: "기관에는 최소 한 명의 최고 관리자가 남아 있어야 합니다.",
        };
      }
    }

    // profiles.id는 auth.users를 ON DELETE CASCADE로 참조한다.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId, false);

    if (authError) {
      console.error("Auth user deletion error:", authError);
      return {
        success: false,
        error: `인증 사용자 삭제 실패: ${authError.message}`,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error: unknown) {
    console.error("Unexpected error in deleteUserAccount:", error);
    return {
      success: false,
      error: `예상치 못한 오류: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`,
    };
  }
}

export async function approveAccountDeletionRequest(
  requestId: string,
  adminNote?: unknown
) {
  if (typeof requestId !== "string" || !UUID_PATTERN.test(requestId.trim())) {
    return { success: false as const, error: "올바르지 않은 탈퇴 요청입니다." };
  }

  const normalizedNote = normalizeAdminNote(adminNote);
  if (!normalizedNote.ok) {
    return { success: false as const, error: normalizedNote.error };
  }

  const context = await getAccountDeletionActionContext();
  if (!context.ok) {
    return { success: false as const, error: context.error };
  }

  const normalizedRequestId = requestId.trim();
  const requestedOperationId = crypto.randomUUID();
  const { data: claimData, error: claimError } = await context.supabaseAdmin.rpc(
    "claim_account_deletion_request_for_approval",
    {
      target_request_id: normalizedRequestId,
      target_actor_id: context.actorId,
      target_operation_id: requestedOperationId,
      target_admin_note: normalizedNote.value,
    }
  );

  if (claimError && isMissingAccountDeletionRpc(claimError)) {
    return { success: false as const, error: migrationRequiredMessage };
  }

  const claim = parseClaimedAccountDeletionRequest(claimData);

  if (!claim) {
    console.error("Account deletion approval claim failed or returned an invalid result:", {
      requestId: normalizedRequestId,
      actorId: context.actorId,
      operationId: requestedOperationId,
      claimError,
      claimData,
    });
    return {
      success: false as const,
      error: "대기 중인 탈퇴 요청을 승인할 수 없습니다. 새로고침 후 다시 확인해주세요.",
    };
  }

  const { error: authDeleteError } = await context.supabaseAdmin.auth.admin.deleteUser(
    claim.result_requester_id,
    false
  );

  if (authDeleteError) {
    const { data: authLookupData, error: authLookupError } =
      await context.supabaseAdmin.auth.admin.getUserById(claim.result_requester_id);

    const requesterDefinitelyExists = !authLookupError && Boolean(authLookupData.user);
    const requesterDefinitelyMissing =
      (!authLookupError && !authLookupData.user) || isAuthUserNotFound(authLookupError);
    const deletionDefinitelyRejected = isDefiniteAuthDeleteRejection(authDeleteError);

    if (
      (!requesterDefinitelyExists && !requesterDefinitelyMissing) ||
      (requesterDefinitelyExists && !deletionDefinitelyRejected)
    ) {
      console.error("Auth deletion result could not be reconciled; request remains processing:", {
        requestId: claim.result_request_id,
        requesterId: claim.result_requester_id,
        operationId: claim.result_operation_id,
        authDeleteError,
        authLookupError,
        deletionDefinitelyRejected,
      });
      return {
        success: false as const,
        error: "계정 삭제 결과를 확인할 수 없어 요청 처리를 보류했습니다. 즉시 관리자에게 문의해 주세요.",
      };
    }

    if (requesterDefinitelyExists) {
      const { data: rollbackData, error: rollbackError } =
        await context.supabaseAdmin.rpc(
          "rollback_account_deletion_request_approval",
          {
            target_request_id: claim.result_request_id,
            target_actor_id: context.actorId,
            target_operation_id: claim.result_operation_id,
          }
        );

      if (rollbackError || rollbackData !== true) {
        console.error("Account deletion approval compensation failed:", {
          requestId: claim.result_request_id,
          requesterId: claim.result_requester_id,
          transferToUserId: claim.result_transfer_to_user_id,
          operationId: claim.result_operation_id,
          authDeleteError,
          rollbackError,
          rollbackData,
        });
        return {
          success: false as const,
          error: "계정 삭제와 상태 복구에 실패했습니다. 즉시 관리자에게 문의해 주세요.",
        };
      }

      console.error("Auth user deletion failed after approval claim; changes reverted:", {
        requestId: claim.result_request_id,
        requesterId: claim.result_requester_id,
        authDeleteError,
      });
      return {
        success: false as const,
        error: "인증 사용자 삭제에 실패하여 권한 양도와 요청 상태를 복구했습니다.",
      };
    }

    console.warn("Auth deletion returned an error, but the user is already absent; finalizing:", {
      requestId: claim.result_request_id,
      requesterId: claim.result_requester_id,
      operationId: claim.result_operation_id,
      authDeleteError,
    });
  }

  const { data: finalizeData, error: finalizeError } = await context.supabaseAdmin.rpc(
    "finalize_account_deletion_request_approval",
    {
      target_request_id: claim.result_request_id,
      target_actor_id: context.actorId,
      target_operation_id: claim.result_operation_id,
    }
  );

  if (finalizeError || finalizeData !== true) {
    const { data: finalizedRequest, error: verificationError } =
      await context.supabaseAdmin
        .from("account_deletion_requests")
        .select("status,approval_actor_id_snapshot,approval_operation_id")
        .eq("id", claim.result_request_id)
        .maybeSingle();

    if (
      !verificationError &&
      finalizedRequest?.status === "approved" &&
      finalizedRequest.approval_actor_id_snapshot === context.actorId &&
      finalizedRequest.approval_operation_id === claim.result_operation_id
    ) {
      return { success: true as const };
    }

    console.error("Account deletion approval finalization failed after auth deletion:", {
      requestId: claim.result_request_id,
      requesterId: claim.result_requester_id,
      operationId: claim.result_operation_id,
      finalizeError,
      finalizeData,
      verificationError,
      finalizedRequest,
    });
    return {
      success: false as const,
      error: "계정은 삭제되었지만 승인 기록을 마무리하지 못했습니다. 관리자에게 문의해 주세요.",
    };
  }

  return { success: true as const };
}

export async function rejectAccountDeletionRequest(
  requestId: string,
  adminNote?: unknown
) {
  if (typeof requestId !== "string" || !UUID_PATTERN.test(requestId.trim())) {
    return { success: false as const, error: "올바르지 않은 탈퇴 요청입니다." };
  }

  const normalizedNote = normalizeAdminNote(adminNote);
  if (!normalizedNote.ok) {
    return { success: false as const, error: normalizedNote.error };
  }

  const context = await getAccountDeletionActionContext();
  if (!context.ok) {
    return { success: false as const, error: context.error };
  }

  const normalizedRequestId = requestId.trim();
  const { data, error } = await context.supabaseAdmin.rpc(
    "reject_account_deletion_request",
    {
      target_request_id: normalizedRequestId,
      target_actor_id: context.actorId,
      target_admin_note: normalizedNote.value,
    }
  );

  if (error) {
    if (isMissingAccountDeletionRpc(error)) {
      return { success: false as const, error: migrationRequiredMessage };
    }

    console.error("Account deletion rejection failed:", {
      requestId: normalizedRequestId,
      actorId: context.actorId,
      code: error.code,
      message: error.message,
    });
    return {
      success: false as const,
      error: "대기 중인 탈퇴 요청을 거부할 수 없습니다. 새로고침 후 다시 확인해주세요.",
    };
  }

  if (data !== true) {
    console.error("Account deletion rejection returned an invalid result:", {
      requestId: normalizedRequestId,
      data,
    });
    return {
      success: false as const,
      error: "탈퇴 요청 거부 결과를 확인할 수 없습니다.",
    };
  }

  return { success: true as const };
}
