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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <div className="mt-4 space-y-2 text-sm text-neutral-700">
          <p>
            <span className="font-medium text-neutral-900">{resourceLabel}:</span>{" "}
            {resourceName}
          </p>
          <p>
            <span className="font-medium text-neutral-900">기간:</span> {periodText}
          </p>
          <p>
            <span className="font-medium text-neutral-900">신청자:</span>{" "}
            {borrowerText}
          </p>
          {note && (
            <p>
              <span className="font-medium text-neutral-900">사유:</span> {note}
            </p>
          )}
          {requiredRoleLabel && (
            <p>
              <span className="font-medium text-neutral-900">승인 필요 권한:</span>{" "}
              {requiredRoleLabel}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-neutral-500">상태</span>
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as ReservationStatus)
            }
            className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
            disabled={disableStatusChange}
          >
            {statusOptions.map((value) => (
              <option key={value} value={value} disabled={value === "returned"}>
                {statusLabel[value]}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
