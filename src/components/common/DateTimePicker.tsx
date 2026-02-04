"use client";

import { useState, useRef, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  min?: string;
  max?: string;
};

export default function DateTimePicker({
  value,
  onChange,
  label,
  required = false,
  min,
  max,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  );
  const [selectedTime, setSelectedTime] = useState({
    hour: value ? new Date(value).getHours() : 9,
    minute: value ? new Date(value).getMinutes() : 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setSelectedTime({
        hour: date.getHours(),
        minute: date.getMinutes(),
      });
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    if (date) {
      const newDateTime = new Date(date);
      newDateTime.setHours(selectedTime.hour);
      newDateTime.setMinutes(selectedTime.minute);
      onChange(newDateTime.toISOString().slice(0, 16));
    }
  };

  const handleTimeChange = (type: "hour" | "minute", val: number) => {
    const newTime = { ...selectedTime, [type]: val };
    setSelectedTime(newTime);
    if (selectedDate) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(newTime.hour);
      newDateTime.setMinutes(newTime.minute);
      onChange(newDateTime.toISOString().slice(0, 16));
    }
  };

  const formatDisplayValue = (val: string) => {
    if (!val) return "";
    const date = new Date(val);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const period = date.getHours() < 12 ? "오전" : "오후";
    const displayHour = date.getHours() % 12 || 12;
    return `${year}. ${month}. ${day}. ${period} ${displayHour}:${minute}`;
  };

  const formatShortWeekday = (locale: string | undefined, date: Date) => {
    const day = date.getDay();
    const weekdays = ["주일", "월", "화", "수", "목", "금", "토"];
    return weekdays[day];
  };

  const formatDay = (locale: string | undefined, date: Date) => {
    return date.getDate().toString();
  };

  const formatMonthYear = (locale: string | undefined, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthNames = [
      "1월", "2월", "3월", "4월", "5월", "6월",
      "7월", "8월", "9월", "10월", "11월", "12월"
    ];
    return `${year}년 ${monthNames[month - 1]}`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="flex flex-col gap-2">
        <span className="form-label">{label}</span>
        <div
          className="form-input cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          {value ? formatDisplayValue(value) : "날짜 및 시간 선택"}
        </div>
        <input
          type="hidden"
          name={label === "시작일" ? "start_date" : "end_date"}
          value={value}
          required={required}
        />
      </label>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[380px] rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
          <div className="space-y-6">
            {/* 달력 */}
            <div className="w-full">
              <Calendar
                locale="en-US"
                formatShortWeekday={formatShortWeekday}
                formatDay={formatDay}
                formatMonthYear={formatMonthYear}
                value={selectedDate}
                onChange={(val) => {
                  if (val instanceof Date) {
                    handleDateChange(val);
                  }
                }}
                minDate={min ? new Date(min) : undefined}
                maxDate={max ? new Date(max) : undefined}
                className="w-full"
              />
            </div>

            {/* 시간 선택 */}
            <div className="flex items-center gap-4 border-t border-neutral-200 pt-4">
              <span className="text-sm font-medium text-neutral-700">시간</span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTime.hour}
                  onChange={(e) =>
                    handleTimeChange("hour", parseInt(e.target.value))
                  }
                  className="form-select w-20"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span className="text-neutral-500">:</span>
                <select
                  value={selectedTime.minute}
                  onChange={(e) =>
                    handleTimeChange("minute", parseInt(e.target.value))
                  }
                  className="form-select w-20"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full rounded-lg bg-black px-4 py-2 text-sm text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
