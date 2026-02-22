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
  minReservationMinutes: number | null;
  maxReservationMinutes: number | null;
  reservationBufferMinutes: number;
};

const toLocalDateTimeValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export default function SpaceReservationSection({
  spaceId,
  reservations,
  spaceStatus,
  requiredRole,
  minReservationMinutes,
  maxReservationMinutes,
  reservationBufferMinutes,
}: SpaceReservationSectionProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const onRangeSelect = (start: Date, end: Date) => {
    const startHasTime = start.getHours() !== 0 || start.getMinutes() !== 0;
    const endHasTime = end.getHours() !== 0 || end.getMinutes() !== 0;

    const normalizedStart = startHasTime
      ? start
      : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0, 0, 0);
    let normalizedEnd = endHasTime
      ? end
      : new Date(end.getFullYear(), end.getMonth(), end.getDate(), 18, 0, 0, 0);

    if (normalizedEnd.getTime() <= normalizedStart.getTime()) {
      normalizedEnd = new Date(normalizedStart.getTime() + 60 * 60 * 1000);
    }

    setStartDate(toLocalDateTimeValue(normalizedStart));
    setEndDate(toLocalDateTimeValue(normalizedEnd));
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
          minReservationMinutes={minReservationMinutes}
          maxReservationMinutes={maxReservationMinutes}
          reservationBufferMinutes={reservationBufferMinutes}
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
