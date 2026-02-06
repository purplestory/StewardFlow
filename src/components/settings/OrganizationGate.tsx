"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";

type OrganizationGateProps = {
  children: React.ReactNode;
};

export default function OrganizationGate({ children }: OrganizationGateProps) {
  const [loading, setLoading] = useState(true);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        if (isMounted) {
          setHasOrganization(false);
          setIsAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      console.log("OrganizationGate - Profile query result:", {
        user_id: user.id,
        data,
        error,
        hasData: !!data,
        hasError: !!error,
        organization_id: data?.organization_id,
      });

      if (error) {
        console.error("OrganizationGate - Profile load error:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      }

      if (!isMounted) return;

      setHasOrganization(Boolean(data?.organization_id));
      setIsAuthenticated(true);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Notice>기관 정보를 확인하는 중입니다.</Notice>
    );
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
