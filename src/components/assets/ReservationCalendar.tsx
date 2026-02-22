"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getCurrentYearHolidays, type Holiday } from "@/lib/korean-holidays";

type ReservationItem = {
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "returned" | "rejected";
};

type ReservationCalendarProps = {
  reservations: ReservationItem[];
  onRangeSelect?: (start: Date, end: Date) => void;
  disabledStatuses?: ReservationItem["status"][];
};

type ViewMode = "month" | "week" | "day";
type DayFilter = "all" | "saturday" | "sunday" | "weekend";

const statusClassName: Record<ReservationItem["status"], string> = {
  pending: "calendar-pending",
  approved: "calendar-approved",
  returned: "calendar-returned",
  rejected: "calendar-rejected",
};

const statusLabel: Record<ReservationItem["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

const dayFilterLabel: Record<DayFilter, string> = {
  all: "전체 요일",
  saturday: "토요일만",
  sunday: "주일만",
  weekend: "주말(토·주일)",
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const isWithinRange = (day: Date, start: Date, end: Date) => {
  const target = startOfDay(day).getTime();
  const startTime = startOfDay(start).getTime();
  const endTime = startOfDay(end).getTime();
  return target >= startTime && target <= endTime;
};

const isOverlap = (
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
) => aStart < bEnd && aEnd > bStart;

const dayMatchesFilter = (date: Date, filter: DayFilter) => {
  const day = date.getDay();
  if (filter === "all") return true;
  if (filter === "saturday") return day === 6;
  if (filter === "sunday") return day === 0;
  return day === 6 || day === 0;
};

const withTime = (date: Date, hours: number, minutes = 0) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

const formatDateTimeRange = (start: Date, end: Date) => {
  const startText = start.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endText = end.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${startText} - ${endText}`;
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export default function ReservationCalendar({
  reservations,
  onRangeSelect,
  disabledStatuses = ["pending", "approved"],
}: ReservationCalendarProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const holidayData = await getCurrentYearHolidays();
        setHolidays(holidayData);
      } catch (error) {
        console.error("공휴일 로드 오류:", error);
      }
    };
    loadHolidays();
  }, []);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    []
  );

  const normalized = useMemo(
    () =>
      reservations.map((reservation) => ({
        ...reservation,
        start: new Date(reservation.start_date),
        end: new Date(reservation.end_date),
      })),
    [reservations]
  );

  const weekStart = useMemo(() => {
    const day = focusDate.getDay();
    return addDays(focusDate, -day);
  }, [focusDate]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const visibleWeekDays = useMemo(
    () => weekDays.filter((date) => dayMatchesFilter(date, dayFilter)),
    [dayFilter, weekDays]
  );

  const weekReservationsMap = useMemo(() => {
    if (viewMode !== "week") return [];
    return visibleWeekDays.map((date) => ({
      date,
      reservations: normalized.filter((reservation) =>
        isWithinRange(date, reservation.start, reservation.end)
      ),
    }));
  }, [normalized, viewMode, visibleWeekDays]);

  const dayReservations = useMemo(() => {
    if (viewMode !== "day") return [];
    return normalized.filter((reservation) =>
      isWithinRange(focusDate, reservation.start, reservation.end)
    );
  }, [focusDate, normalized, viewMode]);

  const dayQuickSlots = useMemo(() => {
    if (viewMode !== "day") return [];
    return Array.from({ length: 15 }, (_, index) => {
      const start = withTime(focusDate, 7 + index, 0);
      const end = withTime(focusDate, 8 + index, 0);
      const overlaps = normalized.filter((reservation) =>
        isOverlap(start, end, reservation.start, reservation.end)
      );
      const blocked = overlaps.some((reservation) =>
        disabledStatuses.includes(reservation.status)
      );

      return {
        start,
        end,
        blocked,
        overlaps,
      };
    });
  }, [disabledStatuses, focusDate, normalized, viewMode]);

  const repeatedWeekdayList = useMemo(() => {
    if (dayFilter === "all") return [];
    const first = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
    const last = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
    const dates: Date[] = [];
    for (let cursor = new Date(first); cursor <= last; cursor = addDays(cursor, 1)) {
      if (dayMatchesFilter(cursor, dayFilter)) {
        dates.push(startOfDay(cursor));
      }
    }
    return dates.map((date) => ({
      date,
      reservations: normalized.filter((reservation) =>
        isWithinRange(date, reservation.start, reservation.end)
      ),
    }));
  }, [dayFilter, focusDate, normalized]);

  const scheduleLongPress = (start: Date, end: Date) => {
    if (!onRangeSelect) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      onRangeSelect(start, end);
    }, 450);
  };

  const cancelLongPress = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const movePeriod = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setFocusDate((prev) => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
        return startOfDay(next);
      });
      return;
    }

    if (viewMode === "week") {
      setFocusDate((prev) => startOfDay(addDays(prev, direction === "next" ? 7 : -7)));
      return;
    }

    setFocusDate((prev) => startOfDay(addDays(prev, direction === "next" ? 1 : -1)));
  };

  const goToday = () => setFocusDate(startOfDay(new Date()));

  // 요일 포맷: '일' 대신 '주일'로 표시
  const formatShortWeekday = (_locale: string | undefined, date: Date) => {
    const day = date.getDay();
    const weekdays = ["주일", "월", "화", "수", "목", "금", "토"];
    return weekdays[day];
  };

  const formatDay = (_locale: string | undefined, date: Date) =>
    date.getDate().toString();

  const formatMonthYear = (_locale: string | undefined, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}년 ${month}월`;
  };

  const formatMonth = (_locale: string | undefined, date: Date) =>
    `${date.getMonth() + 1}월`;

  const formatYear = (_locale: string | undefined, date: Date) =>
    `${date.getFullYear()}년`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`filter-pill h-9 ${viewMode === "month" ? "filter-pill-active" : ""}`}
          >
            월간
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`filter-pill h-9 ${viewMode === "week" ? "filter-pill-active" : ""}`}
          >
            주간
          </button>
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`filter-pill h-9 ${viewMode === "day" ? "filter-pill-active" : ""}`}
          >
            일간
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => movePeriod("prev")} className="btn-ghost h-9 px-3 text-xs">
            이전
          </button>
          <button type="button" onClick={goToday} className="btn-ghost h-9 px-3 text-xs">
            오늘
          </button>
          <button type="button" onClick={() => movePeriod("next")} className="btn-ghost h-9 px-3 text-xs">
            다음
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(dayFilterLabel) as DayFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setDayFilter(filter)}
            className={`filter-pill h-8 text-xs ${
              dayFilter === filter ? "filter-pill-active" : ""
            }`}
          >
            {dayFilterLabel[filter]}
          </button>
        ))}
      </div>

      {viewMode === "month" ? (
        <div className="overflow-x-auto">
          <Calendar
            activeStartDate={new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (activeStartDate) {
                setFocusDate(startOfDay(activeStartDate));
              }
            }}
            onClickDay={(date) => setFocusDate(startOfDay(date))}
            locale="ko-KR"
            calendarType="gregory"
            formatShortWeekday={formatShortWeekday}
            formatDay={formatDay}
            formatMonthYear={formatMonthYear}
            formatMonth={formatMonth}
            formatYear={formatYear}
            selectRange
            onChange={(value) => {
              if (!onRangeSelect) return;
              if (Array.isArray(value)) {
                const [start, end] = value;
                if (start && end) {
                  onRangeSelect(withTime(start, 9, 0), withTime(end, 18, 0));
                }
              } else if (value instanceof Date) {
                onRangeSelect(withTime(value, 9, 0), withTime(value, 18, 0));
              }
            }}
            tileDisabled={({ date }) =>
              normalized.some(
                (reservation) =>
                  disabledStatuses.includes(reservation.status) &&
                  isWithinRange(date, reservation.start, reservation.end)
              )
            }
            tileClassName={({ date }) => {
              const classes: string[] = [];
              const year = date.getFullYear();
              const month = date.getMonth() + 1;
              const day = date.getDate();
              const dayOfWeek = date.getDay();
              const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

              if (dayOfWeek === 0) {
                classes.push("calendar-holiday");
              }
              if (holidays.some((holiday) => holiday.date === dateString)) {
                classes.push("calendar-holiday");
              }

              const matched = normalized.find((reservation) =>
                isWithinRange(date, reservation.start, reservation.end)
              );
              if (matched) classes.push(statusClassName[matched.status]);
              return classes.length > 0 ? classes.join(" ") : null;
            }}
            className="w-full max-w-full"
          />
        </div>
      ) : null}

      {viewMode === "week" ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="mb-3 text-sm font-medium text-neutral-700">
            {formatDateLabel(weekDays[0])} - {formatDateLabel(weekDays[6])}
          </p>
          <div className="grid gap-2 md:grid-cols-7">
            {weekReservationsMap.map(({ date, reservations: dateReservations }) => (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => onRangeSelect?.(withTime(date, 9), withTime(date, 18))}
                onTouchStart={() => scheduleLongPress(withTime(date, 9), withTime(date, 18))}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left transition-colors hover:bg-neutral-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-neutral-800">{formatDateLabel(date)}</p>
                  <span className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-600">
                    + 예약
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {dateReservations.length === 0 ? (
                    <p className="text-xs text-neutral-400">예약 없음</p>
                  ) : (
                    dateReservations.slice(0, 3).map((reservation, index) => (
                      <p
                        key={`${date.toISOString()}-${reservation.start_date}-${reservation.end_date}-${index}`}
                        className="text-xs text-neutral-700"
                      >
                        {statusLabel[reservation.status]} · {formatTime(reservation.start)}
                      </p>
                    ))
                  )}
                  {dateReservations.length > 3 ? (
                    <p className="text-xs text-neutral-500">+{dateReservations.length - 3}건</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {viewMode === "day" ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="mb-3 text-sm font-medium text-neutral-700">{formatDateLabel(focusDate)}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {dayQuickSlots.map((slot) => (
              <button
                key={`${slot.start.toISOString()}-${slot.end.toISOString()}`}
                type="button"
                disabled={slot.blocked}
                onClick={() => onRangeSelect?.(slot.start, slot.end)}
                onTouchStart={() => scheduleLongPress(slot.start, slot.end)}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                className={`rounded-lg border p-2 text-left transition-colors ${
                  slot.blocked
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                    : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">
                    {formatTime(slot.start)} - {formatTime(slot.end)}
                  </p>
                  <span className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-[10px]">
                    {slot.blocked ? "예약 불가" : "+ 예약"}
                  </span>
                </div>
                {slot.overlaps.length > 0 ? (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {slot.overlaps.length}건 예약 존재
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-neutral-400">빈 시간대</p>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {dayReservations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-500">
                선택한 날짜에 예약이 없습니다.
              </p>
            ) : (
              dayReservations.map((reservation, index) => (
                <div
                  key={`${reservation.start_date}-${reservation.end_date}-${index}`}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left"
                >
                  <p className="text-sm font-medium text-neutral-800">{statusLabel[reservation.status]}</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {formatDateTimeRange(reservation.start, reservation.end)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {dayFilter !== "all" ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            {dayFilterLabel[dayFilter]} 반복 리스트
          </p>
          <div className="space-y-2">
            {repeatedWeekdayList.length === 0 ? (
              <p className="text-xs text-neutral-500">선택한 요일이 없습니다.</p>
            ) : (
              repeatedWeekdayList.map(({ date, reservations: dateReservations }) => (
                <button
                  key={`repeat-${date.toISOString()}`}
                  type="button"
                  onClick={() => onRangeSelect?.(withTime(date, 9), withTime(date, 18))}
                  onTouchStart={() => scheduleLongPress(withTime(date, 9), withTime(date, 18))}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition-colors hover:bg-neutral-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-800">{formatDateLabel(date)}</p>
                    <span className="rounded-md border border-neutral-300 px-2 py-0.5 text-[10px] text-neutral-600">
                      + 예약
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {dateReservations.length === 0
                      ? "예약 없음"
                      : `${dateReservations.length}건 예약`}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="text-center text-xs text-neutral-500">
        월간: 기간 드래그 선택 | 주간/일간: + 버튼 또는 빈 공간 길게 눌러 예약 시간 반영
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-xs text-neutral-600">
        <span className="chip-muted gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          승인 대기
        </span>
        <span className="chip-muted gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          승인됨
        </span>
        <span className="chip-muted gap-2">
          <span className="h-2 w-2 rounded-full bg-neutral-400" />
          반납 완료
        </span>
        <span className="chip-muted gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          반려
        </span>
      </div>
    </div>
  );
}
