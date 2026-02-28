"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getCurrentYearHolidays, type Holiday } from "@/lib/korean-holidays";
import {
  parseReservationDateRange,
} from "@/components/manage/reservation-manager-shared";

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

export default function ReservationCalendar({
  reservations,
  onRangeSelect,
  disabledStatuses = ["pending", "approved"],
}: ReservationCalendarProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

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
      reservations
        .map((reservation) => {
          const range = parseReservationDateRange(
            reservation.start_date,
            reservation.end_date
          );
          if (!range) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[ReservationCalendar] parse failed", {
                start_date: reservation.start_date,
                end_date: reservation.end_date,
              });
            }
            return null;
          }
          return { ...reservation, ...range };
        })
        .filter((reservation): reservation is ReservationItem & { start: Date; end: Date } => reservation !== null),
    [reservations]
  );

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
      <div className="max-w-[360px]">
        <Calendar
          value={selectedDate}
          onClickDay={(date) => setSelectedDate(startOfDay(date))}
          locale="ko-KR"
          calendarType="gregory"
          formatShortWeekday={formatShortWeekday}
          formatDay={formatDay}
          formatMonthYear={formatMonthYear}
          formatMonth={formatMonth}
          formatYear={formatYear}
          selectRange={false}
          onChange={(value) => {
            if (!onRangeSelect) return;
            if (!(value instanceof Date)) return;
            onRangeSelect(withTime(value, 9, 0), withTime(value, 18, 0));
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
          className="calendar-compact-picker w-full"
        />
      </div>

      <div className="text-center text-xs text-neutral-500">
        월간: 날짜 선택 | 세부 일시 수정: 우측 신청 폼 직접 입력
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
