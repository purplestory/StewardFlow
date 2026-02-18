"use client";

import { useMemo, useState } from "react";
import ReservationForm from "@/components/assets/ReservationForm";
import type { SpaceReservationSummary } from "@/actions/booking-actions";
import {
  ReservationCalendarCard,
  ReservationListCard,
  ReservationRequestCard,
} from "@/components/ui/ReservationSectionBlocks";

type SpaceReservationSectionProps = {
  spaceId: string;
  reservations: SpaceReservationSummary[];
  spaceStatus: "available" | "rented" | "repair" | "lost";
  requiredRole: "admin" | "manager" | "user";
};

const toLocalDateTimeValue = (date: Date, hours: number) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${hours}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:00`;
};

export default function SpaceReservationSection({
  spaceId,
  reservations,
  spaceStatus,
  requiredRole,
}: SpaceReservationSectionProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const onRangeSelect = (start: Date, end: Date) => {
    setStartDate(toLocalDateTimeValue(start, 9));
    setEndDate(toLocalDateTimeValue(end, 18));
  };

  const existingReservations = useMemo(
    () =>
      reservations.map((reservation) => ({
        start_date: reservation.start_date,
        end_date: reservation.end_date,
        status: reservation.status,
      })),
    [reservations]
  );

  // 예약 현황 리스트 (날짜순 정렬)
  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
  }, [reservations]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <ReservationCalendarCard
          requiredRole={requiredRole}
          reservations={existingReservations}
          onRangeSelect={onRangeSelect}
        />

        <ReservationListCard resourceLabel="공간" reservations={sortedReservations} />
      </div>

      <ReservationRequestCard
        title="예약 신청"
        description="날짜 선택 후 사용 목적을 입력해 예약합니다."
      >
        <ReservationForm
          assetId={spaceId}
          resourceType="space"
          presetStartDate={startDate}
          presetEndDate={endDate}
          isDisabled={spaceStatus !== "available"}
          disabledReason={
            spaceStatus === "rented"
              ? "현재 예약 중인 공간입니다."
              : spaceStatus === "repair"
              ? "사용 불가 상태입니다."
              : spaceStatus === "lost"
              ? "사용 불가 상태입니다."
              : undefined
          }
        />
      </ReservationRequestCard>
    </div>
  );
}
