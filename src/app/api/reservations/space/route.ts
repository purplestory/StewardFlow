import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendReservationApprovalToBorrower,
} from "@/lib/kakao-message";

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
    .from("space_reservations")
    .select("id,status,organization_id,space_id,borrower_id,spaces(name,image_url)")
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
    .from("space_reservations")
    .update({ status })
    .eq("id", reservationId)
    .select("id,organization_id,space_id,borrower_id,spaces(name,image_url)")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 403 }
    );
  }

  if (
    reservation?.space_id &&
    (status === "approved" || status === "returned")
  ) {
    const spaceStatus = status === "approved" ? "rented" : "available";
    const { error: spaceError } = await supabase
      .from("spaces")
      .update({ status: spaceStatus })
      .eq("id", reservation.space_id);

    if (spaceError) {
      return NextResponse.json(
        { ok: false, message: spaceError.message },
        { status: 400 }
      );
    }
  }

  if (reservation?.borrower_id) {
    const space = Array.isArray(reservation.spaces) 
      ? reservation.spaces[0] 
      : reservation.spaces;
    const { error: notifyError } = await supabase.from("notifications").insert({
      user_id: reservation.borrower_id,
      organization_id: reservation.organization_id ?? null,
      type: "space_reservation_status_changed",
      channel: "kakao",
      status: "pending",
      payload: {
        reservation_id: reservationId,
        status,
        resource_id: reservation.space_id,
        resource_name: space?.name ?? null,
        resource_image_url: space?.image_url ?? null,
        resource_type: "space",
      },
    });

    if (notifyError) {
      return NextResponse.json(
        { ok: false, message: notifyError.message },
        { status: 400 }
      );
    }

    // 승인 시 카카오톡 알림 발송 (반납 기한 포함)
    if (status === "approved" && reservation) {
      try {
        // 예약 정보 조회 (start_date, end_date 필요)
        const { data: reservationDetail } = await supabase
          .from("space_reservations")
          .select("start_date,end_date,borrower_id")
          .eq("id", reservationId)
          .maybeSingle();

        if (reservationDetail) {
          // 신청자 정보 조회
          const { data: borrowerProfile } = await supabase
            .from("profiles")
            .select("phone")
            .eq("id", reservation.borrower_id)
            .maybeSingle();

          if (borrowerProfile?.phone && space?.name) {
            // 반납 기한은 end_date와 동일
            await sendReservationApprovalToBorrower(
              borrowerProfile.phone,
              space.name,
              reservationDetail.start_date,
              reservationDetail.end_date,
              reservationDetail.end_date, // 반납 기한
              "space"
            );
          }
        }
      } catch (kakaoError) {
        console.error("카카오톡 승인 알림 발송 실패:", kakaoError);
        // 알림 실패해도 승인은 계속 진행
      }
    }
  }

  const { data: actorData } = await supabase.auth.getUser();
  const actorId = actorData?.user?.id ?? null;
  if (reservation?.organization_id && actorId) {
    await supabase.from("audit_logs").insert({
      organization_id: reservation.organization_id,
      actor_id: actorId,
      action: "space_reservation_status_update",
      target_type: "space_reservation",
      target_id: reservation.id,
      metadata: {
        space_id: reservation.space_id,
        previous_status: existingReservation.status,
        next_status: status,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
