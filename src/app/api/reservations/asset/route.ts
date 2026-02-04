import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function PATCH(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경 변수가 없습니다." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const reservationId = body?.reservationId as string | undefined;
  const status = body?.status as
    | "pending"
    | "approved"
    | "returned"
    | "rejected"
    | undefined;
  const accessToken = body?.accessToken as string | undefined;

  if (!reservationId || !status || !accessToken) {
    return NextResponse.json(
      { ok: false, message: "요청 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: existingReservation, error: existingError } = await supabase
    .from("reservations")
    .select("id,status,organization_id,asset_id,borrower_id,assets(name,image_url)")
    .eq("id", reservationId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { ok: false, message: existingError.message },
      { status: 403 }
    );
  }

  if (!existingReservation) {
    return NextResponse.json(
      { ok: false, message: "예약 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { data: reservation, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", reservationId)
    .select("id,organization_id,asset_id,borrower_id,assets(name,image_url)")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 403 }
    );
  }

  if (
    reservation?.asset_id &&
    (status === "approved" || status === "returned")
  ) {
    const assetStatus = status === "approved" ? "rented" : "available";
    const assetUpdate =
      status === "approved"
        ? { status: assetStatus, last_used_at: new Date().toISOString() }
        : { status: assetStatus };
    const { error: assetError } = await supabase
      .from("assets")
      .update(assetUpdate)
      .eq("id", reservation.asset_id);

    if (assetError) {
      return NextResponse.json(
        { ok: false, message: assetError.message },
        { status: 400 }
      );
    }
  }

  if (reservation?.borrower_id) {
    const { error: notifyError } = await supabase.from("notifications").insert({
      user_id: reservation.borrower_id,
      organization_id: reservation.organization_id ?? null,
      type: "reservation_status_changed",
      channel: "kakao",
      status: "pending",
      payload: {
        reservation_id: reservationId,
        status,
        resource_id: reservation.asset_id,
        resource_name: reservation.assets?.name ?? null,
        resource_image_url: reservation.assets?.image_url ?? null,
        resource_type: "asset",
      },
    });

    if (notifyError) {
      return NextResponse.json(
        { ok: false, message: notifyError.message },
        { status: 400 }
      );
    }
  }

  const { data: actorData } = await supabase.auth.getUser();
  const actorId = actorData?.user?.id ?? null;
  if (reservation?.organization_id && actorId) {
    await supabase.from("audit_logs").insert({
      organization_id: reservation.organization_id,
      actor_id: actorId,
      action: "asset_reservation_status_update",
      target_type: "reservation",
      target_id: reservation.id,
      metadata: {
        asset_id: reservation.asset_id,
        previous_status: existingReservation.status,
        next_status: status,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
