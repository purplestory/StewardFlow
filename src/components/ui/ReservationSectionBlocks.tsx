"use client";

import type { ReactNode } from "react";
import ReservationCalendar from "@/components/assets/ReservationCalendar";
import SectionCard from "@/components/ui/SectionCard";
import Notice from "@/components/common/Notice";

type ReservationStatus = "pending" | "approved" | "returned" | "rejected";

type ReservationBorrower = {
  department: string | null;
  name: string | null;
} | null | undefined;

type ReservationListItem = {
  id: string;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  borrower?: ReservationBorrower;
};

type CalendarReservationItem = {
  start_date: string;
  end_date: string;
  status: ReservationStatus;
};

type Role = "admin" | "manager" | "user";

const roleLabel: Record<Role, string> = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};

const statusBadgeClass: Record<ReservationStatus, string> = {
  pending: "border border-amber-200 bg-amber-100 text-amber-700",
  approved: "border border-emerald-200 bg-emerald-100 text-emerald-700",
  returned: "border border-neutral-200 bg-neutral-100 text-neutral-700",
  rejected: "border border-rose-200 bg-rose-100 text-rose-700",
};

const statusLabel: Record<ReservationStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

function formatDateRange(start: string, end: string) {
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
}

type ReservationCalendarCardProps = {
  requiredRole: Role;
  reservations: CalendarReservationItem[];
  onRangeSelect: (start: Date, end: Date) => void;
};

export function ReservationCalendarCard({
  requiredRole,
  reservations,
  onRangeSelect,
}: ReservationCalendarCardProps) {
  return (
    <SectionCard
      title="예약 캘린더"
      description="날짜를 선택하면 예약 신청 폼에 자동 반영됩니다."
    >
      <p className="chip-muted mt-1">
        승인 필요 권한: {roleLabel[requiredRole]}
      </p>
      <div className="mt-4">
        <ReservationCalendar
          reservations={reservations}
          onRangeSelect={onRangeSelect}
          disabledStatuses={["pending", "approved"]}
        />
      </div>
    </SectionCard>
  );
}

type ReservationListCardProps = {
  resourceLabel: string;
  reservations: ReservationListItem[];
};

export function ReservationListCard({
  resourceLabel,
  reservations,
}: ReservationListCardProps) {
  return (
    <SectionCard
      title="예약 현황"
      description={`이 ${resourceLabel}의 예약 내역을 확인할 수 있습니다.`}
    >
      <div className="mt-4 max-h-[500px] space-y-2 overflow-y-auto">
        {reservations.length === 0 ? (
          <Notice className="py-8">예약 내역이 없습니다.</Notice>
        ) : (
          reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {formatDateRange(reservation.start_date, reservation.end_date)}
                  </p>
                  {reservation.borrower?.department ? (
                    <p className="mt-1 text-xs text-neutral-600">
                      신청 부서: {reservation.borrower.department}
                    </p>
                  ) : null}
                  {reservation.borrower?.name ? (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      신청자: {reservation.borrower.name}
                    </p>
                  ) : null}
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
    </SectionCard>
  );
}

type ReservationRequestCardProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

export function ReservationRequestCard({
  children,
  title = "예약 신청",
  description = "날짜 선택 및 사유 입력 후 신청합니다.",
}: ReservationRequestCardProps) {
  return (
    <SectionCard
      title={title}
      description={description}
    >
      <div className="mt-4">{children}</div>
    </SectionCard>
  );
}
