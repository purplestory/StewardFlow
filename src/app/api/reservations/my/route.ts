import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReservationStatus = "pending" | "approved" | "returned" | "rejected";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const parseReservationBody = async (request: Request) => {
  return request.json().catch(() => null) as Promise<{
    reservationId?: string;
    accessToken?: string;
    startDate?: string;
    endDate?: string;
    note?: string | null;
  } | null>;
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
  reservationId: string,
  userId: string
) => {
  const { data, error } = await client
    .from("reservations")
    .select("id,asset_id,borrower_id,organization_id,status,start_date,end_date,note")
    .eq("id", reservationId)
    .maybeSingle();
  const reservationData = data as {
    id: string;
    asset_id: string;
    borrower_id: string;
    organization_id: string | null;
    status: ReservationStatus;
    start_date: string;
    end_date: string;
    note: string | null;
  } | null;

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

export async function PATCH(request: Request) {
  const body = await parseReservationBody(request);
  const reservationId = body?.reservationId?.trim();
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

  const owned = await loadOwnedPendingReservation(auth.client, reservationId, auth.userId);
  if (!owned.reservation) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "예약 정보를 확인할 수 없습니다." },
      { status: 403 }
    );
  }

  const serviceClient = getServiceClient();
  const dbClient = serviceClient ?? auth.client;

  let conflictQuery = dbClient
    .from("reservations")
    .select("id")
    .eq("asset_id", owned.reservation.asset_id)
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
    .from("reservations")
    .update({
      start_date: startDate,
      end_date: endDate,
      note: normalizedNote,
    })
    .eq("id", reservationId)
    .eq("borrower_id", auth.userId)
    .eq("status", "pending")
    .select("id,status,asset_id,start_date,end_date,note")
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
  const reservationId = body?.reservationId?.trim();
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

  const owned = await loadOwnedPendingReservation(auth.client, reservationId, auth.userId);
  if (!owned.reservation) {
    return NextResponse.json(
      { ok: false, message: owned.error ?? "예약 정보를 확인할 수 없습니다." },
      { status: 403 }
    );
  }

  const serviceClient = getServiceClient();
  const dbClient = serviceClient ?? auth.client;

  const { data: deletedRows, error: deleteError } = await dbClient
    .from("reservations")
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

  return NextResponse.json({ ok: true });
}
