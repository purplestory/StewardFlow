"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type NotificationRow = {
  id: string;
  type: string;
  status: "pending" | "sent" | "failed";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const typeLabel: Record<string, string> = {
  reservation_created: "물품 예약 신청",
  reservation_status_changed: "물품 예약 상태 변경",
  space_reservation_created: "공간 예약 신청",
  space_reservation_status_changed: "공간 예약 상태 변경",
  asset_transfer_request_created: "불용품 양도 요청",
  asset_transfer_request_approved: "불용품 양도 요청 승인",
  asset_transfer_request_rejected: "불용품 양도 요청 거절",
  asset_transfer_request_cancelled: "불용품 양도 요청 취소",
};

export default function NotificationsList() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<
    "latest" | "unread" | "status"
  >("latest");
  const [compactView, setCompactView] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const userIdRef = useRef<string | null>(null);

  const resetFilters = () => {
    setShowUnreadOnly(false);
    setTypeFilter("all");
    setStatusFilter("all");
    setQuery("");
    setSortOrder("latest");
    setPage(1);
  };

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setNotifications([]);
      setLoading(false);
      userIdRef.current = null;
      return;
    }

    userIdRef.current = user.id;

    let queryBuilder = supabase
      .from("notifications")
      .select("id,type,status,payload,read_at,created_at", { count: "exact" })
      .eq("user_id", user.id);

    if (showUnreadOnly) {
      queryBuilder = queryBuilder.is("read_at", null);
    }

    if (typeFilter !== "all") {
      queryBuilder = queryBuilder.eq("type", typeFilter);
    }

    if (statusFilter !== "all") {
      queryBuilder = queryBuilder.eq("status", statusFilter);
    }

    if (query.trim()) {
      const normalized = `%${query.trim()}%`;
      queryBuilder = queryBuilder.or(
        `payload->>resource_name.ilike.${normalized},payload->>resource_id.ilike.${normalized},payload->>start_date.ilike.${normalized},payload->>end_date.ilike.${normalized},type.ilike.${normalized},status.ilike.${normalized}`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const listQuery = queryBuilder
      .order("read_at", { ascending: sortOrder !== "unread" })
      .order("status", { ascending: sortOrder === "status" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const unreadQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    const [{ data, error, count }, { count: unreadCount }] = await Promise.all([
      listQuery,
      unreadQuery,
    ]);

    if (error) {
      setMessage(error.message);
      setNotifications([]);
    } else {
      setNotifications((data ?? []) as NotificationRow[]);
      setTotalCount(count ?? 0);
    }

    setUnreadTotal(unreadCount ?? 0);

    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    load().finally(() => {
      if (!isMounted) return;
    });

    const channel = supabase
      .channel("notifications-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          if (
            payload.new &&
            payload.new.user_id &&
            payload.new.user_id === userIdRef.current
          ) {
            load();
          }
        }
      )
      .subscribe();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      authSubscription?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("notifications_compact_view");
    if (saved === "true") {
      setCompactView(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("notifications_compact_view", String(compactView));
  }, [compactView]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, typeFilter, statusFilter, showUnreadOnly, query, sortOrder]);

  useEffect(() => {
    load();
  }, [page, pageSize, typeFilter, statusFilter, showUnreadOnly]);

  const markAsRead = async (id: string) => {
    if (updating) return;
    setUpdating(true);
    setMessage(null);

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read_at: new Date().toISOString() } : item
      )
    );
    setUpdating(false);
  };

  const markAllAsRead = async () => {
    setUpdating(true);
    setMessage(null);

    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) {
      setUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) =>
        unreadIds.includes(item.id)
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    );
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-neutral-100" />
                <div className="h-3 w-2/3 rounded bg-neutral-100" />
              </div>
            </div>
            <div className="mt-3 h-3 w-1/3 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    );
  }

  if (message) {
    return (
      <Notice variant="error">{message}</Notice>
    );
  }

  if (notifications.length === 0) {
    return (
      <Notice>
        <p>표시할 알림이 없습니다. 필터를 초기화해 보세요.</p>
        <button
          type="button"
          onClick={resetFilters}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
        >
          필터 초기화
        </button>
      </Notice>
    );
  }

  const unreadCount = unreadTotal;
  const visibleNotifications = notifications;
  const sortedNotifications = visibleNotifications;
  const totalPages =
    query.trim().length > 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sortedNotifications;
  const grouped = groupByDate(paginated);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-neutral-600">
            미읽음 {unreadCount}건
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
            >
              새로고침
            </button>
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(event) => setShowUnreadOnly(event.target.checked)}
              />
              미읽음만 보기
            </label>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={updating || unreadCount === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
            >
              모두 읽음 처리
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(
                event.target.value as "latest" | "unread" | "status"
              )
            }
          >
            <option value="latest">최신순</option>
            <option value="unread">미읽음 우선</option>
            <option value="status">상태 우선</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={compactView}
              onChange={(event) => setCompactView(event.target.checked)}
            />
            컴팩트 보기
          </label>
          <input
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
            placeholder="검색어 입력"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">전체 유형</option>
            <option value="reservation_created">물품 예약 신청</option>
            <option value="reservation_status_changed">물품 예약 상태 변경</option>
            <option value="space_reservation_created">공간 예약 신청</option>
            <option value="space_reservation_status_changed">
              공간 예약 상태 변경
            </option>
            <option value="asset_transfer_request_created">불용품 양도 요청</option>
            <option value="asset_transfer_request_approved">불용품 양도 요청 승인</option>
            <option value="asset_transfer_request_rejected">불용품 양도 요청 거절</option>
            <option value="asset_transfer_request_cancelled">불용품 양도 요청 취소</option>
          </select>
          <select
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="pending">대기</option>
            <option value="sent">발송 완료</option>
            <option value="failed">실패</option>
          </select>
          <select
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            <option value={5}>5개씩</option>
            <option value={10}>10개씩</option>
            <option value={20}>20개씩</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {safePage} / {totalPages} 페이지
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage === 1}
            className="rounded-md border border-neutral-200 px-2 py-1 disabled:opacity-50"
          >
            이전
          </button>
          {renderPageNumbers(totalPages, safePage).map((entry) =>
            entry.type === "ellipsis" ? (
              <span key={entry.key} className="px-2 py-1 text-neutral-400">
                …
              </span>
            ) : (
              <button
                key={entry.key}
                type="button"
                onClick={() => setPage(entry.page)}
                className={`rounded-md border px-2 py-1 ${
                  entry.page === safePage
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200"
                }`}
              >
                {entry.page}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage === totalPages}
            className="rounded-md border border-neutral-200 px-2 py-1 disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>
      {grouped.map((group) => (
        <div key={group.date} className="space-y-2">
          <div className="text-xs font-semibold text-neutral-500">
            {formatGroupDate(group.date)}
          </div>
          {group.items.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border px-4 py-3 ${
                item.read_at
                  ? "border-neutral-200 bg-white"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
          <div className="flex items-start gap-3">
            {getThumbnail(item) ? (
              <Link href={getResourcePath(item)}>
                <img
                  src={getThumbnail(item) ?? ""}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />
              </Link>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 text-xs text-neutral-400">
                없음
              </div>
            )}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${getTypeColor(item.type)}`}
                />
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 text-[10px] text-neutral-600">
                  {getTypeIcon(item.type)}
                </span>
                {renderTitle(item)}
              </p>
                  {!compactView && renderTemplateMessage(item)}
                  {!compactView && renderSummary(item)}
            </div>
          </div>
          <p className="text-xs text-neutral-500 flex items-center gap-2">
            <span>상태:</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${getStatusBadge(
                item.status
              )}`}
            >
              {statusLabel[item.status]}
            </span>
            <span>· {formatDateTime(item.created_at)}</span>
          </p>
              {!compactView && renderNotificationDetail(item)}
              {!compactView && item.payload && (
                <details className="mt-2 rounded bg-neutral-50 p-2 text-xs text-neutral-600">
                  <summary className="cursor-pointer">상세 보기</summary>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </details>
              )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {item.payload?.resource_id && (
              <Link
                href={getResourcePath(item)}
                onClick={() => markAsRead(item.id)}
                className="rounded-md bg-neutral-900 px-3 py-1 text-white"
              >
                바로가기
              </Link>
            )}
            {!item.read_at && (
              <button
                type="button"
                onClick={() => markAsRead(item.id)}
                disabled={updating}
                className="rounded-md border border-neutral-200 px-2 py-1"
              >
                읽음 처리
              </button>
            )}
          </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const renderNotificationDetail = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const startDate = payload.start_date as string | undefined;
  const endDate = payload.end_date as string | undefined;

  if (startDate && endDate) {
    return (
      <p className="mt-1 text-xs text-neutral-500">
        기간: {startDate} ~ {endDate}
      </p>
    );
  }

  return null;
};

const renderSummary = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const startDate = payload.start_date as string | undefined;
  const endDate = payload.end_date as string | undefined;
  const status = payload.status as string | undefined;
  const resourceId = payload.resource_id as string | undefined;
  const resourceName = payload.resource_name as string | undefined;
  const fromDepartment = payload.from_department as string | undefined;
  const toDepartment = payload.to_department as string | undefined;
  const note = payload.note as string | undefined;

  const parts: string[] = [];

  if (resourceName) {
    parts.push(`대상: ${resourceName}`);
  } else if (resourceId) {
    parts.push(`예약 ID: ${resourceId}`);
  }

  if (startDate && endDate) {
    parts.push(`기간 ${formatDateTime(startDate)} ~ ${formatDateTime(endDate)}`);
  }

  if (status) {
    parts.push(`상태 ${reservationStatusLabel[status] ?? status}`);
  }

  if (fromDepartment || toDepartment) {
    parts.push(
      `이동 ${fromDepartment ?? "미등록"} → ${toDepartment ?? "미등록"}`
    );
  }

  if (note) {
    parts.push(`사유 ${truncateText(note, 40)}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return <p className="text-xs text-neutral-500">{parts.join(" · ")}</p>;
};

const renderTemplateMessage = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const resourceName = (payload.resource_name as string | undefined) ?? "대상";
  const status = payload.status as string | undefined;
  const fromDepartment = payload.from_department as string | undefined;
  const toDepartment = payload.to_department as string | undefined;
  const moveSummary =
    fromDepartment || toDepartment
      ? `(${fromDepartment ?? "미등록"} → ${toDepartment ?? "미등록"})`
      : "";
  const statusText = status
    ? reservationStatusLabel[status] ?? status
    : null;

  if (item.type === "reservation_created") {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 물품 예약이 접수되었습니다.
      </p>
    );
  }

  if (item.type === "space_reservation_created") {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 공간 예약이 접수되었습니다.
      </p>
    );
  }

  if (item.type === "reservation_status_changed" && statusText) {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 예약 상태가 {statusText}(으)로 변경되었습니다.
      </p>
    );
  }

  if (item.type === "space_reservation_status_changed" && statusText) {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 예약 상태가 {statusText}(으)로 변경되었습니다.
      </p>
    );
  }

  if (item.type === "asset_transfer_request_created") {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 불용품 양도 요청이 등록되었습니다. {moveSummary}
      </p>
    );
  }

  if (item.type === "asset_transfer_request_approved") {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 불용품 양도 요청이 승인되었습니다. {moveSummary}
      </p>
    );
  }

  if (item.type === "asset_transfer_request_rejected") {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 불용품 양도 요청이 거절되었습니다. {moveSummary}
      </p>
    );
  }

  if (item.type === "asset_transfer_request_cancelled") {
    return (
      <p className="text-xs text-neutral-600">
        {resourceName} 불용품 양도 요청이 취소되었습니다. {moveSummary}
      </p>
    );
  }

  return null;
};

const groupByDate = (items: NotificationRow[]) => {
  const groups = new Map<string, NotificationRow[]>();

  items.forEach((item) => {
    const dateKey = item.created_at.split("T")[0];
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(item);
    groups.set(dateKey, bucket);
  });

  return Array.from(groups.entries()).map(([date, values]) => ({
    date,
    items: values,
  }));
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatGroupDate = (value: string) => {
  const today = new Date();
  const target = new Date(value);

  if (Number.isNaN(target.getTime())) {
    return value;
  }

  const toKey = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const diffDays = Math.floor(
    (toKey(today) - toKey(target)) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return "최근 7일";

  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(
    target
  );
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
};

const renderTitle = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const status = payload.status as string | undefined;
  const resourceName = payload.resource_name as string | undefined;
  const title = typeLabel[item.type] ?? "알림";

  if (resourceName && status) {
    return `${title}: ${resourceName} (${statusLabel[status as NotificationRow["status"]] ?? status})`;
  }

  if (resourceName) {
    return `${title}: ${resourceName}`;
  }

  if (status) {
    return `${title} (${status})`;
  }

  return title;
};


const getThumbnail = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  return (payload.resource_image_url as string | undefined) ?? null;
};

const getTypeColor = (type: string) => {
  if (type === "reservation_created") return "bg-blue-500";
  if (type === "reservation_status_changed") return "bg-indigo-500";
  if (type === "space_reservation_created") return "bg-emerald-500";
  if (type === "space_reservation_status_changed") return "bg-amber-500";
  if (type.startsWith("asset_transfer_request")) return "bg-fuchsia-500";
  return "bg-neutral-400";
};

const renderPageNumbers = (totalPages: number, current: number) => {
  const pages: Array<
    { type: "page"; page: number; key: string } | { type: "ellipsis"; key: string }
  > = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) {
      pages.push({ type: "page", page: i, key: `page-${i}` });
    }
    return pages;
  }

  pages.push({ type: "page", page: 1, key: "page-1" });

  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);

  if (left > 2) {
    pages.push({ type: "ellipsis", key: "ellipsis-left" });
  }

  for (let i = left; i <= right; i += 1) {
    pages.push({ type: "page", page: i, key: `page-${i}` });
  }

  if (right < totalPages - 1) {
    pages.push({ type: "ellipsis", key: "ellipsis-right" });
  }

  pages.push({
    type: "page",
    page: totalPages,
    key: `page-${totalPages}`,
  });

  return pages;
};

const getResourcePath = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const resourceId = payload.resource_id as string | undefined;

  if (item.type.startsWith("asset_transfer_request")) {
    return "/assets/transfers";
  }

  if (!resourceId) {
    return "/notifications";
  }

  if (item.type.startsWith("space")) {
    return `/spaces/${resourceId}`;
  }

  return `/assets/${resourceId}`;
};

const getTypeIcon = (type: string) => {
  if (type.startsWith("space")) return "S";
  if (type.startsWith("reservation")) return "A";
  if (type.startsWith("asset_transfer_request")) return "T";
  return "?";
};

const statusLabel: Record<NotificationRow["status"], string> = {
  pending: "대기",
  sent: "발송 완료",
  failed: "실패",
};

const reservationStatusLabel: Record<string, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려됨",
};

const getStatusBadge = (status: NotificationRow["status"]) => {
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "sent") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  return "bg-neutral-100 text-neutral-700";
};
