"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import { emitNotificationBadgeSync } from "@/lib/notification-ui-events";
import NotificationListItem from "@/components/notifications/NotificationListItem";
import NotificationsToolbar from "@/components/notifications/NotificationsToolbar";
import {
  formatGroupDate,
  groupByDate,
  renderPageNumbers,
  type NotificationRow,
} from "@/components/notifications/notification-view-helpers";

type NotificationRealtimeRow = {
  user_id?: string | null;
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "latest" | "unread" | "status"
  >("latest");
  const [compactView, setCompactView] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem("notifications_compact_view") === "true";
  });
  const [totalCount, setTotalCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const userIdRef = useRef<string | null>(null);

  const resetFilters = () => {
    setShowUnreadOnly(false);
    setTypeFilter("all");
    setStatusFilter("all");
    setQuery("");
    setSortOrder("latest");
    setPage(1);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const getAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setNotifications([]);
      setTotalCount(0);
      setUnreadTotal(0);
      emitNotificationBadgeSync(0);
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
      setExpandedIds([]);
    } else {
      setNotifications((data ?? []) as NotificationRow[]);
      setTotalCount(count ?? 0);
      const loadedIds = new Set((data ?? []).map((item) => (item as NotificationRow).id));
      setExpandedIds((prev) => prev.filter((id) => loadedIds.has(id)));
    }

    const nextUnreadCount = unreadCount ?? 0;
    setUnreadTotal(nextUnreadCount);
    emitNotificationBadgeSync(nextUnreadCount);

    setLoading(false);
  }, [page, pageSize, query, showUnreadOnly, sortOrder, statusFilter, typeFilter]);

  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => {
      void loadRef.current();
    }, 0);

    const channel = supabase
      .channel("notifications-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const newRecord = payload.new as NotificationRealtimeRow | null;
          const oldRecord = payload.old as NotificationRealtimeRow | null;
          const affectedUserId = newRecord?.user_id ?? oldRecord?.user_id;
          if (affectedUserId && affectedUserId === userIdRef.current) {
            void loadRef.current();
          }
        }
      )
      .subscribe();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => {
      void loadRef.current();
    });

    return () => {
      clearTimeout(initialLoadTimer);
      supabase.removeChannel(channel);
      authSubscription?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("notifications_compact_view", String(compactView));
  }, [compactView]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const markAsRead = async (id: string) => {
    if (updating) return;
    setUpdating(true);
    setMessage(null);
    const existingNotification = notifications.find((item) => item.id === id);
    const shouldDecreaseUnread = Boolean(existingNotification && !existingNotification.read_at);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMessage("로그인이 필요합니다.");
      setUpdating(false);
      return;
    }

    const response = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        notificationId: id,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setMessage(result?.message ?? "읽음 처리에 실패했습니다.");
      setUpdating(false);
      return;
    }
    if (shouldDecreaseUnread && result.updatedCount === 0) {
      setMessage("읽음 처리 반영에 실패했습니다. 다시 시도해 주세요.");
      setUpdating(false);
      void loadRef.current();
      return;
    }

    const readAt = (result.readAt as string | undefined) ?? new Date().toISOString();

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read_at: readAt } : item
      )
    );
    if (typeof result.unreadCount === "number") {
      setUnreadTotal(result.unreadCount);
      emitNotificationBadgeSync(result.unreadCount);
    } else if (shouldDecreaseUnread) {
      setUnreadTotal((prev) => {
        const next = Math.max(0, prev - 1);
        emitNotificationBadgeSync(next);
        return next;
      });
    }
    setUpdating(false);
    void loadRef.current();
  };

  const markAllAsRead = async () => {
    setUpdating(true);
    setMessage(null);

    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) {
      setUpdating(false);
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMessage("로그인이 필요합니다.");
      setUpdating(false);
      return;
    }

    const response = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        markAll: true,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setMessage(result?.message ?? "전체 읽음 처리에 실패했습니다.");
      setUpdating(false);
      return;
    }
    if (unreadIds.length > 0 && result.updatedCount === 0) {
      setMessage("전체 읽음 처리 반영에 실패했습니다. 다시 시도해 주세요.");
      setUpdating(false);
      void loadRef.current();
      return;
    }

    const readAt = (result.readAt as string | undefined) ?? new Date().toISOString();

    setNotifications((prev) =>
      prev.map((item) =>
        unreadIds.includes(item.id)
          ? { ...item, read_at: readAt }
          : item
      )
    );
    if (typeof result.unreadCount === "number") {
      setUnreadTotal(result.unreadCount);
      emitNotificationBadgeSync(result.unreadCount);
    } else {
      setUnreadTotal((prev) => {
        const next = Math.max(0, prev - unreadIds.length);
        emitNotificationBadgeSync(next);
        return next;
      });
    }
    setUpdating(false);
    void loadRef.current();
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
      <NotificationsToolbar
        unreadCount={unreadCount}
        updating={updating}
        showUnreadOnly={showUnreadOnly}
        setShowUnreadOnly={setShowUnreadOnly}
        markAllAsRead={markAllAsRead}
        load={load}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        compactView={compactView}
        setCompactView={setCompactView}
        query={query}
        setQuery={setQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        pageSize={pageSize}
        setPageSize={setPageSize}
        setPage={setPage}
      />
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
            <NotificationListItem
              key={item.id}
              item={item}
              isExpanded={expandedIds.includes(item.id)}
              compactView={compactView}
              updating={updating}
              onToggle={toggleExpanded}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
