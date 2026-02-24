"use client";

import { useMemo, useState } from "react";
import ReservationManager from "@/components/manage/ReservationManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import AssetAdminPanel from "@/components/manage/AssetAdminPanel";
import CategoryTabs from "@/components/manage/CategoryTabs";
import ManageLayout from "@/components/manage/ManageLayout";
import ManageSubmenuLayout from "@/components/manage/ManageSubmenuLayout";
import AssetTransferRequestsBoard from "@/components/assets/AssetTransferRequestsBoard";
import SampleDataGenerator from "@/components/settings/SampleDataGenerator";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import { useUserProfile } from "@/hooks/useAssets";

type AssetManageTab = "asset-admin" | "reservation-approval" | "transfer-requests" | "sample-data";

export default function AssetManagePage() {
  const { data: userProfile, isLoading } = useUserProfile();
  const role = userProfile?.profile?.role ?? null;
  const organizationId = userProfile?.orgId ?? null;
  const currentUserId = userProfile?.user?.id ?? null;
  const hasPermission = role === "admin" || role === "manager";
  const [activeTab, setActiveTab] = useState<AssetManageTab>("asset-admin");
  const hasSampleDataSection = Boolean(organizationId && currentUserId);

  const submenuItems = useMemo(
    () => [
      { key: "asset-admin", label: "물품 관리" },
      { key: "reservation-approval", label: "예약 승인" },
      { key: "transfer-requests", label: "불용품 양도" },
      ...(hasSampleDataSection ? [{ key: "sample-data", label: "샘플 데이터" }] : []),
    ] as Array<{ key: AssetManageTab; label: string }>,
    [hasSampleDataSection]
  );

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
        <ManageSubmenuLayout
          items={submenuItems}
          activeKey={activeTab}
          onChange={setActiveTab}
          menuTitle="자원 관리"
        >
          {activeTab === "asset-admin" ? <AssetAdminPanel /> : null}
          {activeTab === "reservation-approval" ? <ReservationManager /> : null}
          {activeTab === "transfer-requests" ? <AssetTransferRequestsBoard /> : null}
          {activeTab === "sample-data" && organizationId && currentUserId ? (
            <SampleDataGenerator organizationId={organizationId} userId={currentUserId} />
          ) : null}
        </ManageSubmenuLayout>
      </OrganizationGate>
    </ManageLayout>
  );
}
