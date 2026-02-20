"use client";

import { useEffect, useState } from "react";
import FeatureSettings from "@/components/settings/FeatureSettings";
import AssetCategoryManager from "@/components/settings/AssetCategoryManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import ManageLayout from "@/components/manage/ManageLayout";
import ManageSubmenuLayout from "@/components/manage/ManageSubmenuLayout";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
import PageHero from "@/components/ui/PageHero";

type MenuSettingsTab = "features" | "categories";

export default function MenuSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MenuSettingsTab>("features");

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
      <PageHero
        className="mb-6"
        title="서비스 메뉴 설정"
        description="기관에서 사용할 기능을 활성화/비활성화하고, 메뉴 이름과 순서를 설정할 수 있습니다."
      />
      <OrganizationGate>
        <ManageSubmenuLayout
          items={[
            { key: "features", label: "기능 및 메뉴" },
            { key: "categories", label: "물품 카테고리" },
          ]}
          activeKey={activeTab}
          onChange={setActiveTab}
          menuTitle="메뉴 관리"
        >
          {activeTab === "features" ? (
            <FeatureSettings organizationId={organizationId} />
          ) : null}
          {activeTab === "categories" ? (
            <AssetCategoryManager organizationId={organizationId} />
          ) : null}
        </ManageSubmenuLayout>
      </OrganizationGate>
    </ManageLayout>
  );
}
