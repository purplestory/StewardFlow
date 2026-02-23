"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
type MonthDisplayMode = "compact" | "full";
type WeekDragState = {
  dayIndex: number;
  startSlot: number;
  endSlot: number;
};

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

const weekSlotStartHour = 7;
const weekSlotEndHour = 22;
const weekSlotHours = Array.from(
  { length: weekSlotEndHour - weekSlotStartHour },
  (_, index) => weekSlotStartHour + index
);

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
  const [monthDisplayMode, setMonthDisplayMode] = useState<MonthDisplayMode>("compact");
  const [showMonthCalendar, setShowMonthCalendar] = useState(true);
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [weekDragState, setWeekDragState] = useState<WeekDragState | null>(null);
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
      slots: weekSlotHours.map((hour) => {
        const start = withTime(date, hour, 0);
        const end = withTime(date, hour + 1, 0);
        const overlaps = normalized.filter((reservation) =>
          isOverlap(start, end, reservation.start, reservation.end)
        );
        const blocked = overlaps.some((reservation) =>
          disabledStatuses.includes(reservation.status)
        );
        return {
          hour,
          start,
          end,
          overlaps,
          blocked,
        };
      }),
    }));
  }, [disabledStatuses, normalized, viewMode, visibleWeekDays]);

  const dayReservations = useMemo(() => {
    if (viewMode !== "day") return [];
    return normalized.filter((reservation) =>
      isWithinRange(focusDate, reservation.start, reservation.end)
    );
  }, [focusDate, normalized, viewMode]);

  const dayQuickSlots = useMemo(() => {
    if (viewMode !== "day") return [];
    return weekSlotHours.map((hour) => {
      const start = withTime(focusDate, hour, 0);
      const end = withTime(focusDate, hour + 1, 0);
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
      longPressTimerRef.current = null;
      onRangeSelect(start, end);
    }, 450);
  };

  const cancelLongPress = () => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const isWeekSlotSelected = (dayIndex: number, slotIndex: number) => {
    if (!weekDragState) return false;
    if (weekDragState.dayIndex !== dayIndex) return false;
    const start = Math.min(weekDragState.startSlot, weekDragState.endSlot);
    const end = Math.max(weekDragState.startSlot, weekDragState.endSlot);
    return slotIndex >= start && slotIndex <= end;
  };

  const startWeekDrag = (dayIndex: number, slotIndex: number, blocked: boolean) => {
    if (!onRangeSelect || blocked) return;
    setWeekDragState({
      dayIndex,
      startSlot: slotIndex,
      endSlot: slotIndex,
    });
  };

  const moveWeekDrag = (dayIndex: number, slotIndex: number) => {
    setWeekDragState((prev) => {
      if (!prev || prev.dayIndex !== dayIndex) return prev;
      return {
        ...prev,
        endSlot: slotIndex,
      };
    });
  };

  const finishWeekDrag = useCallback(() => {
    if (!weekDragState || !onRangeSelect) return;

    const day = visibleWeekDays[weekDragState.dayIndex];
    if (!day) {
      setWeekDragState(null);
      return;
    }

    const startSlot = Math.min(weekDragState.startSlot, weekDragState.endSlot);
    const endSlot = Math.max(weekDragState.startSlot, weekDragState.endSlot);
    const start = withTime(day, weekSlotHours[startSlot], 0);
    const end = withTime(day, weekSlotHours[endSlot] + 1, 0);

    const hasBlocked = normalized.some(
      (reservation) =>
        disabledStatuses.includes(reservation.status) &&
        isOverlap(start, end, reservation.start, reservation.end)
    );

    if (!hasBlocked) {
      onRangeSelect(start, end);
    }
    setWeekDragState(null);
  }, [disabledStatuses, normalized, onRangeSelect, visibleWeekDays, weekDragState]);

  useEffect(() => {
    if (!weekDragState) return;

    const handleMouseUp = () => {
      finishWeekDrag();
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [finishWeekDrag, weekDragState]);

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
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-xl border border-neutral-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
                viewMode === "month"
                  ? "bg-slate-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              월
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
                viewMode === "week"
                  ? "bg-slate-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              주
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
                viewMode === "day"
                  ? "bg-slate-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              일
            </button>
          </div>
          <div className="inline-flex items-center rounded-xl border border-neutral-200 bg-white p-1">
            <button
              type="button"
              onClick={() => movePeriod("prev")}
              className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              이전
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-8 rounded-lg px-3 text-xs font-semibold text-slate-900 transition-colors hover:bg-neutral-100"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => movePeriod("next")}
              className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              다음
            </button>
          </div>
        </div>
        {viewMode === "month" ? (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setMonthDisplayMode((prev) => (prev === "compact" ? "full" : "compact"))
              }
              className="btn-ghost h-8 px-3 text-xs"
            >
              {monthDisplayMode === "compact" ? "전체 달력" : "미니 달력"}
            </button>
            <button
              type="button"
              onClick={() => setShowMonthCalendar((prev) => !prev)}
              className="btn-ghost h-8 px-3 text-xs"
            >
              {showMonthCalendar ? "달력 숨기기" : "달력 보이기"}
            </button>
          </div>
        ) : null}
      </div>

      {viewMode !== "month" ? (
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
      ) : null}

      {viewMode === "month" ? (
        showMonthCalendar ? (
          <div className={monthDisplayMode === "compact" ? "max-w-[360px]" : "overflow-x-auto"}>
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
              selectRange={monthDisplayMode === "full"}
              onChange={(value) => {
                if (!onRangeSelect) return;

                if (monthDisplayMode === "full" && Array.isArray(value)) {
                  const [start, end] = value;
                  if (start && end) {
                    onRangeSelect(withTime(start, 9, 0), withTime(end, 18, 0));
                  }
                  return;
                }

                if (value instanceof Date) {
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
                if (matched && monthDisplayMode === "full") {
                  classes.push(statusClassName[matched.status]);
                }
                return classes.length > 0 ? classes.join(" ") : null;
              }}
              className={`w-full ${monthDisplayMode === "compact" ? "calendar-compact-picker" : "max-w-full"}`}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5">
            <p className="text-sm text-neutral-600">
              월간 달력을 숨긴 상태입니다. 현재 선택 날짜:{" "}
              <span className="font-semibold text-neutral-900">{formatDateLabel(focusDate)}</span>
            </p>
            <button
              type="button"
              onClick={() => setShowMonthCalendar(true)}
              className="btn-ghost mt-3 h-8 px-3 text-xs"
            >
              달력 다시 열기
            </button>
          </div>
        )
      ) : null}

      {viewMode === "week" ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="mb-3 text-sm font-medium text-neutral-700">
            {formatDateLabel(weekDays[0])} - {formatDateLabel(weekDays[6])}
          </p>
          <div className="overflow-x-auto">
            <div
              className="grid min-w-full gap-1 md:min-w-[820px]"
              style={{
                gridTemplateColumns: `70px repeat(${weekReservationsMap.length}, minmax(96px, 1fr))`,
              }}
            >
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2 text-center text-xs font-medium text-neutral-500">
                시간
              </div>
              {weekReservationsMap.map(({ date, reservations: dateReservations }) => (
                <div
                  key={`${date.toISOString()}-header`}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2 text-center"
                >
                  <p className="text-xs font-semibold text-neutral-800">{formatDateLabel(date)}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    {dateReservations.length === 0 ? "예약 없음" : `${dateReservations.length}건`}
                  </p>
                </div>
              ))}

              {weekSlotHours.map((hour, slotIndex) => (
                <div key={`row-${hour}`} className="contents">
                  <div className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-center text-[11px] text-neutral-500">
                    {`${String(hour).padStart(2, "0")}:00`}
                  </div>
                  {weekReservationsMap.map(({ date, slots }, dayIndex) => {
                    const slot = slots[slotIndex];
                    const selected = isWeekSlotSelected(dayIndex, slotIndex);
                    return (
                      <button
                        key={`${date.toISOString()}-${hour}`}
                        type="button"
                        disabled={slot.blocked}
                        onMouseDown={() => startWeekDrag(dayIndex, slotIndex, slot.blocked)}
                        onMouseEnter={() => moveWeekDrag(dayIndex, slotIndex)}
                        onTouchStart={() => scheduleLongPress(slot.start, slot.end)}
                        onTouchEnd={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                        onKeyDown={(event) => {
                          if (!onRangeSelect || slot.blocked) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRangeSelect(slot.start, slot.end);
                          }
                        }}
                        className={`rounded-lg border px-2 py-2 text-left text-[11px] transition-colors ${
                          slot.blocked
                            ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                            : selected
                              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {slot.overlaps.length > 0 ? `${slot.overlaps.length}건` : "+ 예약"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
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

      {viewMode !== "month" && dayFilter !== "all" ? (
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
        월간: 미니 달력 날짜 선택(필요 시 전체 달력) | 주간: 빈 시간 드래그(데스크톱)/길게 누르기(모바일) | 일간: + 버튼 또는 길게 누르기
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
