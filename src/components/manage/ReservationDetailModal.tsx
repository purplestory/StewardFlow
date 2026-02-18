"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader className="flex flex-row items-start justify-between gap-3">
          <DialogTitle className="text-xl tracking-tight">{title}</DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              닫기
            </button>
          </DialogClose>
        </DialogHeader>
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

        <DialogFooter className="mt-5 flex-wrap items-center gap-2">
          <span className="chip-muted">상태 변경</span>
          <Select
            value={status}
            onValueChange={(nextStatus) => onStatusChange(nextStatus as ReservationStatus)}
            disabled={disableStatusChange}
          >
            <SelectTrigger className="form-select h-[38px] min-w-[140px] text-sm">
              <SelectContent>
                {statusOptions.map((value) => (
                  <SelectItem key={value} value={value} disabled={value === "returned"}>
                    {statusLabel[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectTrigger>
          </Select>
          <DialogClose asChild>
            <button type="button" className="btn-ghost">
              창 닫기
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
