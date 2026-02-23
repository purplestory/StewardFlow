"use client";

import { useMemo, useState } from "react";
import ReservationForm from "@/components/assets/ReservationForm";
import type { VehicleReservationSummary } from "@/types/database";
import {
  ReservationWorkspace,
} from "@/components/ui/ReservationSectionBlocks";

type VehicleReservationSectionProps = {
  vehicleId: string;
  reservations: VehicleReservationSummary[];
  vehicleStatus: "available" | "rented" | "repair" | "lost";
  requiredRole: "admin" | "manager" | "user";
};

const toLocalDateTimeValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export default function VehicleReservationSection({
  vehicleId,
  reservations,
  vehicleStatus,
  requiredRole,
}: VehicleReservationSectionProps) {
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

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
  }, [reservations]);

  return (
    <ReservationWorkspace
      requiredRole={requiredRole}
      resourceLabel="차량"
      reservations={sortedReservations}
      calendarReservations={existingReservations}
      onRangeSelect={onRangeSelect}
      requestTitle="대여 신청"
      requestDescription="캘린더에서 시간대를 선택한 뒤, 운행 목적을 입력해 신청합니다."
      requestForm={
        <ReservationForm
          assetId={vehicleId}
          resourceType="vehicle"
          presetStartDate={startDate}
          presetEndDate={endDate}
          isDisabled={vehicleStatus !== "available"}
          disabledReason={
            vehicleStatus === "rented"
              ? "현재 예약 중인 차량입니다."
              : vehicleStatus === "repair"
              ? "사용 불가 상태입니다."
              : vehicleStatus === "lost"
              ? "사용 불가 상태입니다."
              : undefined
          }
        />
      }
    />
  );
}
