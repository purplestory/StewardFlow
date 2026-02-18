"use client";

import Link from "next/link";
import Image from "next/image";
import {
  formatDateTime,
  getDetailRows,
  getItemStatusLabel,
  getResourcePath,
  getSummaryText,
  getTemplateText,
  getThumbnail,
  getTypeColor,
  getTypeIcon,
  renderTitle,
  type NotificationRow,
} from "@/components/notifications/notification-view-helpers";

type NotificationListItemProps = {
  item: NotificationRow;
  isExpanded: boolean;
  compactView: boolean;
  updating: boolean;
  onToggle: (id: string) => void;
  onMarkAsRead: (id: string) => void;
};

export default function NotificationListItem({
  item,
  isExpanded,
  compactView,
  updating,
  onToggle,
  onMarkAsRead,
}: NotificationListItemProps) {
  const statusLabel = getItemStatusLabel(item);
  const summaryText = getSummaryText(item);
  const templateText = getTemplateText(item);
  const detailRows = getDetailRows(item);
  const hasResource = Boolean((item.payload?.resource_id as string | undefined) || item.type.startsWith("asset_transfer_request"));

  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-all ${
        item.read_at
          ? "border-neutral-200 bg-white"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-start gap-3">
        {getThumbnail(item) ? (
          <Image
            src={getThumbnail(item) ?? ""}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white text-xs text-neutral-500">
            {getTypeIcon(item.type)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-expanded={isExpanded}
            className="flex w-full min-w-0 items-start gap-2 text-left"
          >
            <span className={`mt-[7px] inline-flex h-2 w-2 shrink-0 rounded-full ${getTypeColor(item.type)}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-900 md:text-base">
                {renderTitle(item)}
              </span>
              {summaryText && (
                <span className="mt-1 block truncate text-xs text-neutral-500">
                  {summaryText}
                </span>
              )}
            </span>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{formatDateTime(item.created_at)}</span>
            {!item.read_at && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                미읽음
              </span>
            )}
            <span className="text-neutral-400">{isExpanded ? "접기" : "열기"}</span>
          </div>
          {isExpanded && (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              {!compactView && templateText && (
                <p className="text-sm text-neutral-700">{templateText}</p>
              )}
              <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                <span>{statusLabel.label}:</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusLabel.badgeClass}`}>
                  {statusLabel.value}
                </span>
              </p>
              {!compactView && detailRows.length > 0 && (
                <dl className="mt-3 space-y-1.5 rounded-lg bg-neutral-50 px-3 py-2">
                  {detailRows.map((row) => (
                    <div key={`${item.id}-${row.label}`} className="grid grid-cols-[56px_1fr] items-start gap-2">
                      <dt className="text-xs text-neutral-500">{row.label}</dt>
                      <dd className="text-xs text-neutral-700">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {hasResource && (
                  <Link
                    href={getResourcePath(item)}
                    onClick={() => onMarkAsRead(item.id)}
                    className="btn-primary h-9 px-3 text-xs"
                  >
                    바로가기
                  </Link>
                )}
                {!item.read_at && (
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(item.id)}
                    disabled={updating}
                    className="btn-ghost h-9 px-3 text-xs disabled:opacity-60"
                  >
                    읽음 처리
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
