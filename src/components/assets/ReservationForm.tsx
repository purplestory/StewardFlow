"use client";

import { useEffect, useState, useActionState } from "react";
import { createReservation } from "@/actions/booking-actions";
import { supabase } from "@/lib/supabase";
import { formatRecurrenceDescription } from "@/lib/recurrence";

const initialState = { ok: false, message: "" };

type ReservationFormProps = {
  assetId: string;
  resourceType?: "asset" | "space" | "vehicle";
  presetStartDate?: string;
  presetEndDate?: string;
  isDisabled?: boolean;
  disabledReason?: string;
};

export default function ReservationForm({
  assetId,
  resourceType = "asset",
  presetStartDate,
  presetEndDate,
  isDisabled = false,
  disabledReason,
}: ReservationFormProps) {
  const [state, formAction] = useActionState(createReservation, initialState);
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  
  // 시스템 날짜를 기본값으로 설정
  const getDefaultDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const [startDate, setStartDate] = useState(getDefaultDate());
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(getDefaultDate());
  const [endTime, setEndTime] = useState("18:00");
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"none" | "weekly" | "monthly">("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setBorrowerId(data.session?.user?.id ?? null);
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (presetStartDate) {
      const date = new Date(presetStartDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      
      setStartDate(`${year}-${month}-${day}`);
      setStartTime(`${hours}:${minutes}`);
      // 시작일의 요일을 기본 선택
      setSelectedDaysOfWeek([date.getDay()]);
      setDayOfMonth(date.getDate());
    }
    if (presetEndDate) {
      const date = new Date(presetEndDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      
      setEndDate(`${year}-${month}-${day}`);
      setEndTime(`${hours}:${minutes}`);
    }
  }, [presetStartDate, presetEndDate]);

  const handleDayOfWeekToggle = (day: number) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="asset_id" value={assetId} />
      <input type="hidden" name="resource_type" value={resourceType} />
      {borrowerId && (
        <input type="hidden" name="borrower_id" value={borrowerId} />
      )}
      <fieldset disabled={isDisabled} className="space-y-4">
        <div className="space-y-3">
          {/* 시작일시, 종료일시, 반복유형을 한 줄에 배치 */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3 w-full">
            <div className="flex flex-col gap-2 w-full min-w-0">
              <label className="form-label">시작일시</label>
              <div className="flex gap-2 w-full items-stretch">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                  className="form-input text-base md:text-sm"
                  style={{ flex: '1 1 0', minWidth: '110px' }}
                  required
                  disabled={isDisabled}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="form-input text-base md:text-sm flex-shrink-0"
                  style={{ width: '120px', minWidth: '120px', flexShrink: 0 }}
                  required
                  disabled={isDisabled}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full min-w-0">
              <label className="form-label">종료일시</label>
              <div className="flex gap-2 w-full items-stretch">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="form-input text-base md:text-sm"
                  style={{ flex: '1 1 0', minWidth: '110px' }}
                  required
                  disabled={isDisabled}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="form-input text-base md:text-sm flex-shrink-0"
                  style={{ width: '120px', minWidth: '120px', flexShrink: 0 }}
                  required
                  disabled={isDisabled}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full min-w-0">
              <label className="form-label">반복 유형</label>
              <select
                name="recurrence_type"
                value={recurrenceType}
                onChange={(e) => {
                  const newType = e.target.value as "none" | "weekly" | "monthly";
                  setRecurrenceType(newType);
                  setShowRecurrence(newType !== "none");
                  if (newType === "none") {
                    setRecurrenceEndDate("");
                  }
                }}
                className="form-select w-full"
                disabled={isDisabled}
              >
                <option value="none">반복 없음</option>
                <option value="weekly">매주 반복</option>
                <option value="monthly">매월 반복</option>
              </select>
            </div>
          </div>
          
          {/* hidden inputs for server action (ISO format) */}
          <input
            type="hidden"
            name="start_date"
            value={startDate && startTime ? `${startDate}T${startTime}:00` : ""}
          />
          <input
            type="hidden"
            name="end_date"
            value={endDate && endTime ? `${endDate}T${endTime}:00` : ""}
          />

          {/* 반복 일정 설정 (펼쳐지는 부분) */}
          {showRecurrence && recurrenceType !== "none" && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-4">
              <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="form-label">반복 간격</span>
                      <input
                        name="recurrence_interval"
                        type="number"
                        min="1"
                        value={recurrenceInterval}
                        onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                        className="form-input"
                        placeholder="1"
                        disabled={isDisabled}
                      />
                      <p className="text-xs text-neutral-500">
                        {recurrenceType === "weekly"
                          ? `${recurrenceInterval}주마다 반복`
                          : `${recurrenceInterval}달마다 반복`}
                      </p>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="form-label">반복 종료일</span>
                      <input
                        name="recurrence_end_date"
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        className="form-input"
                        min={startDate}
                        required={true}
                        disabled={isDisabled}
                      />
                    </label>
                  </div>

                  {recurrenceType === "weekly" && (
                    <div className="flex flex-col gap-2">
                      <span className="form-label">반복 요일</span>
                      <div className="flex flex-wrap gap-2">
                        {dayNames.map((name, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleDayOfWeekToggle(index)}
                            disabled={isDisabled}
                            className={`day-button h-[38px] w-[38px] rounded-lg border text-sm transition-colors ${
                              selectedDaysOfWeek.includes(index)
                                ? "border-black bg-black text-white"
                                : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <input
                        type="hidden"
                        name="recurrence_days_of_week"
                        value={JSON.stringify(selectedDaysOfWeek)}
                      />
                    </div>
                  )}

                  {recurrenceType === "monthly" && (
                    <label className="flex flex-col gap-2">
                      <span className="form-label">반복 일</span>
                      <input
                        name="recurrence_day_of_month"
                        type="number"
                        min="1"
                        max="31"
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                        className="form-input"
                        disabled={isDisabled}
                      />
                      <p className="text-xs text-neutral-500">
                        매월 {dayOfMonth}일에 반복됩니다
                      </p>
                    </label>
                  )}

                  {recurrenceEndDate && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-2">반복 일정 미리보기</p>
                      <p className="text-sm text-blue-700">
                        {formatRecurrenceDescription({
                          type: recurrenceType,
                          interval: recurrenceInterval,
                          endDate: recurrenceEndDate,
                          daysOfWeek: recurrenceType === "weekly" ? selectedDaysOfWeek : undefined,
                          dayOfMonth: recurrenceType === "monthly" ? dayOfMonth : undefined,
                        })}
                      </p>
                      <p className="mt-2 text-xs text-blue-600">
                        종료일: {new Date(recurrenceEndDate).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
        {resourceType === "vehicle" && (
          <label className="flex flex-col gap-2">
            <span className="form-label">대여 시 초기 주행거리 (km)</span>
            <input
              name="start_odometer_reading"
              type="number"
              min={0}
              className="form-input"
              placeholder="예: 50000"
              disabled={isDisabled}
            />
            <p className="text-xs text-neutral-500">
              차량 대여 시점의 계기판 주행거리를 입력하세요.
            </p>
          </label>
        )}
        <label className="flex flex-col gap-2">
          <span className="form-label">사용 목적</span>
          <textarea
            name="note"
            className="form-textarea"
            placeholder="예: 주일 예배 음향 지원"
          />
        </label>
      </fieldset>

      {isDisabled && disabledReason && (
        <p className="text-sm text-amber-600" role="status">
          {disabledReason}
        </p>
      )}

      {state.message && (
        <p
          className={`text-sm ${
            state.ok ? "text-emerald-600" : "text-rose-600"
          }`}
          role="status"
        >
          {state.message}
        </p>
      )}

      <button
        disabled={isDisabled}
        className="btn-primary w-full"
      >
        대여 신청
      </button>
    </form>
  );
}
