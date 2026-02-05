"use client";

import { useMemo, useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getCurrentYearHolidays, isHoliday, type Holiday } from "@/lib/korean-holidays";

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

export default function ReservationCalendar({
  reservations,
  onRangeSelect,
  disabledStatuses = ["pending", "approved"],
}: ReservationCalendarProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);

  // 공휴일 데이터 로드
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const holidayData = await getCurrentYearHolidays();
        setHolidays(holidayData);
      } catch (error) {
        console.error("공휴일 로드 오류:", error);
      } finally {
        setHolidaysLoading(false);
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

  // 요일 포맷: '일' 대신 '주일'로 표시
  // en-US locale을 사용하면 일요일부터 시작하므로, date.getDay()는 0=일요일, 1=월요일, ..., 6=토요일
  const formatShortWeekday = (locale: string | undefined, date: Date) => {
    const day = date.getDay();
    const weekdays = ["주일", "월", "화", "수", "목", "금", "토"];
    return weekdays[day];
  };

  // 날짜 포맷: 한글 '일' 제거, 숫자만 표시
  const formatDay = (locale: string | undefined, date: Date) => {
    return date.getDate().toString();
  };

  // 월/년도 포맷: 한국어로 "년도 월" 형식으로 표시
  const formatMonthYear = (locale: string | undefined, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthNames = [
      "1월", "2월", "3월", "4월", "5월", "6월",
      "7월", "8월", "9월", "10월", "11월", "12월"
    ];
    return `${year}년 ${monthNames[month - 1]}`;
  };

  // 한국 공휴일 확인 함수 (API 사용)
  const checkHoliday = async (date: Date): Promise<boolean> => {
    return isHoliday(date, holidays);
  };

  return (
    <div className="space-y-3 w-full overflow-x-auto">
      <div className="flex justify-center w-full max-w-full">
        <div className="w-full max-w-full overflow-x-auto">
          <Calendar
          locale="en-US"
          formatShortWeekday={formatShortWeekday}
          formatDay={formatDay}
          formatMonthYear={formatMonthYear}
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
            
            // 공휴일 체크 (동기적으로 확인)
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dayOfWeek = date.getDay();
            const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            
            // 일요일은 공휴일
            if (dayOfWeek === 0) {
              classes.push("calendar-holiday");
            }
            
            // API에서 가져온 공휴일 목록 확인
            if (holidays.some((h) => h.date === dateString)) {
              classes.push("calendar-holiday");
            }
            
            // 예약 상태 클래스
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
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs text-neutral-600">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          승인 대기
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          승인됨
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-neutral-400" />
          반납 완료
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          반려
        </span>
      </div>
    </div>
  );
}
