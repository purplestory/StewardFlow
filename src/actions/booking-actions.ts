"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isUUID } from "@/lib/short-id";
import type { Reservation, VehicleReservationSummary } from "@/types/database";
import {
  sendReservationRequestToAdmin,
  sendReservationRequestToBorrower,
} from "@/lib/kakao-message";

type ReservationActionState = {
  ok: boolean;
  message: string;
};

const createNotification = async (params: {
  userId: string;
  organizationId: string | null;
  type: string;
  payload: Record<string, unknown>;
}) => {
  const supabase = await createSupabaseServerClient();
  await supabase.from("notifications").insert({
    user_id: params.userId,
    organization_id: params.organizationId,
    type: params.type,
    channel: "kakao",
    status: "pending",
    payload: params.payload,
  });
};

export async function createReservation(
  _prevState: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const assetId = formData.get("asset_id")?.toString();
  const spaceId = formData.get("space_id")?.toString();
  const vehicleId = formData.get("vehicle_id")?.toString();
  const resourceType = formData.get("resource_type")?.toString() ?? "asset";
  const startDate = formData.get("start_date")?.toString();
  const endDate = formData.get("end_date")?.toString();
  const note = formData.get("note")?.toString() || null;

  // 반복 일정 설정 파싱
  const recurrenceType = (formData.get("recurrence_type")?.toString() || "none") as "none" | "weekly" | "monthly";
  const recurrenceInterval = parseInt(formData.get("recurrence_interval")?.toString() || "1");
  const recurrenceEndDate = formData.get("recurrence_end_date")?.toString() || null;
  const recurrenceDaysOfWeekStr = formData.get("recurrence_days_of_week")?.toString();
  const recurrenceDaysOfWeek = recurrenceDaysOfWeekStr ? JSON.parse(recurrenceDaysOfWeekStr) : null;
  const recurrenceDayOfMonth = formData.get("recurrence_day_of_month")?.toString()
    ? parseInt(formData.get("recurrence_day_of_month")!.toString())
    : null;

  const actualResourceId = resourceType === "space" ? spaceId : resourceType === "vehicle" ? vehicleId : assetId;
  
  if (!actualResourceId || !startDate || !endDate) {
    return { ok: false, message: "필수 정보를 모두 입력해주세요." };
  }

  // TypeScript 타입 가드: actualResourceId가 string임을 보장
  const resourceId: string = actualResourceId;

  const supabase = await createSupabaseServerClient();
  
  // 세션에서 사용자 ID 가져오기 (borrower_id는 hidden input에서 전달되지만, 세션에서도 확인)
  const { data: sessionData } = await supabase.auth.getSession();
  const borrowerId = formData.get("borrower_id")?.toString() || sessionData.session?.user?.id;
  
  if (!borrowerId) {
    return { ok: false, message: "로그인이 필요합니다." };
  }
  
  // 자원의 organization_id를 사용 (자원이 속한 기관에 예약 생성)
  let organizationId: string | null = null;
  let resourceName: string | null = null;
  let resourceImageUrl: string | null = null;
  let actualResourceUuid: string | null = null; // 실제 UUID 저장

  if (resourceType === "space") {
    const isUuid = isUUID(resourceId);
    let spaceQuery = supabase
      .from("spaces")
      .select("id,name,image_url,organization_id");
    
    if (isUuid) {
      spaceQuery = spaceQuery.eq("id", resourceId);
    } else {
      spaceQuery = spaceQuery.eq("short_id", resourceId);
    }
    
    const { data } = await spaceQuery.maybeSingle();
    resourceName = data?.name ?? null;
    resourceImageUrl = data?.image_url ?? null;
    organizationId = data?.organization_id ?? null;
    actualResourceUuid = data?.id ?? null;
  } else if (resourceType === "vehicle") {
    // vehicle ID가 UUID인지 short_id인지 확인
    const isUuid = isUUID(resourceId);
    let vehicleQuery = supabase
      .from("vehicles")
      .select("id,name,image_url,status,organization_id");
    
    if (isUuid) {
      vehicleQuery = vehicleQuery.eq("id", resourceId);
    } else {
      vehicleQuery = vehicleQuery.eq("short_id", resourceId);
    }
    
    const { data } = await vehicleQuery.maybeSingle();
    resourceName = data?.name ?? null;
    resourceImageUrl = data?.image_url ?? null;
    organizationId = data?.organization_id ?? null;
    actualResourceUuid = data?.id ?? null;
    
    if (data?.status && data.status !== "available") {
      return { ok: false, message: "현재 예약할 수 없는 상태입니다." };
    }
  } else {
    const isUuid = isUUID(resourceId);
    let assetQuery = supabase
      .from("assets")
      .select("id,name,image_url,status,loanable,usable_until,organization_id");
    
    if (isUuid) {
      assetQuery = assetQuery.eq("id", resourceId);
    } else {
      assetQuery = assetQuery.eq("short_id", resourceId);
    }
    
    const { data } = await assetQuery.maybeSingle();
    resourceName = data?.name ?? null;
    resourceImageUrl = data?.image_url ?? null;
    organizationId = data?.organization_id ?? null;
    actualResourceUuid = data?.id ?? null;

    if (data?.loanable === false) {
      return { ok: false, message: "대여 불가로 설정된 자산입니다." };
    }
    if (data?.status && data.status !== "available") {
      return { ok: false, message: "현재 대여할 수 없는 상태입니다." };
    }
    if (data?.usable_until && isBeyondUsableUntil(data.usable_until, endDate)) {
      return { ok: false, message: "사용 기한이 만료된 자산입니다." };
    }
  }

  // organization_id가 없으면 에러 반환
  if (!organizationId) {
    return { ok: false, message: "자원의 기관 정보를 확인할 수 없습니다." };
  }

  // 사용자의 organization_id와 자원의 organization_id가 일치하는지 확인
  const { data: profileData } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", borrowerId)
    .maybeSingle();

  if (profileData?.organization_id !== organizationId) {
    return { ok: false, message: "같은 기관 내에서만 예약할 수 있습니다." };
  }

  if (new Date(startDate) > new Date(endDate)) {
    return { ok: false, message: "종료일은 시작일 이후여야 합니다." };
  }

  const reservationTable =
    resourceType === "space" ? "space_reservations" 
    : resourceType === "vehicle" ? "vehicle_reservations"
    : "reservations";
  const resourceColumn = 
    resourceType === "space" ? "space_id" 
    : resourceType === "vehicle" ? "vehicle_id"
    : "asset_id";
  // 실제 UUID 사용 (short_id가 전달된 경우 조회한 UUID 사용)
  const finalResourceId = actualResourceUuid || resourceId;
  
  // 차량 대여 시 초기 주행거리 파싱
  const startOdometerReading = resourceType === "vehicle" 
    ? (formData.get("start_odometer_reading")?.toString() 
        ? Number(formData.get("start_odometer_reading")!.toString()) 
        : null)
    : null;

  const { data: conflicts, error: conflictError } = await supabase
    .from(reservationTable)
    .select("id")
    .eq(resourceColumn, finalResourceId)
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (conflictError) {
    return { ok: false, message: conflictError.message };
  }

  // 반복 일정 생성
  if (recurrenceType !== "none" && recurrenceEndDate) {
    const { generateRecurringDates } = await import("@/lib/recurrence");
    const instances = generateRecurringDates(startDate, endDate, {
      type: recurrenceType,
      interval: recurrenceInterval,
      endDate: recurrenceEndDate,
      daysOfWeek: recurrenceDaysOfWeek,
      dayOfMonth: recurrenceDayOfMonth || undefined,
    });

    // 모든 인스턴스에 대해 충돌 검사
    for (const instance of instances) {
      const instanceStart = instance.start.toISOString();
      const instanceEnd = instance.end.toISOString();

      const { data: instanceConflicts, error: instanceConflictError } = await supabase
        .from(reservationTable)
        .select("id")
        .eq(resourceColumn, finalResourceId)
        .in("status", ["pending", "approved"])
        .lte("start_date", instanceEnd)
        .gte("end_date", instanceStart);

      if (instanceConflictError) {
        return { ok: false, message: instanceConflictError.message };
      }

      if (instanceConflicts && instanceConflicts.length > 0) {
        return {
          ok: false,
          message: `${instance.start.toLocaleDateString("ko-KR")}에 이미 예약이 존재합니다.`,
        };
      }
    }

    // 모든 인스턴스 생성
    // 먼저 첫 번째 예약(부모)을 생성
    const firstReservationData: Record<string, unknown> = {
      organization_id: organizationId,
      [resourceColumn]: finalResourceId,
      borrower_id: borrowerId,
      start_date: instances[0].start.toISOString(),
      end_date: instances[0].end.toISOString(),
      note,
      recurrence_type: recurrenceType,
      recurrence_interval: recurrenceInterval,
      recurrence_end_date: recurrenceEndDate,
      recurrence_days_of_week: recurrenceDaysOfWeek,
      recurrence_day_of_month: recurrenceDayOfMonth,
      parent_reservation_id: null,
      is_recurring_instance: false,
    };
    
    // 차량인 경우 초기 주행거리 추가
    if (resourceType === "vehicle" && startOdometerReading !== null) {
      firstReservationData.start_odometer_reading = startOdometerReading;
    }

    const { data: firstReservation, error: firstInsertError } = await supabase
      .from(reservationTable)
      .insert(firstReservationData)
      .select("id")
      .single();

    if (firstInsertError) {
      return { ok: false, message: firstInsertError.message };
    }

    // 나머지 인스턴스들 생성
    if (instances.length > 1 && firstReservation) {
      const remainingReservations = instances.slice(1).map((instance) => {
        const reservation: Record<string, unknown> = {
          organization_id: organizationId,
          [resourceColumn]: finalResourceId,
          borrower_id: borrowerId,
          start_date: instance.start.toISOString(),
          end_date: instance.end.toISOString(),
          note,
          recurrence_type: recurrenceType,
          recurrence_interval: recurrenceInterval,
          recurrence_end_date: recurrenceEndDate,
          recurrence_days_of_week: recurrenceDaysOfWeek,
          recurrence_day_of_month: recurrenceDayOfMonth,
          parent_reservation_id: firstReservation.id,
          is_recurring_instance: true,
        };
        
        // 차량인 경우 초기 주행거리 추가
        if (resourceType === "vehicle" && startOdometerReading !== null) {
          reservation.start_odometer_reading = startOdometerReading;
        }
        
        return reservation;
      });

      const { error: remainingInsertError } = await supabase
        .from(reservationTable)
        .insert(remainingReservations);

      if (remainingInsertError) {
        return { ok: false, message: remainingInsertError.message };
      }
    }

    await createNotification({
      userId: borrowerId,
      organizationId,
      type:
        resourceType === "space"
          ? "space_reservation_created"
          : "reservation_created",
      payload: {
        resource_id: assetId,
        resource_name: resourceName,
        resource_image_url: resourceImageUrl,
        start_date: startDate,
        end_date: endDate,
        recurrence_type: recurrenceType,
        instance_count: instances.length,
      },
    });

    return {
      ok: true,
      message: `${instances.length}개의 반복 일정이 생성되었습니다.`,
    };
  }

  // 단일 예약 생성 (기존 로직)
  if (conflicts && conflicts.length > 0) {
    return { ok: false, message: "해당 기간에 이미 예약이 존재합니다." };
  }

  const reservationData: Record<string, unknown> = {
    organization_id: organizationId,
    [resourceColumn]: finalResourceId,
    borrower_id: borrowerId,
    start_date: startDate,
    end_date: endDate,
    note,
    recurrence_type: "none",
  };
  
  // 차량인 경우 초기 주행거리 추가
  if (resourceType === "vehicle" && startOdometerReading !== null) {
    reservationData.start_odometer_reading = startOdometerReading;
  }

  const { error: insertError } = await supabase.from(reservationTable).insert(reservationData);

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  // 알림 생성
  await createNotification({
    userId: borrowerId,
    organizationId,
    type:
      resourceType === "space"
        ? "space_reservation_created"
        : resourceType === "vehicle"
        ? "vehicle_reservation_created"
        : "reservation_created",
    payload: {
      resource_id: resourceId,
      resource_name: resourceName,
      resource_image_url: resourceImageUrl,
      start_date: startDate,
      end_date: endDate,
    },
  });

  // 카카오톡 알림 발송 (비동기, 실패해도 예약은 완료)
  try {
    // 신청자 정보 조회
    const { data: borrowerProfile } = await supabase
      .from("profiles")
      .select("name,department,phone")
      .eq("id", borrowerId)
      .maybeSingle();

    if (borrowerProfile?.phone && resourceName) {
      // 신청자에게 알림
      await sendReservationRequestToBorrower(
        borrowerProfile.phone,
        resourceName,
        startDate,
        endDate,
        resourceType
      );

      // 관리자에게 알림 (승인 정책에 따라 결정)
      if (organizationId) {
        // 승인 정책 확인
        const { data: policies } = await supabase
          .from("approval_policies")
          .select("required_role,department")
          .eq("organization_id", organizationId)
          .eq("scope", resourceType === "asset" ? "asset" : resourceType === "space" ? "space" : "vehicle");

        // 관리자 목록 조회 (admin 또는 manager)
        const requiredRoles = policies?.map(p => p.required_role) || ["admin"];
        const { data: admins } = await supabase
          .from("profiles")
          .select("phone,name")
          .eq("organization_id", organizationId)
          .in("role", requiredRoles);

        // 관리자들에게 알림 발송
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            if (admin.phone) {
              await sendReservationRequestToAdmin(
                admin.phone,
                resourceName,
                borrowerProfile.name || "이름 없음",
                borrowerProfile.department,
                startDate,
                endDate,
                resourceType
              );
            }
          }
        }
      }
    }
  } catch (kakaoError) {
    // 카카오톡 발송 실패는 로그만 남기고 예약은 계속 진행
    console.error("카카오톡 알림 발송 실패:", kakaoError);
  }

  return { ok: true, message: "대여 신청이 접수되었습니다." };
}

export async function listReservations(): Promise<Reservation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Reservation[];
}

export type ReservationSummary = {
  id: string;
  status: Reservation["status"];
  start_date: string;
  end_date: string;
  note: string | null;
  asset: { name: string } | null;
};

export async function listReservationsByBorrower(
  borrowerId: string
): Promise<ReservationSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id,status,start_date,end_date,note,assets(name)")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    note: row.note,
    asset: row.assets && !Array.isArray(row.assets) ? { name: row.assets.name } : null,
  }));
}

export type AssetReservationSummary = {
  id: string;
  status: Reservation["status"];
  start_date: string;
  end_date: string;
  borrower_id: string;
  note: string | null;
  borrower?: {
    id: string;
    name: string | null;
    department: string | null;
  } | null;
};

export async function listReservationsByAsset(
  assetId: string
): Promise<AssetReservationSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id,status,start_date,end_date,borrower_id,note,profiles!borrower_id(id,name,department)")
    .eq("asset_id", assetId)
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      borrower_id: row.borrower_id,
      note: row.note,
      borrower: profile ? {
        id: profile.id,
        name: profile.name,
        department: profile.department,
      } : null,
    };
  }) as AssetReservationSummary[];
}

export type SpaceReservationSummary = {
  id: string;
  status: Reservation["status"];
  start_date: string;
  end_date: string;
  borrower_id: string;
  note: string | null;
  borrower?: {
    id: string;
    name: string | null;
    department: string | null;
  } | null;
};

export async function listReservationsBySpace(
  spaceId: string
): Promise<SpaceReservationSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("space_reservations")
    .select("id,status,start_date,end_date,borrower_id,note,profiles!borrower_id(id,name,department)")
    .eq("space_id", spaceId)
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      borrower_id: row.borrower_id,
      note: row.note,
      borrower: profile ? {
        id: profile.id,
        name: profile.name,
        department: profile.department,
      } : null,
    };
  }) as SpaceReservationSummary[];
}

export async function listReservationsByVehicle(
  vehicleId: string
): Promise<VehicleReservationSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vehicle_reservations")
    .select("id,status,start_date,end_date,borrower_id,note,profiles!borrower_id(id,name,department)")
    .eq("vehicle_id", vehicleId)
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      borrower_id: row.borrower_id,
      note: row.note,
      borrower: profile ? {
        id: profile.id,
        name: profile.name,
        department: profile.department,
      } : null,
    };
  }) as VehicleReservationSummary[];
}

const isBeyondUsableUntil = (usableUntil: string, endDate: string) => {
  const end = new Date(endDate);
  const limit = new Date(usableUntil);
  if (Number.isNaN(end.getTime()) || Number.isNaN(limit.getTime())) {
    return false;
  }
  limit.setHours(23, 59, 59, 999);
  return end.getTime() > limit.getTime();
};
