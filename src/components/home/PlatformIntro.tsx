"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
};

export default function PlatformIntro() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [features, setFeatures] = useState<OrganizationFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      setIsAuthenticated(!!user);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileData?.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("features")
            .eq("id", profileData.organization_id)
            .maybeSingle();

          if (orgData) {
            setFeatures({
              equipment: orgData.features?.equipment ?? true,
              spaces: orgData.features?.spaces ?? true,
              vehicles: orgData.features?.vehicles ?? false,
            });
          }
        }
      }

      setLoading(false);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      if (session?.user) {
        checkAuth();
      } else {
        setFeatures(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleCategoryClick = (category: "assets" | "spaces" | "vehicles") => {
    if (isAuthenticated && features) {
      if (category === "assets" && features.equipment !== false) {
        router.push("/assets");
      } else if (category === "spaces" && features.spaces !== false) {
        router.push("/spaces");
      } else if (category === "vehicles" && features.vehicles === true) {
        router.push("/vehicles");
      }
    }
  };

  const isCategoryEnabled = (category: "assets" | "spaces" | "vehicles") => {
    if (!isAuthenticated || !features) return false;
    if (category === "assets") return features.equipment !== false;
    if (category === "spaces") return features.spaces !== false;
    if (category === "vehicles") return features.vehicles === true;
    return false;
  };
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-neutral-900">
          교회 자원 관리 시스템
        </h1>
        <p className="text-2xl text-neutral-700">Steward Flow</p>
        <p className="text-neutral-500 max-w-2xl mx-auto">
          물품, 공간, 차량을 통합 관리하고 효율적으로 공유하는 스튜어드십 플랫폼
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        {/* 물품 관리 */}
        <div
          onClick={() => handleCategoryClick("assets")}
          className={`rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 ${
            isCategoryEnabled("assets")
              ? "cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
              : ""
          }`}
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">물품</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            교회 부서의 보유 물품을 등록하고 공유할 수 있도록 지원합니다
          </p>
        </div>

        {/* 공간 관리 */}
        <div
          onClick={() => handleCategoryClick("spaces")}
          className={`rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 ${
            isCategoryEnabled("spaces")
              ? "cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
              : ""
          }`}
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">공간</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            예배와 모임을 위한 공간 예약을 체계적으로 관리하고 충돌을 방지합니다
          </p>
        </div>

        {/* 차량 관리 */}
        <div
          onClick={() => handleCategoryClick("vehicles")}
          className={`rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 ${
            isCategoryEnabled("vehicles")
              ? "cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
              : ""
          }`}
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">차량</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            교회 차량 사용 신청과 반납, 주행거리와 차량 상태를 관리합니다
          </p>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-8 mt-12">
        <h2 className="text-2xl font-semibold text-center mb-6 text-neutral-900">
          주요 기능
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">통합 관리</h3>
              <p className="text-sm text-neutral-600">
                물품, 공간, 차량을 하나의 플랫폼에서 통합 관리
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">실시간 예약</h3>
              <p className="text-sm text-neutral-600">
                실시간 예약 시스템으로 충돌 없이 자원을 공유
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">안전한 관리</h3>
              <p className="text-sm text-neutral-600">
                승인 프로세스와 반납 확인으로 안전하게 관리
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">효율적인 공유</h3>
              <p className="text-sm text-neutral-600">
                부서 간 자원 공유로 효율성 극대화
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      {!isAuthenticated && (
        <div className="text-center mt-12">
          <Link
            href="/login"
            className="w-auto rounded-lg bg-slate-900 px-8 text-base font-semibold text-white transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:bg-slate-950 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            style={{ height: "56px", fontSize: "20px", paddingLeft: "48px", paddingRight: "48px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            시작하기
          </Link>
        </div>
      )}
    </div>
  );
}
