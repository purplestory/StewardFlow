"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";

type BookSummary = {
  periodType: "weekly" | "monthly" | "quarterly" | "yearly";
  periodKey: string;
  gamificationEnabled: boolean;
  settings: {
    leaderboard_enabled?: boolean;
    cheer_enabled?: boolean;
    streak_enabled?: boolean;
    rewards_enabled?: boolean;
  } | null;
  myProgress: {
    current_streak_days?: number;
    longest_streak_days?: number;
    monthly_points?: number;
    lifetime_points?: number;
    monthly_books_completed?: number;
    rank_tier?: string;
  } | null;
  leaderboard: Array<{
    profileId: string;
    rankNo: number;
    totalPoints: number;
    booksCompleted: number;
    streakDays: number;
    cheersReceived: number;
    rankTier?: string;
    profileName?: string;
    profileDepartment?: string | null;
    source: "snapshot" | "live";
  }>;
  myRank: number | null;
  recentCheers: Array<{
    id: string;
    from_profile_id: string;
    message: string | null;
    created_at: string;
    from_profile_name?: string;
    from_profile_department?: string | null;
  }>;
};

export default function BooksHomeClient() {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [booksEnabled, setBooksEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<BookSummary | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const user = session?.user ?? null;

      if (!isMounted) return;

      if (!user || !session?.access_token) {
        setIsAuthed(false);
        setLoading(false);
        return;
      }

      setIsAuthed(true);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError || !profileData?.organization_id) {
        setMessage("기관 정보를 확인할 수 없습니다.");
        setLoading(false);
        return;
      }

      const role = profileData.role as "admin" | "manager" | "user" | null;
      setIsManager(role === "admin" || role === "manager");

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("features")
        .eq("id", profileData.organization_id)
        .maybeSingle();

      if (!isMounted) return;

      if (orgError) {
        setMessage("기관 기능 설정을 조회하지 못했습니다.");
        setLoading(false);
        return;
      }

      const enabled = orgData?.features?.books === true;
      setBooksEnabled(enabled);

      if (!enabled) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/books/gamification/summary?period=monthly", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; summary?: BookSummary }
        | null;

      if (!isMounted) return;

      if (!response.ok || !result?.ok || !result.summary) {
        setMessage(result?.message ?? "도서 요약 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      setSummary(result.summary);
      setLoading(false);
    };

    void load();

    const onSettingsChanged = () => {
      void load();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("organizationSettingsUpdated", onSettingsChanged);
    }

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("organizationSettingsUpdated", onSettingsChanged);
      }
    };
  }, []);

  const stats = useMemo(() => {
    const progress = summary?.myProgress;
    return [
      {
        key: "streak",
        label: "연속 독서일",
        value: `${progress?.current_streak_days ?? 0}일`,
      },
      {
        key: "monthly",
        label: "이번달 점수",
        value: `${progress?.monthly_points ?? 0}점`,
      },
      {
        key: "books",
        label: "이번달 완독",
        value: `${progress?.monthly_books_completed ?? 0}권`,
      },
      {
        key: "rank",
        label: "내 랭킹",
        value: summary?.myRank ? `${summary.myRank}위` : "-",
      },
    ];
  }, [summary]);

  if (loading) {
    return <Notice>도서 라운지 정보를 불러오는 중입니다.</Notice>;
  }

  if (!isAuthed) {
    return (
      <Notice variant="warning" className="text-left">
        로그인 후 도서 라운지를 이용할 수 있습니다.{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
      </Notice>
    );
  }

  if (!booksEnabled) {
    return (
      <div className="space-y-4">
        <Notice variant="neutral" className="text-left">
          이 기관은 아직 도서 기능이 비활성화되어 있습니다.
        </Notice>
        {isManager && (
          <div className="flex gap-2">
            <Link href="/settings/menu" className="btn-primary">
              메뉴 설정으로 이동
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="도서 라운지"
        description="도서 대여, 독서 기록, 스트릭, 응원 기능을 위한 별도 공간입니다."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/assets/new" className="btn-ghost">
              도서 등록
            </Link>
            {isManager && (
              <Link href="/books/manage" className="btn-primary">
                도서 운영
              </Link>
            )}
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </PageHero>

      {message && (
        <Notice variant="warning" className="text-left">
          {message}
        </Notice>
      )}

      <SectionCard
        title="월간 리더보드"
        description="이번달 독서 활동 점수 기준 상위 순위입니다."
      >
        {summary?.leaderboard?.length ? (
          <ul className="space-y-2">
            {summary.leaderboard.map((entry) => (
              <li
                key={`${entry.profileId}-${entry.rankNo}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {entry.rankNo}위 · {entry.profileName ?? entry.profileId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    완독 {entry.booksCompleted}권 · 스트릭 {entry.streakDays}일
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{entry.totalPoints}점</p>
              </li>
            ))}
          </ul>
        ) : (
          <Notice className="p-4">아직 리더보드 데이터가 없습니다.</Notice>
        )}
      </SectionCard>

      <SectionCard
        title="최근 받은 응원"
        description="다른 사용자가 남긴 격려 메시지를 확인하세요."
      >
        {summary?.recentCheers?.length ? (
          <ul className="space-y-2">
            {summary.recentCheers.map((cheer) => (
              <li key={cheer.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                <p className="text-sm text-slate-900">
                  {cheer.from_profile_name ?? cheer.from_profile_id.slice(0, 8)} 님의 응원
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {cheer.message || "계속 읽어봅시다!"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Notice className="p-4">아직 받은 응원이 없습니다.</Notice>
        )}
      </SectionCard>
    </div>
  );
}
