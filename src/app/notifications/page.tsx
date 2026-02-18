import NotificationsList from "@/components/notifications/NotificationsList";

export default function NotificationsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white/95 p-6 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">알림</h1>
        <p className="mt-2 text-sm text-neutral-600">
          예약/반납 상태 변경 알림을 확인할 수 있습니다.
        </p>
      </div>
      <NotificationsList />
    </section>
  );
}
