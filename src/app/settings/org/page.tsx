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
      <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold">기관 및 부서관리</h2>
        <p className="text-sm text-neutral-600 mt-1">
          기관과 부서를 생성하고, 정책을 관리합니다.
        </p>
      </div>
      <OrganizationManager />
      <OrganizationGate>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
          <ApprovalPolicyManager />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
          <OwnershipPolicySettings organizationId={organizationId} />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <ReturnVerificationPolicySettings organizationId={organizationId} />
        </div>
      </OrganizationGate>
    </ManageLayout>
  );
}
