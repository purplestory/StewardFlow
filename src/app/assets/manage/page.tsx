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

export default function AssetManagePage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      setOrganizationId(profileData?.organization_id ?? null);
    };

    loadUserData();
  }, []);

  return (
    <ManageLayout>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold">자원 관리</h2>
        <p className="text-sm text-neutral-600 mt-1">
          물품 상태 관리와 예약 승인 처리를 함께 수행합니다.
        </p>
      </div>
      <CategoryTabs />
      <OrganizationGate>
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <AssetAdminPanel />
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <ReservationManager />
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <AssetTransferRequestsBoard />
          </div>
          {organizationId && currentUserId && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <SampleDataGenerator
                organizationId={organizationId}
                userId={currentUserId}
              />
            </div>
          )}
        </div>
      </OrganizationGate>
    </ManageLayout>
  );
}
