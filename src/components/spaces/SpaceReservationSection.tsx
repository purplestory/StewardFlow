"use client";

import { useMemo, useState } from "react";
import ReservationCalendar from "@/components/assets/ReservationCalendar";
import ReservationForm from "@/components/assets/ReservationForm";
import type { SpaceReservationSummary } from "@/actions/booking-actions";

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

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
    const endStr = endDate.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
    const startTime = startDate.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const endTime = endDate.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    
    if (startStr === endStr) {
      return `${startStr} ${startTime} - ${endTime}`;
    }
    return `${startStr} ${startTime} - ${endStr} ${endTime}`;
  };

  const statusBadgeClass: Record<SpaceReservationSummary["status"], string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    returned: "bg-neutral-100 text-neutral-700",
    rejected: "bg-rose-100 text-rose-700",
  };

  const statusLabel: Record<SpaceReservationSummary["status"], string> = {
    pending: "승인 대기",
    approved: "승인됨",
    returned: "반납 완료",
    rejected: "반려",
  };

  return (
    <div className="space-y-6">
      {/* 예약 캘린더와 예약 현황 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* 예약 캘린더 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">예약 캘린더</h2>
          <p className="mt-2 text-sm text-neutral-600">
            날짜를 선택하면 예약 신청 폼에 자동 반영됩니다.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            승인 필요 권한: {roleLabel[requiredRole]}
          </p>
          <div className="mt-4">
            <ReservationCalendar
              reservations={existingReservations}
              onRangeSelect={onRangeSelect}
              disabledStatuses={["pending", "approved"]}
            />
          </div>
        </div>

        {/* 예약 현황 리스트 */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">예약 현황</h2>
          <p className="mt-2 text-sm text-neutral-600">
            이 공간의 예약 내역을 확인할 수 있습니다.
          </p>
          <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
            {sortedReservations.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-8">
                예약 내역이 없습니다.
              </p>
            ) : (
              sortedReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">
                        {formatDateRange(reservation.start_date, reservation.end_date)}
                      </p>
                      {reservation.borrower?.department && (
                        <p className="mt-1 text-xs text-neutral-600">
                          신청 부서: {reservation.borrower.department}
                        </p>
                      )}
                      {reservation.borrower?.name && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          신청자: {reservation.borrower.name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass[reservation.status]}`}
                    >
                      {statusLabel[reservation.status]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 예약 신청 폼 */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">예약 신청</h2>
        <p className="mt-2 text-sm text-neutral-600">
          날짜 선택 및 사유 입력 후 신청합니다.
        </p>
        <div className="mt-4">
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
        </div>
      </div>
    </div>
  );
}

const roleLabel: Record<"admin" | "manager" | "user", string> = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};
