const NOTIFICATION_BADGE_SYNC_EVENT = "notifications:badge-sync";

type NotificationBadgeSyncDetail = {
  count?: number;
};

export function emitNotificationBadgeSync(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationBadgeSyncDetail>(NOTIFICATION_BADGE_SYNC_EVENT, {
      detail: { count },
    })
  );
}

export function addNotificationBadgeSyncListener(
  listener: (count?: number) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<NotificationBadgeSyncDetail>;
    listener(customEvent.detail?.count);
  };

  window.addEventListener(NOTIFICATION_BADGE_SYNC_EVENT, handler);
  return () => {
    window.removeEventListener(NOTIFICATION_BADGE_SYNC_EVENT, handler);
  };
}
