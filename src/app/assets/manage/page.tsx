"use client";

import ReservationManager from "@/components/manage/ReservationManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import AssetAdminPanel from "@/components/manage/AssetAdminPanel";
import CategoryTabs from "@/components/manage/CategoryTabs";
import ManageLayout from "@/components/manage/ManageLayout";
import AssetTransferRequestsBoard from "@/components/assets/AssetTransferRequestsBoard";
import SampleDataGenerator from "@/components/settings/SampleDataGenerator";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import { useUserProfile } from "@/hooks/useAssets";

export default function AssetManagePage() {
  const { data: userProfile, isLoading } = useUserProfile();
  const role = userProfile?.profile?.role ?? null;
  const organizationId = userProfile?.orgId ?? null;
  const currentUserId = userProfile?.user?.id ?? null;
  const hasPermission = role === "admin" || role === "manager";

  if (isLoading && !userProfile) {
    return (
      <ManageLayout>
        <Notice>권한을 확인하는 중입니다.</Notice>
      </ManageLayout>
    );
  }

  if (!hasPermission) {
    return (
      <ManageLayout>
        <Notice variant="warning" className="text-left">
          관리자 또는 부서 관리자만 접근할 수 있습니다.
        </Notice>
      </ManageLayout>
    );
  }

  return (
    <ManageLayout>
      <PageHero
        className="mb-6"
        title="자원 관리"
        description="물품 상태 관리와 예약 승인 처리를 함께 수행합니다."
      />
      <CategoryTabs />
      <OrganizationGate>
        <div className="space-y-6">
          <AssetAdminPanel />
          <ReservationManager />
          <AssetTransferRequestsBoard />
          {organizationId && currentUserId && (
            <SampleDataGenerator
              organizationId={organizationId}
              userId={currentUserId}
            />
          )}
        </div>
      </OrganizationGate>
    </ManageLayout>
  );
}
