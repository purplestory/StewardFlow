"use client";

import { useEffect, useState } from "react";
import OrganizationManager from "@/components/settings/OrganizationManager";
import PolicySettings from "@/components/settings/PolicySettings";
import OrganizationGate from "@/components/settings/OrganizationGate";
import { supabase } from "@/lib/supabase";

export default function OrganizationSettingsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const loadOrganizationId = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileData?.organization_id) {
          setOrganizationId(profileData.organization_id);
        }
      }
    };

    loadOrganizationId();
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">시스템 설정</h1>
        <p className="mt-2 text-sm text-neutral-600">
          기관을 생성하고, 부서와 멤버를 관리합니다.
        </p>
      </div>
      <OrganizationManager />
      <OrganizationGate>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <PolicySettings organizationId={organizationId} />
        </div>
      </OrganizationGate>
    </section>
  );
}
