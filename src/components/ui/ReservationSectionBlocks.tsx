"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import ReservationCalendar from "@/components/assets/ReservationCalendar";
import Notice from "@/components/common/Notice";
import SectionCard from "@/components/ui/SectionCard";

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
  className?: string;
};

export function ReservationCalendarCard({
  requiredRole,
  reservations,
  onRangeSelect,
  className,
}: ReservationCalendarCardProps) {
  return (
    <SectionCard
      title="예약 캘린더"
      description="날짜를 선택하면 예약 신청 폼에 자동 반영됩니다."
      className={className}
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
  className?: string;
};

export function ReservationListCard({
  resourceLabel,
  reservations,
  className,
}: ReservationListCardProps) {
  return (
    <SectionCard
      title="예약 현황"
      description={`이 ${resourceLabel}의 예약 내역을 확인할 수 있습니다.`}
      className={className}
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
  className?: string;
};

export function ReservationRequestCard({
  children,
  title = "예약 신청",
  description = "날짜 선택 및 사유 입력 후 신청합니다.",
  className,
}: ReservationRequestCardProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      className={className}
    >
      <div className="mt-4">{children}</div>
    </SectionCard>
  );
}

type ReservationWorkspaceProps = {
  requiredRole: Role;
  resourceLabel: string;
  reservations: ReservationListItem[];
  calendarReservations: CalendarReservationItem[];
  onRangeSelect: (start: Date, end: Date) => void;
  requestForm: ReactNode;
  requestTitle?: string;
  requestDescription?: string;
};

export function ReservationWorkspace({
  requiredRole,
  resourceLabel,
  reservations,
  calendarReservations,
  onRangeSelect,
  requestForm,
  requestTitle = "예약 신청",
  requestDescription = "캘린더에서 시간대를 선택하면 자동으로 입력됩니다.",
}: ReservationWorkspaceProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-neutral-200 bg-gradient-to-r from-white to-slate-50/70 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">예약 워크스페이스</h2>
            <p className="text-sm text-neutral-600">
              기본은 직접 입력 모드이며, 필요할 때만 캘린더를 열어 빠르게 시간대를 선택하세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="chip-muted">승인 필요 권한: {roleLabel[requiredRole]}</p>
            <button
              type="button"
              onClick={() => setShowCalendar((prev) => !prev)}
              className="btn-ghost h-9 px-3 text-xs"
            >
              {showCalendar ? "캘린더 숨기기" : "캘린더 보기"}
            </button>
          </div>
        </div>
      </header>

      <div className={showCalendar ? "grid 2xl:grid-cols-[minmax(0,1.2fr)_minmax(540px,1fr)]" : "grid"}>
        {showCalendar ? (
          <div className="border-b border-neutral-200 p-4 md:p-6 2xl:border-b-0 2xl:border-r">
            <ReservationCalendar
              reservations={calendarReservations}
              onRangeSelect={onRangeSelect}
              disabledStatuses={["pending", "approved"]}
            />
          </div>
        ) : null}

        <aside className="space-y-4 bg-gradient-to-b from-slate-50/80 to-white p-4 md:p-6">
          <section className="rounded-2xl border border-neutral-200 bg-white">
            <header className="border-b border-neutral-200 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">예약 현황</h3>
              <p className="mt-0.5 text-xs text-neutral-600">
                이 {resourceLabel}의 예약 내역을 시간순으로 표시합니다.
              </p>
            </header>
            <div className="max-h-[280px] space-y-2 overflow-y-auto p-3">
              {reservations.length === 0 ? (
                <Notice className="py-6 text-sm">예약 내역이 없습니다.</Notice>
              ) : (
                reservations.map((reservation) => (
                  <article
                    key={reservation.id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
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
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass[reservation.status]}`}
                      >
                        {statusLabel[reservation.status]}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white">
            <header className="border-b border-neutral-200 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">{requestTitle}</h3>
              <p className="mt-0.5 text-xs text-neutral-600">{requestDescription}</p>
            </header>
            <div className="p-3 md:p-4">{requestForm}</div>
          </section>
        </aside>
      </div>
    </section>
  );
}
