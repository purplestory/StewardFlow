"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrganizationManager from "@/components/settings/OrganizationManager";
import OwnershipPolicySettings from "@/components/settings/OwnershipPolicySettings";
import ReturnVerificationPolicySettings from "@/components/settings/ReturnVerificationPolicySettings";
import ApprovalPolicyManager from "@/components/settings/ApprovalPolicyManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import ManageLayout from "@/components/manage/ManageLayout";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

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
      <OrganizationManager />
      <OrganizationGate>
        <SectionCard bodyClassName="p-0" className="mb-6">
          <ApprovalPolicyManager />
        </SectionCard>
        <SectionCard bodyClassName="p-0" className="mb-6">
          <OwnershipPolicySettings organizationId={organizationId} />
        </SectionCard>
        <SectionCard bodyClassName="p-0">
          <ReturnVerificationPolicySettings organizationId={organizationId} />
        </SectionCard>
      </OrganizationGate>
    </ManageLayout>
  );
}
