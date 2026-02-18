"use client";

import { useMemo, useState } from "react";
import ReservationForm from "@/components/assets/ReservationForm";
import type { AssetReservationSummary } from "@/actions/booking-actions";
import {
  ReservationCalendarCard,
  ReservationListCard,
  ReservationRequestCard,
} from "@/components/ui/ReservationSectionBlocks";

type AssetReservationSectionProps = {
  assetId: string;
  reservations: AssetReservationSummary[];
  assetStatus: "available" | "rented" | "repair" | "lost" | "retired";
  requiredRole: "admin" | "manager" | "user";
  isLoanable?: boolean | null;
  usableUntil?: string | null;
};

const toLocalDateTimeValue = (date: Date, hours: number) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${hours}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:00`;
};

export default function AssetReservationSection({
  assetId,
  reservations,
  assetStatus,
  requiredRole,
  isLoanable,
  usableUntil,
}: AssetReservationSectionProps) {
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

  const isExpired = usableUntil ? isDateExpired(usableUntil) : false;
  const isDisabled =
    isLoanable === false || isExpired || assetStatus !== "available";
  const disabledReason =
    isLoanable === false
      ? "대여 불가로 설정된 자산입니다."
      : isExpired
      ? "사용 기한이 만료된 자산입니다."
      : assetStatus === "retired"
      ? "불용품으로 전환된 자산입니다."
      : assetStatus === "rented"
      ? "현재 대여 중인 자산입니다."
      : assetStatus === "repair"
      ? "수리 중인 자산입니다."
      : assetStatus === "lost"
      ? "분실 처리된 자산입니다."
      : undefined;

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

        <ReservationListCard resourceLabel="물품" reservations={sortedReservations} />
      </div>

      <ReservationRequestCard>
        <ReservationForm
          assetId={assetId}
          presetStartDate={startDate}
          presetEndDate={endDate}
          isDisabled={isDisabled}
          disabledReason={disabledReason}
        />
      </ReservationRequestCard>
    </div>
  );
}

const isDateExpired = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};
