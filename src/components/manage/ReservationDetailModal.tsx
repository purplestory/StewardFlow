"use client";

type ReservationStatus = "pending" | "approved" | "returned" | "rejected";

type ReservationDetailModalProps = {
  isOpen: boolean;
  title: string;
  resourceLabel: string;
  resourceName: string;
  periodText: string;
  borrowerText: string;
  requiredRoleLabel?: string | null;
  note?: string | null;
  status: ReservationStatus;
  statusOptions: ReservationStatus[];
  statusLabel: Record<ReservationStatus, string>;
  disableStatusChange: boolean;
  onStatusChange: (nextStatus: ReservationStatus) => void;
  onClose: () => void;
};

export default function ReservationDetailModal({
  isOpen,
  title,
  resourceLabel,
  resourceName,
  periodText,
  borrowerText,
  requiredRoleLabel,
  note,
  status,
  statusOptions,
  statusLabel,
  disableStatusChange,
  onStatusChange,
  onClose,
}: ReservationDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-surface">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h3>
          <button
            type="button"
            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <dl className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-700">
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-neutral-500">{resourceLabel}</dt>
            <dd className="font-medium text-neutral-900">{resourceName}</dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-neutral-500">기간</dt>
            <dd>{periodText}</dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-neutral-500">신청자</dt>
            <dd>{borrowerText}</dd>
          </div>
          {note && (
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <dt className="text-neutral-500">사유</dt>
              <dd>{note}</dd>
            </div>
          )}
          {requiredRoleLabel && (
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <dt className="text-neutral-500">승인 권한</dt>
              <dd className="font-medium text-slate-800">{requiredRoleLabel}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <span className="chip-muted">상태 변경</span>
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as ReservationStatus)
            }
            className="form-select h-[38px] min-w-[140px] text-sm"
            disabled={disableStatusChange}
          >
            {statusOptions.map((value) => (
              <option key={value} value={value} disabled={value === "returned"}>
                {statusLabel[value]}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost" onClick={onClose}>
            창 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
