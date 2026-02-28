"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import {
  formatDateTimeRange,
  parseReservationDateRange,
} from "./reservation-manager-shared";

type Reservation = {
  id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "returned" | "rejected";
  resource_name: string;
  borrower_id: string;
};

type ViewMode = "month" | "week" | "day";

type ReservationCalendarViewProps = {
  reservations: Reservation[];
  viewMode: ViewMode;
  modeOptions?: ViewMode[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onReservationClick?: (reservation: Reservation) => void;
};

const statusColors: Record<Reservation["status"], string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  returned: "bg-neutral-100 text-neutral-800 border-neutral-300",
  rejected: "bg-rose-100 text-rose-800 border-rose-300",
};

const statusLabels: Record<Reservation["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

export default function ReservationCalendarView({
  reservations,
  viewMode,
  modeOptions,
  currentDate,
  onDateChange,
  onViewModeChange,
  onReservationClick,
}: ReservationCalendarViewProps) {
  const [hoveredReservation, setHoveredReservation] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const enabledModes = useMemo<ViewMode[]>(
    () =>
      modeOptions?.length
        ? modeOptions
        : (["month", "week", "day"] as ViewMode[]),
    [modeOptions]
  );
  const calendarModeOptions = enabledModes.map((mode) => ({
    value: mode,
    label: mode === "month" ? "월간" : mode === "week" ? "주간" : "일간",
  }));

  useEffect(() => {
    if (!enabledModes.includes(viewMode)) {
      onViewModeChange(enabledModes[0]);
    }
  }, [enabledModes, onViewModeChange, viewMode]);

  // 주간 뷰: 현재 날짜가 포함된 주의 시작일과 종료일
  const weekRange = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day); // 일요일로 이동
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // 토요일
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate]);

  const resolveReservationRange = (reservation: Reservation) => {
    const range = parseReservationDateRange(
      reservation.start_date,
      reservation.end_date
    );
    if (!range) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[ReservationCalendarView] parse failed", {
          id: reservation.id,
          start_date: reservation.start_date,
          end_date: reservation.end_date,
        });
      }
      return null;
    }
    return range;
  };

  const reservationRanges = useMemo(() => {
    return reservations
      .map((reservation) => {
      const range = resolveReservationRange(reservation);
      if (!range) {
        return null;
      }
      const start = range.start <= range.end ? range.start : range.end;
      const end = range.start <= range.end ? range.end : range.start;
      return { reservation, start, end };
    })
      .filter(
        (
          item
        ): item is {
          reservation: Reservation;
          start: Date;
          end: Date;
        } => item !== null
      );
  }, [reservations]);

  // 월간 뷰: 달력 그리드 생성
  const calendarDays = useMemo(() => {
    if (viewMode !== "month") return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 첫 날의 요일 (0=일요일)
    const firstDay = new Date(year, month, 1).getDay();
    // 마지막 날
    const lastDay = new Date(year, month + 1, 0).getDate();

    const days: Date[] = [];

    // 이전 달의 마지막 날들
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }

    // 현재 달의 날들
    for (let i = 1; i <= lastDay; i++) {
      days.push(new Date(year, month, i));
    }

    // 다음 달의 첫 날들 (총 42개 셀을 채우기 위해)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  }, [currentDate, viewMode]);

  // 주간 뷰: 주의 날짜들
  const weekDays = useMemo(() => {
    if (viewMode !== "week") return [];

    const days: Date[] = [];
    const start = new Date(weekRange.start);

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }

    return days;
  }, [viewMode, weekRange]);

  // 특정 날짜의 예약 가져오기
  const getReservationsForDate = (date: Date) => {
    return reservationRanges
      .filter(({ start, end }) => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      return start <= dayEnd && end >= dayStart;
      })
      .map(({ reservation }) => reservation);
  };

  // 날짜 포맷
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
  };

  // 이전/다음 날짜로 이동
  const navigateDate = (direction: "prev" | "next") => {
    setSelectedReservation(null);
    setPopoverPosition(null);
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    }
    onDateChange(newDate);
  };

  // 오늘로 이동
  const goToToday = () => {
    setSelectedReservation(null);
    setPopoverPosition(null);
    onDateChange(new Date());
  };

  const handleReservationClick = (
    event: ReactMouseEvent<HTMLElement>,
    reservation: Reservation
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = 170;
    const edgePadding = 12;
    const rawX = rect.left + rect.width / 2;
    const minX = edgePadding + popoverWidth / 2;
    const maxX = window.innerWidth - edgePadding - popoverWidth / 2;
    const x = Math.min(Math.max(rawX, minX), maxX);
    const belowY = rect.bottom + 8;
    const y =
      belowY + popoverHeight > window.innerHeight - edgePadding
        ? Math.max(edgePadding, rect.top - popoverHeight - 8)
        : belowY;

    setSelectedReservation(reservation);
    setPopoverPosition({
      x,
      y,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setSelectedReservation(null);
        setPopoverPosition(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedReservation(null);
        setPopoverPosition(null);
      }
    };

    const closePopover = () => {
      setSelectedReservation(null);
      setPopoverPosition(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", closePopover);
    window.addEventListener("scroll", closePopover, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", closePopover);
      window.removeEventListener("scroll", closePopover, true);
    };
  }, []);

  // 월간 뷰 렌더링
  const renderMonthView = () => {
    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-neutral-600 py-2"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            const dayReservations = getReservationsForDate(day);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] border border-neutral-200 rounded p-1 ${
                  !isCurrentMonth ? "bg-neutral-50" : "bg-white"
                } ${isToday ? "ring-2 ring-slate-500" : ""}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isCurrentMonth ? "text-neutral-900" : "text-neutral-400"
                  } ${isToday ? "text-slate-600 font-bold" : ""}`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayReservations.slice(0, 3).map((reservation) => (
                    <div
                      key={reservation.id}
                      className={`cursor-pointer overflow-hidden rounded border px-1 py-0.5 text-xs ${
                        statusColors[reservation.status]
                      } ${
                        hoveredReservation === reservation.id
                          ? "ring-2 ring-slate-500"
                          : ""
                      }`}
                      onClick={(event) => handleReservationClick(event, reservation)}
                      onMouseEnter={() => setHoveredReservation(reservation.id)}
                      onMouseLeave={() => setHoveredReservation(null)}
                      title={`${reservation.resource_name} - ${statusLabels[reservation.status]}`}
                    >
                      <div className="truncate font-medium">
                        {reservation.resource_name}
                      </div>
                      <div className="truncate text-[10px] leading-tight opacity-80">
                        {statusLabels[reservation.status]}
                      </div>
                    </div>
                  ))}
                  {dayReservations.length > 3 && (
                    <div className="text-xs text-neutral-500 px-1">
                      +{dayReservations.length - 3}개 더
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 주간 뷰 렌더링
  const renderWeekView = () => {
    const weekDayLabels = ["일", "월", "화", "수", "목", "금", "토"];

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date, index) => {
            const dayReservations = getReservationsForDate(date);

            return (
              <div key={index} className="border border-neutral-200 rounded p-2">
                <div className="text-xs font-medium text-neutral-600 mb-2">
                  {weekDayLabels[index]}
                </div>
                <div className="text-sm font-semibold text-neutral-900 mb-2">
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className={`cursor-pointer rounded border px-2 py-1 text-xs ${
                        statusColors[reservation.status]
                      } ${
                        hoveredReservation === reservation.id
                          ? "ring-2 ring-slate-500"
                          : ""
                      }`}
                      onClick={(event) => handleReservationClick(event, reservation)}
                      onMouseEnter={() => setHoveredReservation(reservation.id)}
                      onMouseLeave={() => setHoveredReservation(null)}
                    >
                      <div className="font-medium truncate">
                        {reservation.resource_name}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] opacity-80">
                        {statusLabels[reservation.status]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 일간 뷰 렌더링
  const renderDayView = () => {
    const dayReservations = getReservationsForDate(currentDate);

    return (
      <div className="space-y-2">
        <div className="border border-neutral-200 rounded p-4">
          <div className="text-lg font-semibold text-neutral-900 mb-4">
            {formatDate(currentDate)}
          </div>
          <div className="space-y-2">
            {dayReservations.length === 0 ? (
              <div className="text-sm text-neutral-500 text-center py-8">
                예약이 없습니다.
              </div>
            ) : (
              dayReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className={`cursor-pointer rounded border p-3 ${
                    statusColors[reservation.status]
                  } ${
                    hoveredReservation === reservation.id
                      ? "ring-2 ring-slate-500"
                      : ""
                  }`}
                  onClick={(event) => handleReservationClick(event, reservation)}
                  onMouseEnter={() => setHoveredReservation(reservation.id)}
                  onMouseLeave={() => setHoveredReservation(null)}
                >
                  <div className="font-medium mb-1">
                    {reservation.resource_name}
                  </div>
                  <div className="text-xs opacity-80">
                    {statusLabels[reservation.status]}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative space-y-4">
      {/* 컨트롤 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateDate("prev")}
            className="btn-ghost h-[38px] px-3"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="btn-ghost h-[38px]"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => navigateDate("next")}
            className="btn-ghost h-[38px] px-3"
          >
            →
          </button>
          <div className="text-base font-semibold text-neutral-900">
            {viewMode === "month" &&
              currentDate.toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
              })}
            {viewMode === "week" &&
              `${formatDate(weekRange.start)} ~ ${formatDate(weekRange.end)}`}
            {viewMode === "day" && formatDate(currentDate)}
          </div>
        </div>

        {calendarModeOptions.length > 1 ? (
          <StatusFilterPills
            options={calendarModeOptions}
            value={viewMode}
            onChange={(next) => onViewModeChange(next as ViewMode)}
          />
        ) : null}
      </div>

      {/* 달력 뷰 */}
      <div className="surface-card p-4">
        {viewMode === "month" && renderMonthView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "day" && renderDayView()}
      </div>

      {selectedReservation && popoverPosition && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[calc(100vw-24px)] max-w-[280px] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
          style={{
            left: popoverPosition.x,
            top: popoverPosition.y,
            transform: "translateX(-50%)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-900">
              {selectedReservation.resource_name}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColors[selectedReservation.status]}`}
            >
              {statusLabels[selectedReservation.status]}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            {formatDateTimeRange(
              selectedReservation.start_date,
              selectedReservation.end_date
            )}
          </p>
          <p className="mt-1 break-all text-xs text-neutral-500">
            신청자: {selectedReservation.borrower_id}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost h-8 px-3 text-xs"
              onClick={() => {
                setSelectedReservation(null);
                setPopoverPosition(null);
              }}
            >
              닫기
            </button>
            <button
              type="button"
              className="btn-outline h-8 px-3 text-xs"
              onClick={() => {
                onReservationClick?.(selectedReservation);
                setSelectedReservation(null);
                setPopoverPosition(null);
              }}
            >
              상세 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
