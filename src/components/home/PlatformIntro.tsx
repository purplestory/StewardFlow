"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, BookOpen, Building2, Car, Package, type LucideIcon } from "lucide-react";
import LogoIcon from "@/components/common/LogoIcon";
import Notice from "@/components/common/Notice";
import { useHeaderSession } from "@/components/layout/useHeaderSession";

type ModuleKey = "equipment" | "spaces" | "vehicles" | "books";

type ModuleCard = {
  key: ModuleKey;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

const moduleCards: ModuleCard[] = [
  {
    key: "books",
    title: "도서",
    description: "대여와 반납, 독서 기록을 한곳에서 이어갑니다.",
    href: "/books",
    tone: "border-blue-200 bg-blue-50 text-blue-800",
    icon: BookOpen,
  },
  {
    key: "equipment",
    title: "물품",
    description: "부서 물품의 위치와 대여 상태를 빠르게 확인합니다.",
    href: "/assets",
    tone: "border-teal-200 bg-teal-50 text-teal-800",
    icon: Package,
  },
  {
    key: "spaces",
    title: "공간",
    description: "예배와 모임 일정을 겹침 없이 예약하고 관리합니다.",
    href: "/spaces",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Building2,
  },
  {
    key: "vehicles",
    title: "차량",
    description: "사용 신청부터 반납 확인과 주행 기록까지 관리합니다.",
    href: "/vehicles",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    icon: Car,
  },
];

function PlatformIntroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthed,
    hasOrganization,
    loading,
    error,
    retry,
    menuLabels,
    menuOrder,
    mainNavItems,
  } = useHeaderSession();
  const skipRedirect = searchParams.get("skip_redirect") === "true";

  useEffect(() => {
    if (!loading && !error && isAuthed && !hasOrganization && !skipRedirect) {
      router.replace("/join");
    }
  }, [error, hasOrganization, isAuthed, loading, router, skipRedirect]);

  const orderedCards = menuOrder.length
    ? menuOrder.flatMap((item) => moduleCards.filter((card) => card.key === item.key))
    : moduleCards;

  const getModuleState = (card: ModuleCard) => {
    if (loading) return { href: null, label: "확인 중" };
    if (error) return { href: null, label: "확인 불가" };
    if (!isAuthed) return { href: "/login", label: "로그인 후 이용" };
    if (!hasOrganization) return { href: "/join", label: "기관 참여 필요" };
    if (!mainNavItems.some((item) => item.href === card.href)) {
      return { href: null, label: "사용 안 함" };
    }
    return { href: card.href, label: "바로가기" };
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <section
        className="border-b border-slate-200 pb-8 pt-1 md:pb-10 md:pt-4"
        aria-busy={loading}
      >
        <div className="flex items-start gap-4 md:gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm md:h-14 md:w-14">
            <LogoIcon className="h-9 w-9 md:h-10 md:w-10" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-brand-primary">교회 자원관리 시스템</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950 md:text-5xl">StewardFlow</h1>
            <p className="mt-3 max-w-2xl break-keep text-base leading-7 text-slate-600 md:text-lg">
              물품, 공간, 차량과 도서를 한 흐름으로 연결해 현장의 신청, 승인, 반납을 더 분명하게 관리합니다.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {loading ? (
                <span className="inline-flex h-10 items-center gap-2 text-sm font-medium text-slate-600" aria-live="polite">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-primary" aria-hidden />
                  로그인 상태 확인 중
                </span>
              ) : error ? (
                <Notice variant="error" className="w-full">
                  <p>{error}</p>
                  <button type="button" onClick={retry} className="btn-outline mt-3">다시 시도</button>
                </Notice>
              ) : !isAuthed ? (
                <Link href="/login" className="btn-primary w-full sm:w-auto">카카오로 시작하기</Link>
              ) : !hasOrganization ? (
                <Link href="/join" className="btn-primary w-full sm:w-auto">기관 참여하기</Link>
              ) : (
                <>
                  <Link href="/my" className="btn-primary w-full sm:w-auto">내 신청 보기</Link>
                  <Link href="/notifications" className="btn-outline w-full sm:w-auto">알림 확인</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="service-modules-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-brand-accent">서비스</p>
            <h2 id="service-modules-title" className="mt-1 text-2xl font-semibold text-slate-950">자원 바로가기</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {orderedCards.map((card) => {
            const state = getModuleState(card);
            const title = menuLabels?.[card.key] ?? card.title;
            const Icon = card.icon;
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${card.tone}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${state.href ? "text-brand-primary" : "text-slate-500"}`}>
                    {state.label}{state.href ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : null}
                  </span>
                </div>
                <div className="mt-5">
                  <h3 className="break-words text-lg font-semibold text-slate-950">{title}</h3>
                  <p className="mt-1.5 break-keep text-sm leading-6 text-slate-600">{card.description}</p>
                </div>
              </>
            );

            if (state.href) {
              return (
                <Link
                  key={card.key}
                  href={state.href}
                  className="surface-card surface-card-interactive min-h-44 p-5"
                  aria-label={`${title}: ${state.label}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <article key={card.key} className="min-h-44 rounded-xl border border-slate-200 bg-slate-100/70 p-5">
                {content}
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
}

export default function PlatformIntro() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8" aria-busy="true" aria-label="홈 화면을 불러오는 중">
          <div className="h-56 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-xl bg-slate-200/70" />
            ))}
          </div>
        </div>
      }
    >
      <PlatformIntroContent />
    </Suspense>
  );
}
