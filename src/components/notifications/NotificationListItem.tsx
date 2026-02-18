"use client";

import Link from "next/link";
import Image from "next/image";
import {
  formatDateTime,
  getItemStatusLabel,
  getResourcePath,
  getThumbnail,
  getTypeColor,
  getTypeIcon,
  renderNotificationDetail,
  renderSummary,
  renderTemplateMessage,
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

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        item.read_at ? "border-neutral-200 bg-white" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {getThumbnail(item) ? (
          <Image
            src={getThumbnail(item) ?? ""}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-lg object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 text-xs text-neutral-400">
            없음
          </div>
        )}
        <div className="flex-1">
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className="flex w-full items-start gap-2 text-left"
          >
            <span className={`mt-1 inline-flex h-2 w-2 rounded-full ${getTypeColor(item.type)}`} />
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-[10px] text-neutral-600">
              {getTypeIcon(item.type)}
            </span>
            <span className="text-sm font-medium text-neutral-900">{renderTitle(item)}</span>
            <span className="ml-auto shrink-0 text-xs text-neutral-500">
              {formatDateTime(item.created_at)}
            </span>
            <span className="shrink-0 text-xs text-neutral-500">{isExpanded ? "▲" : "▼"}</span>
          </button>
          {isExpanded && (
            <div className="mt-2 space-y-2">
              {!compactView && renderTemplateMessage(item)}
              {!compactView && renderSummary(item)}
              <p className="text-xs text-neutral-500 flex items-center gap-2">
                <span>{statusLabel.label}:</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusLabel.badgeClass}`}>
                  {statusLabel.value}
                </span>
              </p>
              {!compactView && renderNotificationDetail(item)}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {(item.payload?.resource_id as string | undefined) && (
                  <Link
                    href={getResourcePath(item)}
                    onClick={() => onMarkAsRead(item.id)}
                    className="rounded-md bg-neutral-900 px-3 py-1 text-white"
                  >
                    바로가기
                  </Link>
                )}
                {!item.read_at && (
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(item.id)}
                    disabled={updating}
                    className="rounded-md border border-neutral-200 px-2 py-1"
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
