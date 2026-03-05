import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReservationStatus = "pending" | "approved" | "returned" | "rejected";
type ReservationResourceType = "asset" | "space" | "vehicle";

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

type ReservationTableConfig = (typeof RESERVATION_TABLE_MAP)[ReservationResourceType];

const RESOURCE_NAME_TABLE_MAP: Record<
  ReservationResourceType,
  { table: "assets" | "spaces" | "vehicles"; nameColumn: "name" }
> = {
  asset: { table: "assets", nameColumn: "name" },
  space: { table: "spaces", nameColumn: "name" },
  vehicle: { table: "vehicles", nameColumn: "name" },
};

const normalizeResourceType = (
  value: ReservationResourceType | string | null | undefined
): ReservationResourceType | null => {
  if (value === "asset" || value === "space" || value === "vehicle") return value;
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

export async function PATCH(request: Request) {
  const body = await parseReservationBody(request);
  const reservationId = body?.reservationId?.trim() ?? getReservationIdFromRequest(request);
  const resourceType =
    normalizeResourceType(body?.resourceType) ??
    normalizeResourceType(getResourceTypeFromRequest(request)) ??
    "asset";
  const config = RESERVATION_TABLE_MAP[resourceType];
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
  const config = RESERVATION_TABLE_MAP[resourceType];
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
  const config = RESERVATION_TABLE_MAP[resourceType];
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

  const notificationType =
    resourceType === "asset"
      ? "reservation_cancel_requested"
      : resourceType === "space"
        ? "space_reservation_cancel_requested"
        : "vehicle_reservation_cancel_requested";

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
