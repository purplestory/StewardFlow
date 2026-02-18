import OrganizationGate from "@/components/settings/OrganizationGate";
import AuditLogList from "@/components/settings/AuditLogList";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import ManageLayout from "@/components/manage/ManageLayout";

export default function AuditSettingsPage() {
  return (
    <ManageLayout>
      <PageHero
        title="감사 로그"
        description="권한 변경 및 초대 기록을 확인합니다."
      />
      <OrganizationGate>
        <SectionCard bodyClassName="p-0">
          <AuditLogList />
        </SectionCard>
      </OrganizationGate>
    </ManageLayout>
  );
}
