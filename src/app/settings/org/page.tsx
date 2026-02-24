"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrganizationManager from "@/components/settings/OrganizationManager";
import OwnershipPolicySettings from "@/components/settings/OwnershipPolicySettings";
import ReturnVerificationPolicySettings from "@/components/settings/ReturnVerificationPolicySettings";
import ApprovalPolicyManager from "@/components/settings/ApprovalPolicyManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import ManageLayout from "@/components/manage/ManageLayout";
import ManageSubmenuLayout from "@/components/manage/ManageSubmenuLayout";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";

type OrganizationSettingsTab =
  | "organization-profile"
  | "approval-policy"
  | "ownership-policy"
  | "return-policy";

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [activeTab, setActiveTab] = useState<OrganizationSettingsTab>("organization-profile");

  useEffect(() => {
    const loadOrganizationId = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      // 관리자 또는 부서 관리자만 접근 가능
      const isAuthorized = profileData?.role === "admin" || profileData?.role === "manager";
      setHasPermission(isAuthorized);

      if (profileData?.organization_id) {
        setOrganizationId(profileData.organization_id);
      }

      setLoading(false);
    };

    loadOrganizationId();
  }, [router]);

  if (loading) {
    return (
      <Notice>권한을 확인하는 중입니다.</Notice>
    );
  }

  if (!hasPermission) {
    return (
      <Notice variant="warning" className="text-left">
        관리자 또는 부서 관리자만 접근할 수 있습니다.
      </Notice>
    );
  }

  return (
    <ManageLayout>
      <PageHero
        className="mb-6"
        title="기관 관리"
        description="기관과 부서를 생성하고, 정책을 관리합니다."
      />
      <ManageSubmenuLayout
        items={[
          { key: "organization-profile", label: "기관/부서 관리" },
          { key: "approval-policy", label: "승인 정책" },
          { key: "ownership-policy", label: "소유 정책" },
          { key: "return-policy", label: "반납 확인 정책" },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
        menuTitle="기관 관리"
      >
        {activeTab === "organization-profile" ? <OrganizationManager /> : null}
        {activeTab === "approval-policy" ? (
          <OrganizationGate>
            <ApprovalPolicyManager />
          </OrganizationGate>
        ) : null}
        {activeTab === "ownership-policy" ? (
          <OrganizationGate>
            <OwnershipPolicySettings organizationId={organizationId} />
          </OrganizationGate>
        ) : null}
        {activeTab === "return-policy" ? (
          <OrganizationGate>
            <ReturnVerificationPolicySettings organizationId={organizationId} />
          </OrganizationGate>
        ) : null}
      </ManageSubmenuLayout>
    </ManageLayout>
  );
}
