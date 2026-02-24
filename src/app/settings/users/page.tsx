"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OrganizationGate from "@/components/settings/OrganizationGate";
import UserRoleManager from "@/components/settings/UserRoleManager";
import AuditLogList from "@/components/settings/AuditLogList";
import ManageLayout from "@/components/manage/ManageLayout";
import ManageSubmenuLayout from "@/components/manage/ManageSubmenuLayout";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

type UserSettingsTab = "user-role" | "audit-log";

export default function UsersSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [activeTab, setActiveTab] = useState<UserSettingsTab>("user-role");

  useEffect(() => {
    const checkPermission = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        router.push("/login");
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // 관리자 또는 부서 관리자만 접근 가능
      const isAuthorized = profileData?.role === "admin" || profileData?.role === "manager";
      setHasPermission(isAuthorized);
      setLoading(false);
    };

    checkPermission();
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
        title="사용자 권한 관리"
        description="기관 내 사용자 초대 및 역할을 관리합니다."
      />
      <OrganizationGate>
        <ManageSubmenuLayout
          items={[
            { key: "user-role", label: "사용자/초대 관리" },
            { key: "audit-log", label: "감사 로그" },
          ]}
          activeKey={activeTab}
          onChange={setActiveTab}
          menuTitle="사용자 관리"
        >
          {activeTab === "user-role" ? <UserRoleManager /> : null}
          {activeTab === "audit-log" ? (
            <SectionCard bodyClassName="p-0">
              <AuditLogList />
            </SectionCard>
          ) : null}
        </ManageSubmenuLayout>
      </OrganizationGate>
    </ManageLayout>
  );
}
