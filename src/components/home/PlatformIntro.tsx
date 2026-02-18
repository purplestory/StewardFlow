"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LogoIcon from "@/components/common/LogoIcon";

type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
};

function PlatformIntroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [features, setFeatures] = useState<OrganizationFeatures | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      setIsAuthenticated(Boolean(user));

      if (!user) {
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("메인 소개 프로필 조회 오류:", profileError.message);
        return;
      }

      const skipRedirect = searchParams.get("skip_redirect") === "true";
      if (!profileData?.organization_id && !skipRedirect) {
        router.push("/join");
        return;
      }

      if (!profileData?.organization_id) {
        return;
      }

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("features")
        .eq("id", profileData.organization_id)
        .maybeSingle();

      if (orgError) {
        console.error("메인 소개 기관 정보 조회 오류:", orgError.message);
        return;
      }

      if (orgData) {
        setFeatures({
          equipment: orgData.features?.equipment ?? true,
          spaces: orgData.features?.spaces ?? true,
          vehicles: orgData.features?.vehicles ?? false,
        });
      }
    };

    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      if (session?.user) {
        void checkAuth();
      } else {
        setFeatures(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  const isCategoryEnabled = (category: "assets" | "spaces" | "vehicles") => {
    if (!isAuthenticated || !features) return false;
    if (category === "assets") return features.equipment !== false;
    if (category === "spaces") return features.spaces !== false;
    return features.vehicles === true;
  };

  const handleCategoryClick = (category: "assets" | "spaces" | "vehicles") => {
    if (!isCategoryEnabled(category)) {
      return;
    }
    if (category === "assets") {
      router.push("/assets");
      return;
    }
    if (category === "spaces") {
      router.push("/spaces");
      return;
    }
    router.push("/vehicles");
  };

  const categoryCards = [
    {
      key: "assets" as const,
      title: "물품",
      description: "소유 부서 기준으로 등록하고, 신청부터 반납까지 전 과정을 관리합니다.",
      accent: "from-sky-500/20 to-blue-500/10",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      ),
    },
    {
      key: "spaces" as const,
      title: "공간",
      description: "공간 예약 충돌을 방지하고, 부서 운영 일정에 맞춰 체계적으로 배정합니다.",
      accent: "from-teal-500/20 to-cyan-500/10",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3 11.5l9-7 9 7M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"
        />
      ),
    },
    {
      key: "vehicles" as const,
      title: "차량",
      description: "사용 신청, 반납 확인, 주행 정보까지 한 화면에서 안전하게 관리합니다.",
      accent: "from-amber-400/25 to-orange-400/15",
      icon: (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M3 13l2-5a2 2 0 011.9-1.3h10.2A2 2 0 0119 8l2 5v6h-2v-2H5v2H3v-6z"
          />
          <circle cx="7.5" cy="14.5" r="1.4" strokeWidth={1.8} />
          <circle cx="16.5" cy="14.5" r="1.4" strokeWidth={1.8} />
        </>
      ),
    },
  ];

  const benefitItems = [
    {
      title: "권한 기반 승인",
      description: "관리자/부서 관리자 권한에 맞는 승인 경로를 제공합니다.",
    },
    {
      title: "모바일 우선 접근",
      description: "예배 현장에서도 신청, 승인 상태, 알림을 빠르게 확인할 수 있습니다.",
    },
    {
      title: "신청 내역 추적",
      description: "내 대여 신청 수정/취소, 상태 변경 이력을 일관되게 관리합니다.",
    },
    {
      title: "부서 간 협업",
      description: "불용품 양도 요청과 공용 자원 공유를 표준화된 흐름으로 처리합니다.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-[0_14px_30px_rgba(15,23,42,0.08)] md:px-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-center md:justify-start">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100 md:h-20 md:w-20">
              <LogoIcon className="h-12 w-12 md:h-14 md:w-14" />
            </div>
          </div>
          <div className="mt-6 text-center md:text-left">
            <p className="text-sm font-semibold tracking-[0.12em] text-slate-500">
              CHURCH RESOURCE OPERATIONS
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
              교회 자원관리 시스템
            </h1>
            <p className="mt-2 text-xl font-semibold text-brand-primary md:text-2xl">
              StewardFlow
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 md:mx-0 md:text-base">
              물품, 공간, 차량 운영을 하나의 흐름으로 연결해 신청, 승인, 반납, 알림까지
              교회 현장에 맞게 관리합니다.
            </p>
          </div>
          <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              조직별 메뉴/권한 설정
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              신청 상태 실시간 반영
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              모바일 친화형 운영 화면
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {categoryCards.map((card) => {
          const enabled = isCategoryEnabled(card.key);
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCategoryClick(card.key)}
              className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                enabled
                  ? "border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                  : "cursor-default border-slate-200/80 bg-slate-50"
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 ${card.accent}`}
              />
              <div className="relative z-10">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/70 bg-white/90 text-slate-700">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {card.icon}
                  </svg>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {enabled ? "사용 가능" : "비활성"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.description}</p>
              </div>
            </button>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
        <h2 className="text-xl font-semibold text-slate-900">운영 핵심 포인트</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {benefitItems.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {(!isAuthenticated || (isAuthenticated && !features)) && (
        <div className="pb-2 text-center">
          <Link
            href={isAuthenticated ? "/join-request" : "/login"}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-primary px-8 text-base font-semibold text-white transition-colors hover:bg-[#173d7f]"
          >
            시작하기
          </Link>
        </div>
      )}
    </div>
  );
}

export default function PlatformIntro() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-neutral-900" />
            <p className="mt-4 text-sm text-neutral-600">로딩 중...</p>
          </div>
        </div>
      }
    >
      <PlatformIntroContent />
    </Suspense>
  );
}
