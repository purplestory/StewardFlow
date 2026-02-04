import NotificationsList from "@/components/notifications/NotificationsList";

export default function NotificationsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">알림</h1>
        <p className="mt-2 text-sm text-neutral-600">
          예약/반납 상태 변경 알림을 확인할 수 있습니다.
        </p>
      </div>
      <NotificationsList />
    </section>
  );
}
