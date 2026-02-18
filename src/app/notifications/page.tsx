import NotificationsList from "@/components/notifications/NotificationsList";
import PageHero from "@/components/ui/PageHero";

export default function NotificationsPage() {
  return (
    <section className="space-y-6">
      <PageHero
        title="알림"
        description="예약/반납 상태 변경 알림을 확인할 수 있습니다."
      />
      <NotificationsList />
    </section>
  );
}
