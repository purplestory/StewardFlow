import OrganizationGate from "@/components/settings/OrganizationGate";
import AuditLogList from "@/components/settings/AuditLogList";

export default function AuditSettingsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">감사 로그</h1>
        <p className="mt-2 text-sm text-neutral-600">
          권한 변경 및 초대 기록을 확인합니다.
        </p>
      </div>
      <OrganizationGate>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <AuditLogList />
        </div>
      </OrganizationGate>
    </section>
  );
}
