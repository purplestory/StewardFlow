"use client";

import { useEffect, useState } from "react";
import ReservationManager from "@/components/manage/ReservationManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import AssetAdminPanel from "@/components/manage/AssetAdminPanel";
import CategoryTabs from "@/components/manage/CategoryTabs";
import ManageLayout from "@/components/manage/ManageLayout";
import AssetTransferRequestsBoard from "@/components/assets/AssetTransferRequestsBoard";
import SampleDataGenerator from "@/components/settings/SampleDataGenerator";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

export default function AssetManagePage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      
      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      setOrganizationId(profileData?.organization_id ?? null);

      // 관리자 또는 부서 관리자만 접근 가능
      const isAuthorized = profileData?.role === "admin" || profileData?.role === "manager";
      setHasPermission(isAuthorized);
      setLoading(false);
    };

    loadUserData();
  }, []);

  if (loading) {
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
          <SectionCard bodyClassName="p-0">
            <AssetAdminPanel />
          </SectionCard>
          <SectionCard bodyClassName="p-0">
            <ReservationManager />
          </SectionCard>
          <SectionCard bodyClassName="p-0">
            <AssetTransferRequestsBoard />
          </SectionCard>
          {organizationId && currentUserId && (
            <SectionCard bodyClassName="p-0">
              <SampleDataGenerator
                organizationId={organizationId}
                userId={currentUserId}
              />
            </SectionCard>
          )}
        </div>
      </OrganizationGate>
    </ManageLayout>
  );
}
