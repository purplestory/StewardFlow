"use client";

import { useMemo, useState, useEffect } from "react";
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

const statusClassName: Record<ReservationItem["status"], string> = {
  pending: "calendar-pending",
  approved: "calendar-approved",
  returned: "calendar-returned",
  rejected: "calendar-rejected",
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isWithinRange = (day: Date, start: Date, end: Date) => {
  const target = startOfDay(day).getTime();
  const startTime = startOfDay(start).getTime();
  const endTime = startOfDay(end).getTime();
  return target >= startTime && target <= endTime;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

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

const statusLabel: Record<ReservationItem["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

export default function ReservationCalendar({
  reservations,
  onRangeSelect,
  disabledStatuses = ["pending", "approved"],
}: ReservationCalendarProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));

  // 공휴일 데이터 로드
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

  const dayReservations = useMemo(() => {
    if (viewMode !== "day") return [];
    return normalized.filter((reservation) =>
      isWithinRange(focusDate, reservation.start, reservation.end)
    );
  }, [focusDate, normalized, viewMode]);

  const weekReservationsMap = useMemo(() => {
    if (viewMode !== "week") return [];
    return weekDays.map((date) => ({
      date,
      reservations: normalized.filter((reservation) =>
        isWithinRange(date, reservation.start, reservation.end)
      ),
    }));
  }, [normalized, viewMode, weekDays]);

  // 요일 포맷: '일' 대신 '주일'로 표시
  // en-US locale을 사용하면 일요일부터 시작하므로, date.getDay()는 0=일요일, 1=월요일, ..., 6=토요일
  const formatShortWeekday = (_locale: string | undefined, date: Date) => {
    const day = date.getDay();
    const weekdays = ["주일", "월", "화", "수", "목", "금", "토"];
    return weekdays[day];
  };

  // 날짜 포맷: 한글 '일' 제거, 숫자만 표시
  const formatDay = (_locale: string | undefined, date: Date) => {
    return date.getDate().toString();
  };

  // 월/년도 포맷: 한국어로 "년도 월" 형식으로 표시
  const formatMonthYear = (_locale: string | undefined, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthNames = [
      "1월", "2월", "3월", "4월", "5월", "6월",
      "7월", "8월", "9월", "10월", "11월", "12월"
    ];
    return `${year}년 ${monthNames[month - 1]}`;
  };

  const formatMonth = (_locale: string | undefined, date: Date) => {
    return `${date.getMonth() + 1}월`;
  };

  const formatYear = (_locale: string | undefined, date: Date) => {
    return `${date.getFullYear()}년`;
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

      {viewMode === "month" ? (
        <div className="overflow-x-auto">
          <Calendar
            activeStartDate={new Date(
              focusDate.getFullYear(),
              focusDate.getMonth(),
              1
            )}
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
                  onRangeSelect(start, end);
                }
              } else if (value instanceof Date) {
                onRangeSelect(value, value);
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
              if (matched) {
                classes.push(statusClassName[matched.status]);
              }

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
                onClick={() => onRangeSelect?.(date, date)}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left transition-colors hover:bg-neutral-100"
              >
                <p className="text-xs font-semibold text-neutral-800">{formatDateLabel(date)}</p>
                <div className="mt-2 space-y-1">
                  {dateReservations.length === 0 ? (
                    <p className="text-xs text-neutral-400">예약 없음</p>
                  ) : (
                    dateReservations.slice(0, 3).map((reservation, index) => (
                      <p key={`${date.toISOString()}-${reservation.start_date}-${reservation.end_date}-${index}`} className="text-xs text-neutral-700">
                        {statusLabel[reservation.status]} · {reservation.start.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true })}
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
          <div className="space-y-2">
            {dayReservations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-6 text-center text-sm text-neutral-500">
                선택한 날짜에 예약이 없습니다.
              </p>
            ) : (
              dayReservations.map((reservation, index) => (
                <button
                  key={`${reservation.start_date}-${reservation.end_date}-${index}`}
                  type="button"
                  onClick={() => onRangeSelect?.(focusDate, focusDate)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition-colors hover:bg-neutral-100"
                >
                  <p className="text-sm font-medium text-neutral-800">{statusLabel[reservation.status]}</p>
                  <p className="mt-1 text-xs text-neutral-600">{formatDateTimeRange(reservation.start, reservation.end)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="text-center text-xs text-neutral-500">
        {viewMode === "month"
          ? "월간: 드래그로 기간 선택"
          : "주간/일간: 날짜 또는 항목을 눌러 신청 날짜를 반영"}
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
