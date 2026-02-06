"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";

type OrganizationGateProps = {
  children: React.ReactNode;
};

// 권한 정보를 전역적으로 캐시 (탭 이동 시 재사용)
let cachedOrgGate: { 
  hasOrganization: boolean; 
  isAuthenticated: boolean; 
  checked: boolean;
  userId: string | null;
} = {
  hasOrganization: false,
  isAuthenticated: false,
  checked: false,
  userId: null,
};

export default function OrganizationGate({ children }: OrganizationGateProps) {
  const [hasOrganization, setHasOrganization] = useState(cachedOrgGate.hasOrganization);
  const [isAuthenticated, setIsAuthenticated] = useState(cachedOrgGate.isAuthenticated);
  const [isChecking, setIsChecking] = useState(!cachedOrgGate.checked);

  useEffect(() => {
    // 이미 캐시된 정보가 있고 같은 사용자면 즉시 사용
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const user = sessionData.session?.user ?? null;
      
      if (cachedOrgGate.checked && cachedOrgGate.userId === user?.id) {
        setHasOrganization(cachedOrgGate.hasOrganization);
        setIsAuthenticated(cachedOrgGate.isAuthenticated);
        setIsChecking(false);
        return;
      }
    });

    let isMounted = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        if (isMounted) {
          cachedOrgGate = {
            hasOrganization: false,
            isAuthenticated: false,
            checked: true,
            userId: null,
          };
          setHasOrganization(false);
          setIsAuthenticated(false);
          setIsChecking(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("OrganizationGate - Profile load error:", error);
      }

      if (!isMounted) return;

      const hasOrg = Boolean(data?.organization_id);
      
      // 캐시에 저장
      cachedOrgGate = {
        hasOrganization: hasOrg,
        isAuthenticated: true,
        checked: true,
        userId: user.id,
      };

      setHasOrganization(hasOrg);
      setIsAuthenticated(true);
      setIsChecking(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  // 로딩 중일 때는 로딩 메시지를 표시하지 않고 컨텐츠를 표시
  if (isChecking) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <Notice variant="warning" className="text-left">
        로그인 후 이용할 수 있습니다.{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
        으로 이동해 주세요.
      </Notice>
    );
  }

  if (!hasOrganization) {
    return (
      <Notice variant="warning" className="text-left">
        관리자 승인이 필요합니다. 초대코드 없이 가입하신 경우, 최고관리자가 승인할 때까지 메인 페이지만 이용하실 수 있습니다.
      </Notice>
    );
  }

  return <>{children}</>;
}
