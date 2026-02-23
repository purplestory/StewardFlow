"use client";

import { useEffect, useState, useActionState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createReservation } from "@/actions/booking-actions";
import { supabase } from "@/lib/supabase";
import { formatRecurrenceDescription } from "@/lib/recurrence";
import Notice from "@/components/common/Notice";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const initialState = { ok: false, message: "" };

const MINUTES_PER_DAY = 24 * 60;

const parseTimeValue = (value: string, fallback = "09:00") => {
  const source = value || fallback;
  const [rawHour = "09", rawMinute = "00"] = source.split(":");
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);
  const safeHour = Number.isNaN(hour) ? 9 : Math.min(Math.max(hour, 0), 23);
  const safeMinute = Number.isNaN(minute) ? 0 : Math.min(Math.max(minute, 0), 59);

  return { hour24: safeHour, minute: safeMinute };
};

const formatTimeValue = (hour24: number, minute: number) =>
  `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const normalizeTotalMinutes = (totalMinutes: number) =>
  ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

type TimeStepperFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  name: string;
};

function TimeStepperField({
  value,
  onChange,
  disabled = false,
  name,
}: TimeStepperFieldProps) {
  const { hour24, minute } = parseTimeValue(value);
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setTime = (nextHour24: number, nextMinute: number) => {
    const safeHour = ((nextHour24 % 24) + 24) % 24;
    const safeMinute = ((nextMinute % 60) + 60) % 60;
    onChange(formatTimeValue(safeHour, safeMinute));
  };

  const shiftMinutes = (delta: number) => {
    const currentTotal = hour24 * 60 + minute;
    const normalized = normalizeTotalMinutes(currentTotal + delta);
    setTime(Math.floor(normalized / 60), normalized % 60);
  };

  const setPeriod = (nextPm: boolean) => {
    const baseHour = hour12 % 12;
    const nextHour24 = nextPm ? baseHour + 12 : baseHour;
    setTime(nextHour24, minute);
  };

  const setHour12 = (nextHour12: number) => {
    const clamped = Math.min(Math.max(nextHour12, 1), 12);
    const nextHour24 = (clamped % 12) + (isPm ? 12 : 0);
    setTime(nextHour24, minute);
  };

  const setMinute = (nextMinute: number) => {
    const clamped = Math.min(Math.max(nextMinute, 0), 59);
    setTime(hour24, clamped);
  };

  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3">
      <input type="hidden" name={name} value={formatTimeValue(hour24, minute)} />
      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        <button
          type="button"
          onClick={() => setPeriod(false)}
          disabled={disabled}
          className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
            !isPm ? "bg-slate-900 text-white" : "text-neutral-700 hover:bg-white"
          }`}
        >
          오전
        </button>
        <button
          type="button"
          onClick={() => setPeriod(true)}
          disabled={disabled}
          className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
            isPm ? "bg-slate-900 text-white" : "text-neutral-700 hover:bg-white"
          }`}
        >
          오후
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-600">시간</p>
          <div className="grid grid-cols-[36px_1fr_36px] items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMinutes(60)}
              disabled={disabled}
              className="btn-secondary h-9 px-0 text-sm"
              aria-label="시간 증가"
            >
              ▲
            </button>
            <input
              type="number"
              min={1}
              max={12}
              value={hour12}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isNaN(next)) return;
                setHour12(next);
              }}
              className="form-input h-9 px-2 text-center tabular-nums"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => shiftMinutes(-60)}
              disabled={disabled}
              className="btn-secondary h-9 px-0 text-sm"
              aria-label="시간 감소"
            >
              ▼
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-600">분</p>
          <div className="grid grid-cols-[36px_1fr_36px] items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMinutes(10)}
              disabled={disabled}
              className="btn-secondary h-9 px-0 text-sm"
              aria-label="분 증가"
            >
              ▲
            </button>
            <input
              type="number"
              min={0}
              max={59}
              step={10}
              value={minute}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isNaN(next)) return;
                setMinute(next);
              }}
              className="form-input h-9 px-2 text-center tabular-nums"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => shiftMinutes(-10)}
              disabled={disabled}
              className="btn-secondary h-9 px-0 text-sm"
              aria-label="분 감소"
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ReservationFormProps = {
  assetId: string;
  resourceType?: "asset" | "space" | "vehicle";
  presetStartDate?: string;
  presetEndDate?: string;
  isDisabled?: boolean;
  disabledReason?: string;
  minReservationMinutes?: number | null;
  maxReservationMinutes?: number | null;
  reservationBufferMinutes?: number;
};

export default function ReservationForm({
  assetId,
  resourceType = "asset",
  presetStartDate,
  presetEndDate,
  isDisabled = false,
  disabledReason,
  minReservationMinutes = null,
  maxReservationMinutes = null,
  reservationBufferMinutes = 0,
}: ReservationFormProps) {
  const queryClient = useQueryClient();
  const [state, formAction, isPending] = useActionState(createReservation, initialState);
  const [authAccessToken, setAuthAccessToken] = useState<string | null>(null);
  const [dismissedSuccessMessage, setDismissedSuccessMessage] = useState<string | null>(null);
  const [clientValidationMessage, setClientValidationMessage] = useState<string | null>(null);
  
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
      setAuthAccessToken(data.session?.access_token ?? null);
    };

    loadSession();
  }, []);

  // 달력에서 날짜 범위 선택 시 폼의 날짜/시간 자동 업데이트
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 0);

    return () => clearTimeout(timer);
  }, [presetStartDate, presetEndDate]);

  const handleDayOfWeekToggle = (day: number) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const formDisabled = isDisabled || isPending;
  const submitLabel = resourceType === "space" ? "예약 신청" : "대여 신청";
  const reservationQueryKey =
    resourceType === "space"
      ? "spaceReservations"
      : resourceType === "vehicle"
      ? "vehicleReservations"
      : "assetReservations";
  const showSuccessModal =
    state.ok && Boolean(state.message) && dismissedSuccessMessage !== state.message;

  useEffect(() => {
    if (!state.ok) return;

    void queryClient.invalidateQueries({
      queryKey: [reservationQueryKey, assetId],
    });
  }, [state.ok, state.message, reservationQueryKey, assetId, queryClient]);

  const validateSpaceDuration = () => {
    if (resourceType !== "space") return null;
    if (!startDate || !startTime || !endDate || !endTime) return null;

    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "예약 시간 형식이 올바르지 않습니다.";
    }

    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    if (durationMinutes <= 0) {
      return "예약 종료 시간은 시작 시간보다 늦어야 합니다.";
    }

    if (
      minReservationMinutes !== null &&
      minReservationMinutes > 0 &&
      durationMinutes < minReservationMinutes
    ) {
      return `최소 ${minReservationMinutes}분 이상 예약해야 합니다.`;
    }

    if (
      maxReservationMinutes !== null &&
      maxReservationMinutes > 0 &&
      durationMinutes > maxReservationMinutes
    ) {
      return `최대 ${maxReservationMinutes}분까지만 예약할 수 있습니다.`;
    }

    return null;
  };

  return (
    <form
      action={formAction}
      className="space-y-5"
      onSubmit={(event) => {
        setDismissedSuccessMessage(null);
        setClientValidationMessage(null);

        const message = validateSpaceDuration();
        if (message) {
          event.preventDefault();
          setClientValidationMessage(message);
        }
      }}
    >
      {resourceType === "space" ? (
        <input type="hidden" name="space_id" value={assetId} />
      ) : resourceType === "vehicle" ? (
        <input type="hidden" name="vehicle_id" value={assetId} />
      ) : (
        <input type="hidden" name="asset_id" value={assetId} />
      )}
      <input type="hidden" name="resource_type" value={resourceType} />
      {authAccessToken && (
        <input type="hidden" name="auth_access_token" value={authAccessToken} />
      )}
      {resourceType === "space" ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          최소 {minReservationMinutes && minReservationMinutes > 0 ? `${minReservationMinutes}분` : "제한 없음"} ·
          최대 {maxReservationMinutes && maxReservationMinutes > 0 ? `${maxReservationMinutes}분` : "제한 없음"} ·
          버퍼 {reservationBufferMinutes > 0 ? `${reservationBufferMinutes}분` : "없음"}
        </div>
      ) : null}
      <fieldset disabled={formDisabled} className="space-y-4">
        <div className="space-y-3">
          <div className="grid w-full grid-cols-1 gap-4">
            <div className="min-w-0 space-y-2">
              <label className="form-label">시작일시</label>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                  className="form-input min-w-0 text-base md:text-sm"
                  required
                  disabled={formDisabled}
                />
                <TimeStepperField
                  value={startTime}
                  onChange={setStartTime}
                  disabled={formDisabled}
                  name="start_time"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <label className="form-label">종료일시</label>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="form-input min-w-0 text-base md:text-sm"
                  required
                  disabled={formDisabled}
                />
                <TimeStepperField
                  value={endTime}
                  onChange={setEndTime}
                  disabled={formDisabled}
                  name="end_time"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <label className="form-label">반복 유형</label>
              <Select
                value={recurrenceType}
                onValueChange={(nextValue) => {
                  const newType = nextValue as "none" | "weekly" | "monthly";
                  setRecurrenceType(newType);
                  setShowRecurrence(newType !== "none");
                  if (newType === "none") {
                    setRecurrenceEndDate("");
                  }
                }}
                name="recurrence_type"
                disabled={formDisabled}
              >
                <SelectTrigger className="form-select">
                  <SelectContent>
                    <SelectItem value="none">반복 없음</SelectItem>
                    <SelectItem value="weekly">매주 반복</SelectItem>
                    <SelectItem value="monthly">매월 반복</SelectItem>
                  </SelectContent>
                </SelectTrigger>
              </Select>
            </div>
          </div>
          
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

          {showRecurrence && recurrenceType !== "none" && (
            <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="form-label">반복 간격</span>
                    <input
                      name="recurrence_interval"
                      type="number"
                      min="1"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number.parseInt(e.target.value, 10) || 1)}
                      className="form-input"
                      placeholder="1"
                      disabled={formDisabled}
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
                      disabled={formDisabled}
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
                          disabled={formDisabled}
                          className={`h-10 w-10 rounded-xl border text-sm transition-colors ${
                            selectedDaysOfWeek.includes(index)
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
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
                      onChange={(e) => setDayOfMonth(Number.parseInt(e.target.value, 10) || 1)}
                      className="form-input"
                      disabled={formDisabled}
                    />
                    <p className="text-xs text-neutral-500">
                      매월 {dayOfMonth}일에 반복됩니다
                    </p>
                  </label>
                )}

                {recurrenceEndDate && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="mb-2 text-sm font-semibold text-blue-900">반복 일정 미리보기</p>
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
              disabled={formDisabled}
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
            className="form-textarea min-h-[120px]"
            placeholder="예: 주일 예배 음향 지원"
            disabled={formDisabled}
          />
        </label>
      </fieldset>

      {isDisabled && disabledReason && (
        <div role="status">
          <Notice variant="warning" className="p-3 text-left">
            {disabledReason}
          </Notice>
        </div>
      )}

      {state.message && !state.ok && (
        <div role="status">
          <Notice variant="error" className="p-3 text-left">
            {state.message}
          </Notice>
        </div>
      )}

      {clientValidationMessage ? (
        <div role="status">
          <Notice variant="error" className="p-3 text-left">
            {clientValidationMessage}
          </Notice>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          disabled={formDisabled}
          className="btn-primary w-full sm:w-auto sm:min-w-[140px]"
        >
          {isPending ? "신청 처리 중..." : submitLabel}
        </button>
      </div>

      <Dialog
        open={showSuccessModal && state.ok}
        onOpenChange={(open) => {
          if (!open) {
            setDismissedSuccessMessage(state.message);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>신청 완료</DialogTitle>
            <DialogDescription className="mt-3">
              {state.message || "예약 신청이 완료되었습니다."}
            </DialogDescription>
            <p className="mt-2 text-xs text-neutral-500">
              예약 현황이 자동으로 갱신되었습니다.
            </p>
          </DialogHeader>
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => setDismissedSuccessMessage(state.message)}
              >
                확인
              </button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
