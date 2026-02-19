"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ManageLayout from "@/components/manage/ManageLayout";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";

type ProgramSettings = {
  gamification_enabled?: boolean;
  leaderboard_enabled?: boolean;
  cheer_enabled?: boolean;
  streak_enabled?: boolean;
  rewards_enabled?: boolean;
  reward_mode?: "manual" | "auto";
  daily_point_cap?: number;
  monthly_reset_day?: number;
};

export default function BooksManagePage() {
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [booksEnabled, setBooksEnabled] = useState(false);
  const [programSettings, setProgramSettings] = useState<ProgramSettings | null>(null);
  const [ruleCount, setRuleCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      if (!user) {
        if (!isMounted) return;
        setHasPermission(false);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError || !profileData?.organization_id) {
        setMessage("기관 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      const isManager = profileData.role === "admin" || profileData.role === "manager";
      setHasPermission(isManager);
      setOrganizationId(profileData.organization_id);

      if (!isManager) {
        setLoading(false);
        return;
      }

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("features")
        .eq("id", profileData.organization_id)
        .maybeSingle();

      if (!isMounted) return;

      if (orgError) {
        setMessage("기관 기능 설정을 확인하지 못했습니다.");
        setLoading(false);
        return;
      }

      const enabled = orgData?.features?.books === true;
      setBooksEnabled(enabled);

      const [settingsRes, rulesRes] = await Promise.all([
        supabase
          .from("book_program_settings")
          .select(
            "gamification_enabled,leaderboard_enabled,cheer_enabled,streak_enabled,rewards_enabled,reward_mode,daily_point_cap,monthly_reset_day"
          )
          .eq("organization_id", profileData.organization_id)
          .maybeSingle(),
        supabase
          .from("book_scoring_rules")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", profileData.organization_id),
      ]);

      if (!isMounted) return;

      if (settingsRes.error) {
        setMessage(`도서 운영 설정 조회 실패: ${settingsRes.error.message}`);
      } else {
        setProgramSettings(settingsRes.data ?? null);
      }

      if (rulesRes.error) {
        setMessage(`점수 규칙 조회 실패: ${rulesRes.error.message}`);
      } else {
        setRuleCount(rulesRes.count ?? 0);
      }

      setLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <Notice>도서 운영 설정을 불러오는 중입니다.</Notice>;
  }

  if (!hasPermission) {
    return (
      <Notice variant="warning" className="text-left">
        관리자 또는 매니저만 접근할 수 있습니다.
      </Notice>
    );
  }

  return (
    <ManageLayout>
      <PageHero
        title="도서 운영 관리"
        description="도서 라운지는 자원관리와 분리된 사용자 경험으로 운영됩니다."
        actions={
          <div className="flex gap-2">
            <Link href="/books" className="btn-ghost">
              도서 라운지
            </Link>
            <Link href="/settings/menu" className="btn-primary">
              메뉴 설정
            </Link>
          </div>
        }
      />

      {!booksEnabled ? (
        <Notice variant="warning" className="text-left">
          도서 기능이 비활성화되어 있습니다.{" "}
          <Link href="/settings/menu" className="underline font-medium">
            메뉴 설정
          </Link>
          에서 `도서`를 활성화하세요.
        </Notice>
      ) : (
        <SectionCard
          title="운영 상태"
          description="게임화/리더보드/응원/시상 정책의 현재 상태입니다."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">게임화</p>
              <p className="mt-1 text-lg font-semibold">
                {programSettings?.gamification_enabled === false ? "비활성" : "활성"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">리더보드</p>
              <p className="mt-1 text-lg font-semibold">
                {programSettings?.leaderboard_enabled === false ? "비활성" : "활성"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">응원 기능</p>
              <p className="mt-1 text-lg font-semibold">
                {programSettings?.cheer_enabled === false ? "비활성" : "활성"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">시상</p>
              <p className="mt-1 text-lg font-semibold">
                {programSettings?.rewards_enabled === true ? "활성" : "비활성(선택형)"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">일일 점수 상한</p>
              <p className="mt-1 text-lg font-semibold">{programSettings?.daily_point_cap ?? 120}점</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">적용된 점수 규칙</p>
              <p className="mt-1 text-lg font-semibold">{ruleCount}개</p>
            </div>
          </div>
        </SectionCard>
      )}

      {message && (
        <Notice variant="warning" className="text-left">
          {message}
        </Notice>
      )}

      {organizationId && (
        <SectionCard title="다음 단계" description="운영 설정 이후 연결할 기능입니다.">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>반납 완료 시 점수 적립 API(`/api/books/gamification/activity`) 호출 연결</li>
            <li>도서 상세에서 응원 버튼과 메모 작성 흐름 연결</li>
            <li>월말 리더보드 스냅샷 및 시상 확정 배치 작업 연결</li>
          </ol>
        </SectionCard>
      )}
    </ManageLayout>
  );
}
