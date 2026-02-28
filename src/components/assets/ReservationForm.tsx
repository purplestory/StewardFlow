"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VIEWPORT_HEIGHT = 208;
const WHEEL_EDGE_SPACER = (WHEEL_VIEWPORT_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

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

const formatDateLabel = (value: string) => {
  if (!value) return "날짜 선택";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}. ${month}. ${day}.`;
};

const toNormalizedTime = (value: string, fallback = "09:00") => {
  const { hour24, minute } = parseTimeValue(value, fallback);
  return formatTimeValue(hour24, minute);
};

const formatDateTimeSummary = (dateValue: string, timeValue: string, fallbackTime: string) => {
  const dateLabel = formatDateLabel(dateValue);
  const normalizedTime = toNormalizedTime(timeValue, fallbackTime);
  return `${dateLabel} ${normalizedTime}`;
};

const buildTimeDraft = (value: string, fallbackTime: string) => {
  const normalized = toNormalizedTime(value, fallbackTime);
  const { hour24, minute } = parseTimeValue(normalized, fallbackTime);
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;

  return {
    period: period as "AM" | "PM",
    hour12: String(hour12).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
};

type TimeInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id: string;
};

function TimeInputField({
  value,
  onChange,
  disabled = false,
  id,
}: TimeInputFieldProps) {
  const shiftBy = (deltaMinutes: number) => {
    const { hour24, minute } = parseTimeValue(value, "09:00");
    const currentTotal = hour24 * 60 + minute;
    const normalized = normalizeTotalMinutes(currentTotal + deltaMinutes);
    const nextHour = Math.floor(normalized / 60);
    const nextMinute = normalized % 60;
    onChange(formatTimeValue(nextHour, nextMinute));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^\d:]/g, "");
        if (!raw) {
          onChange("");
          return;
        }

        if (raw.includes(":")) {
          const [rawHour = "", rawMinute = ""] = raw.split(":");
          const hour = rawHour.slice(0, 2);
          const minute = rawMinute.slice(0, 2);
          const hasTrailingColon = raw.endsWith(":") && minute.length === 0;
          onChange(hasTrailingColon ? `${hour}:` : `${hour}${minute ? `:${minute}` : ""}`);
          return;
        }

        const digits = raw.slice(0, 4);
        if (digits.length <= 2) {
          onChange(digits);
          return;
        }

        onChange(`${digits.slice(0, 2)}:${digits.slice(2)}`);
      }}
      onBlur={() => onChange(toNormalizedTime(value, "09:00"))}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const position = event.currentTarget.selectionStart ?? value.length;
        const delta =
          position <= 2
            ? event.key === "ArrowUp"
              ? 60
              : -60
            : event.key === "ArrowUp"
            ? 10
            : -10;
        shiftBy(delta);
      }}
      placeholder="13:20"
      className="form-input h-10 px-3 text-center text-base tabular-nums"
      disabled={disabled}
    />
  );
}

type WheelOption = {
  value: string;
  label: string;
};

type WheelColumnProps = {
  label: string;
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function WheelColumn({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const targetIndex = options.findIndex((option) => option.value === value);
    if (targetIndex < 0) return;
    const targetTop = targetIndex * WHEEL_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      el.scrollTo({ top: targetTop, behavior: "auto" });
    }
  }, [options, value]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const index = Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(options.length - 1, index));
        const selected = options[safeIndex];
        const targetTop = safeIndex * WHEEL_ITEM_HEIGHT;
        if (Math.abs(el.scrollTop - targetTop) > 1) {
          el.scrollTo({ top: targetTop, behavior: "smooth" });
        }
        if (selected && selected.value !== value) {
          onChange(selected.value);
        }
      }, 80);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [disabled, onChange, options, value]);

  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-medium text-neutral-500">{label}</p>
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[208px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "y mandatory" }}
        >
          <div
            className="space-y-0"
            style={{
              paddingTop: `${WHEEL_EDGE_SPACER}px`,
              paddingBottom: `${WHEEL_EDGE_SPACER}px`,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={`${label}-${option.value}`}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onChange(option.value);
                    containerRef.current?.scrollTo({
                      top: index * WHEEL_ITEM_HEIGHT,
                      behavior: "smooth",
                    });
                  }}
                  className={`h-10 w-full snap-center text-center text-lg tabular-nums transition-colors ${
                    isSelected ? "font-semibold text-slate-900" : "text-neutral-400"
                  }`}
                  disabled={disabled}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-10 -translate-y-1/2 rounded-xl border border-slate-200 bg-slate-50/70" />
      </div>
    </div>
  );
}

type MobileTimePickerSheetProps = {
  label: string;
  value: string;
  fallbackTime: string;
  onClose: () => void;
  onApply: (value: string) => void;
  disabled?: boolean;
};

function MobileTimePickerSheet({
  label,
  value,
  fallbackTime,
  onClose,
  onApply,
  disabled = false,
}: MobileTimePickerSheetProps) {
  const initialDraft = buildTimeDraft(value, fallbackTime);
  const [period, setPeriod] = useState<"AM" | "PM">(initialDraft.period);
  const [hour12, setHour12] = useState(initialDraft.hour12);
  const [minute, setMinute] = useState(initialDraft.minute);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const hourOptions = useMemo<WheelOption[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const display = index + 1;
        const value = String(display).padStart(2, "0");
        return { value, label: value };
      }),
    []
  );

  const minuteOptions = useMemo<WheelOption[]>(
    () =>
      Array.from({ length: 60 }, (_, index) => {
        const formatted = String(index).padStart(2, "0");
        return { value: formatted, label: formatted };
      }),
    []
  );

  const periodOptions = useMemo<WheelOption[]>(
    () => [
      { value: "AM", label: "오전" },
      { value: "PM", label: "오후" },
    ],
    []
  );

  const handleConfirm = useCallback(() => {
    const numericHour12 = Number.parseInt(hour12, 10) || 9;
    const numericMinute = Number.parseInt(minute, 10) || 0;
    const safeHour12 = Math.min(Math.max(numericHour12, 1), 12);
    const safeMinute = Math.min(Math.max(numericMinute, 0), 59);
    const computedHour24 = period === "AM" ? safeHour12 % 12 : (safeHour12 % 12) + 12;
    onApply(formatTimeValue(computedHour24, safeMinute));
    onClose();
  }, [hour12, minute, onApply, onClose, period]);

  return (
    <div className="fixed inset-0 z-[90] md:hidden">
      <button
        type="button"
        aria-label="시간 선택 닫기"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-neutral-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="text-sm font-medium text-neutral-500"
            onClick={onClose}
            disabled={disabled}
          >
            취소
          </button>
          <p className="text-sm font-semibold text-neutral-800">{label}</p>
          <button
            type="button"
            className="text-sm font-semibold text-slate-700 disabled:text-neutral-400"
            onClick={handleConfirm}
            disabled={disabled}
          >
            완료
          </button>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="grid grid-cols-3 gap-2">
            <WheelColumn
              label="오전/오후"
              options={periodOptions}
              value={period}
              onChange={(next) => setPeriod(next as "AM" | "PM")}
              disabled={disabled}
            />
            <WheelColumn
              label="시"
              options={hourOptions}
              value={hour12}
              onChange={setHour12}
              disabled={disabled}
            />
            <WheelColumn
              label="분"
              options={minuteOptions}
              value={minute}
              onChange={setMinute}
              disabled={disabled}
            />
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
  const [mobileStartOpen, setMobileStartOpen] = useState(false);
  const [mobileEndOpen, setMobileEndOpen] = useState(false);
  const [mobileTimeSheetTarget, setMobileTimeSheetTarget] = useState<"start" | "end" | null>(null);

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
  const normalizedStartTime = toNormalizedTime(startTime, "09:00");
  const normalizedEndTime = toNormalizedTime(endTime, "18:00");
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
          <div className="hidden w-full gap-4 md:grid md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="form-label" htmlFor="start-date-desktop">시작일시</label>
              <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
                <input
                  id="start-date-desktop"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                  className="form-input min-w-0 text-base md:text-sm"
                  required
                  disabled={formDisabled}
                />
                <TimeInputField
                  id="start-time-desktop"
                  value={startTime}
                  onChange={setStartTime}
                  disabled={formDisabled}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <label className="form-label" htmlFor="end-date-desktop">종료일시</label>
              <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
                <input
                  id="end-date-desktop"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="form-input min-w-0 text-base md:text-sm"
                  required
                  disabled={formDisabled}
                />
                <TimeInputField
                  id="end-time-desktop"
                  value={endTime}
                  onChange={setEndTime}
                  disabled={formDisabled}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => {
                  setMobileStartOpen((prev) => !prev);
                  setMobileEndOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-sm font-semibold text-neutral-800">시작일시</span>
                <span className="min-w-0 truncate text-right text-sm tabular-nums text-neutral-700">
                  {formatDateTimeSummary(startDate, startTime, "09:00")}
                </span>
              </button>
              {mobileStartOpen ? (
                <div className="grid min-w-0 gap-2 border-t border-neutral-200 p-3">
                  <input
                    id="start-date-mobile"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={endDate || undefined}
                    className="form-input min-w-0 text-base"
                    required
                    disabled={formDisabled}
                  />
                  <button
                    id="start-time-mobile"
                    type="button"
                    onClick={() => setMobileTimeSheetTarget("start")}
                    className="form-input flex h-10 items-center justify-between px-3 text-sm tabular-nums text-neutral-700"
                    disabled={formDisabled}
                  >
                    <span className="text-neutral-500">시간</span>
                    <span className="font-medium text-neutral-900">
                      {toNormalizedTime(startTime, "09:00")}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => {
                  setMobileEndOpen((prev) => !prev);
                  setMobileStartOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-sm font-semibold text-neutral-800">종료일시</span>
                <span className="min-w-0 truncate text-right text-sm tabular-nums text-neutral-700">
                  {formatDateTimeSummary(endDate, endTime, "18:00")}
                </span>
              </button>
              {mobileEndOpen ? (
                <div className="grid min-w-0 gap-2 border-t border-neutral-200 p-3">
                  <input
                    id="end-date-mobile"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    className="form-input min-w-0 text-base"
                    required
                    disabled={formDisabled}
                  />
                  <button
                    id="end-time-mobile"
                    type="button"
                    onClick={() => setMobileTimeSheetTarget("end")}
                    className="form-input flex h-10 items-center justify-between px-3 text-sm tabular-nums text-neutral-700"
                    disabled={formDisabled}
                  >
                    <span className="text-neutral-500">시간</span>
                    <span className="font-medium text-neutral-900">
                      {toNormalizedTime(endTime, "18:00")}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
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
            value={startDate ? `${startDate}T${normalizedStartTime}:00` : ""}
          />
          <input
            type="hidden"
            name="end_date"
            value={endDate ? `${endDate}T${normalizedEndTime}:00` : ""}
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

      {mobileTimeSheetTarget ? (
        <MobileTimePickerSheet
          key={`${mobileTimeSheetTarget}-${mobileTimeSheetTarget === "start" ? startTime : endTime}`}
          label={mobileTimeSheetTarget === "start" ? "시작 시간 선택" : "종료 시간 선택"}
          value={mobileTimeSheetTarget === "start" ? startTime : endTime}
          fallbackTime={mobileTimeSheetTarget === "start" ? "09:00" : "18:00"}
          onClose={() => setMobileTimeSheetTarget(null)}
          onApply={(next) => {
            if (mobileTimeSheetTarget === "start") {
              setStartTime(next);
            } else {
              setEndTime(next);
            }
          }}
          disabled={formDisabled}
        />
      ) : null}
    </form>
  );
}
