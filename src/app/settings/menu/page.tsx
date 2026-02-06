"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FeatureSettings from "@/components/settings/FeatureSettings";
import AssetCategoryManager from "@/components/settings/AssetCategoryManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import ManageLayout from "@/components/manage/ManageLayout";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";

export default function MenuSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileData?.organization_id) {
        setLoading(false);
        return;
      }

      // Only admins and managers can access
      const isAuthorized = profileData.role === "admin" || profileData.role === "manager";
      setHasPermission(isAuthorized);
      setOrganizationId(profileData.organization_id);
      setLoading(false);
    };

    checkPermission();
  }, []);

  if (loading) {
    return (
      <Notice>권한을 확인하는 중입니다.</Notice>
    );
  }

  if (!hasPermission) {
    return (
      <Notice variant="warning" className="text-left">
        관리자 또는 매니저만 접근할 수 있습니다.
      </Notice>
    );
  }

  return (
    <ManageLayout>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold">서비스 메뉴 설정</h2>
        <p className="text-sm text-neutral-600 mt-1">
          기관에서 사용할 기능을 활성화/비활성화하고, 메뉴 이름과 순서를 설정할 수 있습니다.
        </p>
      </div>
      <OrganizationGate>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <FeatureSettings organizationId={organizationId} />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <AssetCategoryManager organizationId={organizationId} />
        </div>
      </OrganizationGate>
    </ManageLayout>
  );
}
