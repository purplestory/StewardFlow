import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReservationStatus = "pending" | "approved" | "returned" | "rejected";
type ScheduledReservationResourceType = "asset" | "space" | "vehicle";
type ReservationResourceType = ScheduledReservationResourceType | "book";
type BookLoanStatus =
  | "requested"
  | "approved"
  | "borrowed"
  | "returned"
  | "rejected"
  | "cancelled"
  | "overdue";

type SupabaseFunctionError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const parseReservationBody = async (request: Request) => {
  return request.json().catch(() => null) as Promise<{
    reservationId?: string;
    accessToken?: string;
    resourceType?: ReservationResourceType | string;
    startDate?: string;
    endDate?: string;
    note?: string | null;
    cancelReason?: string | null;
  } | null>;
};

const getReservationIdFromRequest = (request: Request) => {
  const url = new URL(request.url);
  return url.searchParams.get("reservationId")?.trim() ?? null;
};

const getResourceTypeFromRequest = (request: Request) => {
  const url = new URL(request.url);
  return url.searchParams.get("resourceType")?.trim() ?? null;
};

const RESERVATION_TABLE_MAP = {
  asset: { table: "reservations", resourceColumn: "asset_id" },
  space: { table: "space_reservations", resourceColumn: "space_id" },
  vehicle: { table: "vehicle_reservations", resourceColumn: "vehicle_id" },
} as const;

type ReservationTableConfig = (typeof RESERVATION_TABLE_MAP)[ScheduledReservationResourceType];

const RESOURCE_NAME_TABLE_MAP: Record<
  ScheduledReservationResourceType,
  { table: "assets" | "spaces" | "vehicles"; nameColumn: "name" }
> = {
  asset: { table: "assets", nameColumn: "name" },
  space: { table: "spaces", nameColumn: "name" },
  vehicle: { table: "vehicles", nameColumn: "name" },
};

const normalizeResourceType = (
  value: ReservationResourceType | string | null | undefined
): ReservationResourceType | null => {
  if (value === "asset" || value === "space" || value === "vehicle" || value === "book") {
    return value;
  }
  return null;
};

const getAuthedClient = async (accessToken: string) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { client: null, error: "Supabase 환경 변수가 없습니다." };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return { client: null, error: "로그인이 필요합니다." };
  }

  return { client, userId: userData.user.id as string };
};

const getServiceClient = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

const loadOwnedPendingReservation = async (
  client: SupabaseClient,
  config: ReservationTableConfig,
  reservationId: string,
  userId: string
) => {
  const selectColumns = [
    "id",
    config.resourceColumn,
    "borrower_id",
    "organization_id",
    "status",
    "start_date",
    "end_date",
    "note",
  ].join(",");

  const { data, error } = await client
    .from(config.table)
    .select(selectColumns)
    .eq("id", reservationId)
    .maybeSingle();
  const reservationData = data as
    | ({
        id: string;
        borrower_id: string;
        organization_id: string | null;
        status: ReservationStatus;
        start_date: string;
        end_date: string;
        note: string | null;
      } & Record<string, string | null>)
    | null;

  if (error) {
    return { reservation: null, error: error.message };
  }
  if (!reservationData) {
    return { reservation: null, error: "예약 정보를 찾을 수 없습니다." };
  }
  if (reservationData.borrower_id !== userId) {
    return { reservation: null, error: "본인 예약만 수정할 수 있습니다." };
  }
  if (reservationData.status !== "pending") {
    return { reservation: null, error: "승인 대기 상태에서만 수정/취소할 수 있습니다." };
  }

  return {
    reservation: reservationData,
    error: null,
  };
};

const loadOwnedReservation = async (
  client: SupabaseClient,
  config: ReservationTableConfig,
  reservationId: string,
  userId: string
) => {
  const selectColumns = [
    "id",
    config.resourceColumn,
    "borrower_id",
    "organization_id",
    "status",
    "start_date",
    "end_date",
    "note",
  ].join(",");

  const { data, error } = await client
    .from(config.table)
    .select(selectColumns)
    .eq("id", reservationId)
    .maybeSingle();
  const reservationData = data as
    | ({
        id: string;
        borrower_id: string;
        organization_id: string | null;
        status: ReservationStatus;
        start_date: string;
        end_date: string;
        note: string | null;
      } & Record<string, string | null>)
    | null;

  if (error) {
    return { reservation: null, error: error.message };
  }
  if (!reservationData) {
    return { reservation: null, error: "예약 정보를 찾을 수 없습니다." };
  }
  if (reservationData.borrower_id !== userId) {
    return { reservation: null, error: "본인 예약만 처리할 수 있습니다." };
  }

  return {
    reservation: reservationData,
    error: null,
  };
};

type OwnedBookLoan = {
  id: string;
  organization_id: string;
  book_item_id: string;
  borrower_id: string;
  owner_profile_id: string | null;
  status: BookLoanStatus;
  requested_at: string;
  approved_at: string | null;
  borrowed_at: string | null;
  due_at: string | null;
  returned_at: string | null;
};

const loadOwnedBookLoan = async (
  client: SupabaseClient,
  loanId: string,
  userId: string
) => {
  const { data, error } = await client
    .from("book_loans")
    .select(
      "id,organization_id,book_item_id,borrower_id,owner_profile_id,status,requested_at,approved_at,borrowed_at,due_at,returned_at"
    )
    .eq("id", loanId)
    .maybeSingle<OwnedBookLoan>();

  if (error) {
    return { loan: null, error: error.message };
  }
  if (!data) {
    return { loan: null, error: "도서 대출 신청을 찾을 수 없습니다." };
  }
  if (data.borrower_id !== userId) {
    return { loan: null, error: "본인의 도서 대출 신청만 처리할 수 있습니다." };
  }

  return { loan: data, error: null };
};

const isMissingAtomicBookCancellationFunction = (error: SupabaseFunctionError) => {
  if (error.code === "PGRST202" || error.code === "42883") {
    return true;
  }

  const description = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    description.includes("cancel_requested_book_loan_atomic") &&
    (description.includes("does not exist") ||
      description.includes("could not find") ||
      description.includes("not found") ||
      description.includes("schema cache"))
  );
};

const hasUnreadCancellationRequest = async (
  dbClient: SupabaseClient,
  organizationId: string,
  notificationType: string,
  payloadMatch: Record<string, string>
) => {
  const { data, error } = await dbClient
    .from("notifications")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("type", notificationType)
    .is("read_at", null)
    .contains("payload", payloadMatch)
    .limit(1);

  return { exists: Boolean(data && data.length > 0), error };
};

const cancelRequestedBookLoanFallback = async (
  dbClient: SupabaseClient,
  loan: OwnedBookLoan,
  userId: string
) => {
  const { data: activeLoans, error: activeLoansError } = await dbClient
    .from("book_loans")
    .select("id")
    .eq("organization_id", loan.organization_id)
    .eq("book_item_id", loan.book_item_id)
    .neq("id", loan.id)
    .in("status", ["requested", "approved", "borrowed", "overdue"])
    .limit(1);

  if (activeLoansError) {
    return NextResponse.json(
      { ok: false, message: activeLoansError.message },
      { status: 400 }
    );
  }

  const { data: cancelledLoan, error: cancelError } = await dbClient
    .from("book_loans")
    .update({ status: "cancelled" })
    .eq("id", loan.id)
    .eq("organization_id", loan.organization_id)
    .eq("borrower_id", userId)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();

  if (cancelError) {
    return NextResponse.json(
      { ok: false, message: cancelError.message },
      { status: 400 }
    );
  }
  if (!cancelledLoan) {
    return NextResponse.json(
      { ok: false, message: "이미 처리된 도서 대출 신청입니다." },
      { status: 409 }
    );
  }

  if (!activeLoans || activeLoans.length === 0) {
    const { error: bookStatusError } = await dbClient
      .from("book_items")
      .update({ status: "available" })
      .eq("id", loan.book_item_id)
      .eq("organization_id", loan.organization_id)
      .eq("status", "requested");

    if (bookStatusError) {
      const { data: restoredLoan, error: restoreError } = await dbClient
        .from("book_loans")
        .update({ status: "requested" })
        .eq("id", loan.id)
        .eq("organization_id", loan.organization_id)
        .eq("borrower_id", userId)
        .eq("status", "cancelled")
        .select("id")
        .maybeSingle();

      if (restoreError || !restoredLoan) {
        console.error("Failed to compensate book loan cancellation", {
          loanId: loan.id,
          bookItemId: loan.book_item_id,
          bookStatusError,
          restoreError,
          restored: Boolean(restoredLoan),
        });
        return NextResponse.json(
          {
            ok: false,
            message: "취소 처리 중 상태 복구에 실패했습니다. 관리자에게 문의해 주세요.",
          },
          { status: 500 }
        );
      }

      console.error("Reverted book loan cancellation after book status update failed", {
        loanId: loan.id,
        bookItemId: loan.book_item_id,
        bookStatusError,
      });
      return NextResponse.json(
        {
          ok: false,
          message: "도서 상태 변경에 실패해 취소 처리를 되돌렸습니다. 다시 시도해 주세요.",
        },
        { status: 500 }
      );
    }
  }

  return null;
};

const cancelRequestedBookLoan = async (
  authClient: SupabaseClient,
  loanId: string,
  userId: string
) => {
  const owned = await loadOwnedBookLoan(authClient, loanId, userId);
  if (!owned.loan) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "도서 대출 신청을 확인할 수 없습니다." },
      { status: 403 }
    );
  }
  if (owned.loan.status !== "requested") {
    return NextResponse.json(
      { ok: false, message: "승인 대기 중인 도서 대출 신청만 취소할 수 있습니다." },
      { status: 400 }
    );
  }

  const dbClient = getServiceClient() ?? authClient;
  const { error: atomicCancellationError } = await dbClient.rpc(
    "cancel_requested_book_loan_atomic",
    {
      target_loan_id: loanId,
      target_borrower_id: userId,
    }
  );

  if (atomicCancellationError) {
    if (!isMissingAtomicBookCancellationFunction(atomicCancellationError)) {
      console.error("Atomic book loan cancellation failed", {
        loanId,
        code: atomicCancellationError.code,
        message: atomicCancellationError.message,
      });
      return NextResponse.json(
        { ok: false, message: "도서 대출 신청 취소에 실패했습니다." },
        { status: 400 }
      );
    }

    const fallbackErrorResponse = await cancelRequestedBookLoanFallback(
      dbClient,
      owned.loan,
      userId
    );
    if (fallbackErrorResponse) {
      return fallbackErrorResponse;
    }
  }

  await dbClient.from("audit_logs").insert({
    organization_id: owned.loan.organization_id,
    actor_id: userId,
    action: "book_loan_cancelled",
    target_type: "book_loan",
    target_id: loanId,
    metadata: { book_item_id: owned.loan.book_item_id },
  });

  return NextResponse.json({ ok: true, message: "도서 대출 신청을 취소했습니다." });
};

const requestBookLoanCancellation = async (
  authClient: SupabaseClient,
  loanId: string,
  userId: string,
  cancelReason: string
) => {
  const owned = await loadOwnedBookLoan(authClient, loanId, userId);
  if (!owned.loan) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "도서 대출 신청을 확인할 수 없습니다." },
      { status: 403 }
    );
  }
  if (owned.loan.status !== "approved") {
    return NextResponse.json(
      { ok: false, message: "승인 후 대출 전 상태에서만 취소 요청을 보낼 수 있습니다." },
      { status: 400 }
    );
  }

  const dbClient = getServiceClient() ?? authClient;
  const existingRequest = await hasUnreadCancellationRequest(
    dbClient,
    owned.loan.organization_id,
    "book_loan_cancel_requested",
    { loan_id: loanId }
  );
  if (existingRequest.error) {
    return NextResponse.json(
      { ok: false, message: existingRequest.error.message },
      { status: 400 }
    );
  }
  if (existingRequest.exists) {
    return NextResponse.json({
      ok: true,
      alreadyRequested: true,
      message: "이미 취소 요청을 보냈습니다.",
    });
  }

  const { data: bookItem, error: bookError } = await dbClient
    .from("book_items")
    .select("title")
    .eq("id", owned.loan.book_item_id)
    .maybeSingle<{ title: string | null }>();
  if (bookError) {
    return NextResponse.json(
      { ok: false, message: bookError.message },
      { status: 400 }
    );
  }

  const { data: borrowerProfile } = await dbClient
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle<{ name: string | null }>();
  const { data: approvers, error: approversError } = await dbClient
    .from("profiles")
    .select("id")
    .eq("organization_id", owned.loan.organization_id)
    .in("role", ["admin", "manager"]);

  if (approversError) {
    return NextResponse.json(
      { ok: false, message: approversError.message },
      { status: 400 }
    );
  }

  const targetUserIds = Array.from(
    new Set([
      ...(approvers ?? []).map((row) => row.id as string),
      ...(owned.loan.owner_profile_id ? [owned.loan.owner_profile_id] : []),
    ])
  ).filter((targetId) => Boolean(targetId) && targetId !== userId);

  if (targetUserIds.length === 0) {
    return NextResponse.json(
      { ok: false, message: "요청을 받을 도서 관리자나 소유자가 없습니다." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const resourceName = bookItem?.title?.trim() || "도서";
  const notifications = targetUserIds.map((targetId) => ({
    organization_id: owned.loan.organization_id,
    user_id: targetId,
    type: "book_loan_cancel_requested",
    payload: {
      loan_id: loanId,
      resource_id: owned.loan.book_item_id,
      resource_type: "book",
      resource_name: resourceName,
      status: owned.loan.status,
      cancel_reason: cancelReason,
      borrower_name: borrowerProfile?.name ?? "신청자",
      start_date: owned.loan.approved_at ?? owned.loan.requested_at,
      end_date: owned.loan.due_at,
      requested_at: now,
    },
    read_at: null,
  }));

  const { error: notificationError } = await dbClient
    .from("notifications")
    .insert(notifications);
  if (notificationError) {
    return NextResponse.json(
      { ok: false, message: notificationError.message },
      { status: 400 }
    );
  }

  await dbClient.from("audit_logs").insert({
    organization_id: owned.loan.organization_id,
    actor_id: userId,
    action: "book_loan_cancel_request",
    target_type: "book_loan",
    target_id: loanId,
    metadata: {
      book_item_id: owned.loan.book_item_id,
      cancel_reason: cancelReason,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "도서 관리자에게 취소 요청을 보냈습니다.",
  });
};

export async function PATCH(request: Request) {
  const body = await parseReservationBody(request);
  const reservationId = body?.reservationId?.trim() ?? getReservationIdFromRequest(request);
  const resourceType =
    normalizeResourceType(body?.resourceType) ??
    normalizeResourceType(getResourceTypeFromRequest(request)) ??
    "asset";
  const accessToken = body?.accessToken?.trim();
  const startDate = body?.startDate?.trim();
  const endDate = body?.endDate?.trim();
  const note = body?.note ?? null;

  if (!reservationId || !accessToken || !startDate || !endDate) {
    return NextResponse.json(
      { ok: false, message: "요청 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  if (resourceType === "book") {
    return NextResponse.json(
      { ok: false, message: "도서 대출 신청은 날짜를 직접 수정할 수 없습니다." },
      { status: 400 }
    );
  }

  const config = RESERVATION_TABLE_MAP[resourceType];

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json(
      { ok: false, message: "날짜/시간 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const auth = await getAuthedClient(accessToken);
  if (!auth.client || !auth.userId) {
    return NextResponse.json(
      { ok: false, message: auth.error ?? "인증에 실패했습니다." },
      { status: 401 }
    );
  }

  const owned = await loadOwnedPendingReservation(auth.client, config, reservationId, auth.userId);
  if (!owned.reservation) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "예약 정보를 확인할 수 없습니다." },
      { status: 403 }
    );
  }

  const resourceId = owned.reservation[config.resourceColumn];
  if (!resourceId) {
    return NextResponse.json(
      { ok: false, message: "예약 리소스 정보를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  const serviceClient = getServiceClient();
  const dbClient = serviceClient ?? auth.client;

  let conflictQuery = dbClient
    .from(config.table)
    .select("id")
    .eq(config.resourceColumn, resourceId)
    .in("status", ["pending", "approved"])
    .neq("id", reservationId)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (owned.reservation.organization_id) {
    conflictQuery = conflictQuery.eq("organization_id", owned.reservation.organization_id);
  }

  const { data: conflicts, error: conflictError } = await conflictQuery;
  if (conflictError) {
    return NextResponse.json(
      { ok: false, message: conflictError.message },
      { status: 400 }
    );
  }
  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { ok: false, message: "해당 기간에 이미 예약이 존재합니다." },
      { status: 400 }
    );
  }

  const normalizedNote =
    typeof note === "string" ? (note.trim().length > 0 ? note.trim() : null) : null;

  const { data: updated, error: updateError } = await dbClient
    .from(config.table)
    .update({
      start_date: startDate,
      end_date: endDate,
      note: normalizedNote,
    })
    .eq("id", reservationId)
    .eq("borrower_id", auth.userId)
    .eq("status", "pending")
    .select("id,status,start_date,end_date,note")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: updateError.message },
      { status: 400 }
    );
  }
  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "예약 수정 권한이 없거나 이미 처리된 신청입니다." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, reservation: updated });
}

export async function DELETE(request: Request) {
  const body = await parseReservationBody(request);
  const reservationId = body?.reservationId?.trim() ?? getReservationIdFromRequest(request);
  const resourceType =
    normalizeResourceType(body?.resourceType) ??
    normalizeResourceType(getResourceTypeFromRequest(request)) ??
    "asset";
  const accessToken = body?.accessToken?.trim();

  if (!reservationId || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "요청 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const auth = await getAuthedClient(accessToken);
  if (!auth.client || !auth.userId) {
    return NextResponse.json(
      { ok: false, message: auth.error ?? "인증에 실패했습니다." },
      { status: 401 }
    );
  }

  if (resourceType === "book") {
    return cancelRequestedBookLoan(auth.client, reservationId, auth.userId);
  }

  const config = RESERVATION_TABLE_MAP[resourceType];

  const owned = await loadOwnedPendingReservation(auth.client, config, reservationId, auth.userId);
  if (!owned.reservation) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "예약 정보를 확인할 수 없습니다." },
      { status: 403 }
    );
  }

  const serviceClient = getServiceClient();
  const dbClient = serviceClient ?? auth.client;

  const { data: deletedRows, error: deleteError } = await dbClient
    .from(config.table)
    .delete()
    .eq("id", reservationId)
    .eq("borrower_id", auth.userId)
    .eq("status", "pending")
    .select("id");

  if (deleteError) {
    return NextResponse.json(
      { ok: false, message: deleteError.message },
      { status: 400 }
    );
  }
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json(
      { ok: false, message: "예약 삭제 권한이 없거나 이미 처리된 신청입니다." },
      { status: 403 }
    );
  }

  const { data: remainingRow, error: verifyError } = await dbClient
    .from(config.table)
    .select("id")
    .eq("id", reservationId)
    .maybeSingle();

  if (verifyError) {
    return NextResponse.json(
      { ok: false, message: verifyError.message },
      { status: 400 }
    );
  }

  if (remainingRow) {
    return NextResponse.json(
      { ok: false, message: "예약 삭제 확인에 실패했습니다. 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const body = await parseReservationBody(request);
  const reservationId = body?.reservationId?.trim() ?? getReservationIdFromRequest(request);
  const resourceType =
    normalizeResourceType(body?.resourceType) ??
    normalizeResourceType(getResourceTypeFromRequest(request)) ??
    "asset";
  const accessToken = body?.accessToken?.trim();
  const cancelReason = body?.cancelReason?.trim();

  if (!reservationId || !accessToken || !cancelReason) {
    return NextResponse.json(
      { ok: false, message: "요청 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  if (cancelReason.length < 5) {
    return NextResponse.json(
      { ok: false, message: "취소 사유를 5자 이상 입력해 주세요." },
      { status: 400 }
    );
  }

  const auth = await getAuthedClient(accessToken);
  if (!auth.client || !auth.userId) {
    return NextResponse.json(
      { ok: false, message: auth.error ?? "인증에 실패했습니다." },
      { status: 401 }
    );
  }

  if (resourceType === "book") {
    return requestBookLoanCancellation(
      auth.client,
      reservationId,
      auth.userId,
      cancelReason
    );
  }

  const config = RESERVATION_TABLE_MAP[resourceType];

  const owned = await loadOwnedReservation(auth.client, config, reservationId, auth.userId);
  if (!owned.reservation) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "예약 정보를 확인할 수 없습니다." },
      { status: 403 }
    );
  }
  if (owned.reservation.status !== "approved") {
    return NextResponse.json(
      { ok: false, message: "승인된 예약에서만 취소 요청을 보낼 수 있습니다." },
      { status: 400 }
    );
  }

  const resourceId = owned.reservation[config.resourceColumn];
  if (!resourceId) {
    return NextResponse.json(
      { ok: false, message: "예약 리소스 정보를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  const serviceClient = getServiceClient();
  const dbClient = serviceClient ?? auth.client;
  const resourceConfig = RESOURCE_NAME_TABLE_MAP[resourceType];

  const { data: resourceData } = await dbClient
    .from(resourceConfig.table)
    .select(resourceConfig.nameColumn)
    .eq("id", resourceId)
    .maybeSingle();
  const resourceName =
    ((resourceData as Record<string, string | null> | null)?.[resourceConfig.nameColumn] ??
      `${resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량"}`) as string;

  const { data: borrowerProfile } = await dbClient
    .from("profiles")
    .select("name")
    .eq("id", auth.userId)
    .maybeSingle<{ name: string | null }>();

  const orgId = owned.reservation.organization_id;
  if (!orgId) {
    return NextResponse.json(
      { ok: false, message: "기관 정보가 없어 취소 요청을 보낼 수 없습니다." },
      { status: 400 }
    );
  }

  const notificationType =
    resourceType === "asset"
      ? "reservation_cancel_requested"
      : resourceType === "space"
        ? "space_reservation_cancel_requested"
        : "vehicle_reservation_cancel_requested";

  const existingRequest = await hasUnreadCancellationRequest(
    dbClient,
    orgId,
    notificationType,
    { reservation_id: reservationId }
  );
  if (existingRequest.error) {
    return NextResponse.json(
      { ok: false, message: existingRequest.error.message },
      { status: 400 }
    );
  }
  if (existingRequest.exists) {
    return NextResponse.json({
      ok: true,
      alreadyRequested: true,
      message: "이미 취소 요청을 보냈습니다.",
    });
  }

  const { data: approvers, error: approversError } = await dbClient
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .in("role", ["admin", "manager"]);

  if (approversError) {
    return NextResponse.json(
      { ok: false, message: approversError.message },
      { status: 400 }
    );
  }

  const targetUserIds = (approvers ?? [])
    .map((row) => row.id as string)
    .filter((id) => Boolean(id) && id !== auth.userId);

  if (targetUserIds.length === 0) {
    return NextResponse.json(
      { ok: false, message: "요청을 받을 관리자가 없습니다." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const payloadBase = {
    reservation_id: reservationId,
    resource_id: resourceId,
    resource_type: resourceType,
    resource_name: resourceName,
    status: owned.reservation.status,
    cancel_reason: cancelReason,
    borrower_name: borrowerProfile?.name ?? "신청자",
    start_date: owned.reservation.start_date,
    end_date: owned.reservation.end_date,
    requested_at: now,
  };

  const notifications = targetUserIds.map((targetId) => ({
    organization_id: orgId,
    user_id: targetId,
    type: notificationType,
    payload: payloadBase,
    read_at: null,
  }));

  const { error: notificationError } = await dbClient
    .from("notifications")
    .insert(notifications);
  if (notificationError) {
    return NextResponse.json(
      { ok: false, message: notificationError.message },
      { status: 400 }
    );
  }

  await dbClient.from("audit_logs").insert({
    organization_id: orgId,
    actor_id: auth.userId,
    action: "reservation_cancel_request",
    target_type: "reservation",
    target_id: reservationId,
    metadata: {
      resource_type: resourceType,
      resource_id: resourceId,
      cancel_reason: cancelReason,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "관리자에게 취소 요청을 보냈습니다.",
  });
}
