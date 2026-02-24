"use client";

import { useState } from "react";
import ReservationManager from "@/components/manage/SpaceReservationManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import SpaceAdminPanel from "@/components/manage/SpaceAdminPanel";
import CategoryTabs from "@/components/manage/CategoryTabs";
import ManageLayout from "@/components/manage/ManageLayout";
import ManageSubmenuLayout from "@/components/manage/ManageSubmenuLayout";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import { useUserProfile } from "@/hooks/useAssets";

type SpaceManageTab = "space-admin" | "reservation-approval";

export default function SpaceManagePage() {
  const { data: userProfile, isLoading } = useUserProfile();
  const role = userProfile?.profile?.role ?? null;
  const hasPermission = role === "admin" || role === "manager";
  const [activeTab, setActiveTab] = useState<SpaceManageTab>("space-admin");

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
        description="공간 상태 관리와 예약 승인 처리를 함께 수행합니다."
      />
      <CategoryTabs />
      <OrganizationGate>
        <ManageSubmenuLayout
          items={[
            { key: "space-admin", label: "공간 관리" },
            { key: "reservation-approval", label: "예약 승인" },
          ]}
          activeKey={activeTab}
          onChange={setActiveTab}
          menuTitle="자원 관리"
        >
          {activeTab === "space-admin" ? <SpaceAdminPanel /> : null}
          {activeTab === "reservation-approval" ? <ReservationManager /> : null}
        </ManageSubmenuLayout>
      </OrganizationGate>
    </ManageLayout>
  );
}
