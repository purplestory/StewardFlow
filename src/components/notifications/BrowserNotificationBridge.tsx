"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type NotificationInsertRow = {
  id: string;
  user_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
};

const permissionRequestStorageKey = "browser_notification_permission_requested";

const typeLabel: Record<string, string> = {
  reservation_created: "새 물품 예약 신청",
  reservation_status_changed: "물품 예약 상태 변경",
  space_reservation_created: "새 공간 예약 신청",
  space_reservation_status_changed: "공간 예약 상태 변경",
  vehicle_reservation_created: "새 차량 예약 신청",
  vehicle_reservation_status_changed: "차량 예약 상태 변경",
  asset_transfer_request_created: "불용품 양도 요청",
  asset_transfer_request_approved: "불용품 양도 요청 승인",
  asset_transfer_request_rejected: "불용품 양도 요청 반려",
  asset_transfer_request_cancelled: "불용품 양도 요청 취소",
};

function toResourcePath(row: NotificationInsertRow): string {
  const payload = row.payload ?? {};
  const resourceId = payload.resource_id as string | undefined;
  const resourceType = payload.resource_type as string | undefined;

  if (row.type.startsWith("asset_transfer_request")) {
    return "/assets/transfers";
  }

  if (!resourceId) {
    return "/notifications";
  }

  if (row.type.startsWith("space")) {
    return `/spaces/${resourceId}`;
  }

  if (row.type.startsWith("vehicle")) {
    return `/vehicles/${resourceId}`;
  }

  if (row.type.startsWith("return")) {
    if (resourceType === "space") return `/spaces/${resourceId}`;
    if (resourceType === "vehicle") return `/vehicles/${resourceId}`;
    return resourceId ? `/assets/${resourceId}` : "/notifications";
  }

  return `/assets/${resourceId}`;
}

function toTitle(row: NotificationInsertRow): string {
  return typeLabel[row.type] ?? "새 알림";
}

function toBody(row: NotificationInsertRow): string {
  const payload = row.payload ?? {};
  const resourceName = payload.resource_name as string | undefined;
  const status = payload.status as string | undefined;

  if (resourceName && status) {
    return `${resourceName} (${status})`;
  }
  if (resourceName) {
    return resourceName;
  }
  return "알림 메뉴에서 상세 내용을 확인해 주세요.";
}

export default function BrowserNotificationBridge() {
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (!window.isSecureContext) return;

    const requestPermissionIfNeeded = async () => {
      if (Notification.permission !== "default") return;
      if (localStorage.getItem(permissionRequestStorageKey) === "1") return;

      localStorage.setItem(permissionRequestStorageKey, "1");
      try {
        await Notification.requestPermission();
      } catch {
        // 일부 브라우저에서 requestPermission이 예외를 던질 수 있음
      }
    };

    const loadSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      userIdRef.current = user?.id ?? null;
      if (user) {
        await requestPermissionIfNeeded();
      }
    };

    void loadSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user ?? null;
        userIdRef.current = user?.id ?? null;
        if (user) {
          void requestPermissionIfNeeded();
        }
      }
    );

    const channel = supabase
      .channel("browser-notification-bridge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const inserted = payload.new as NotificationInsertRow | null;
          if (!inserted) return;
          if (!inserted.user_id || inserted.user_id !== userIdRef.current) return;
          if (Notification.permission !== "granted") return;

          const targetPath = toResourcePath(inserted);
          try {
            const notification = new Notification(toTitle(inserted), {
              body: toBody(inserted),
              icon: "/icon.svg",
              tag: inserted.id,
              data: { path: targetPath },
            });

            notification.onclick = () => {
              window.focus();
              window.location.assign(targetPath);
              notification.close();
            };
          } catch {
            // 브라우저별 Notification 생성 실패는 무시
          }
        }
      )
      .subscribe();

    return () => {
      authSubscription?.subscription?.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
