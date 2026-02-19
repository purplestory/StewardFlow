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

type PendingReturnRow = {
  id: string;
  book_item_id: string;
  borrower_id: string;
  due_at: string | null;
  returned_at: string | null;
  return_note: string | null;
  return_shelf_code: string | null;
  return_photo_url: string | null;
};

type PendingReturnItem = PendingReturnRow & {
  book_title: string;
  borrower_name: string | null;
  borrower_department: string | null;
};

export default function BooksManagePage() {
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [booksEnabled, setBooksEnabled] = useState(false);
  const [programSettings, setProgramSettings] = useState<ProgramSettings | null>(null);
  const [ruleCount, setRuleCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pendingReturns, setPendingReturns] = useState<PendingReturnItem[]>([]);
  const [verifyNoteByLoanId, setVerifyNoteByLoanId] = useState<Record<string, string>>({});
  const [verifyingLoanId, setVerifyingLoanId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      const sessionAccessToken = sessionData.session?.access_token ?? null;
      if (!user) {
        if (!isMounted) return;
        setHasPermission(false);
        setLoading(false);
        return;
      }
      setAccessToken(sessionAccessToken);

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

      const [settingsRes, rulesRes, pendingRes] = await Promise.all([
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
        supabase
          .from("book_loans")
          .select(
            "id,book_item_id,borrower_id,due_at,returned_at,return_note,return_shelf_code,return_photo_url"
          )
          .eq("organization_id", profileData.organization_id)
          .eq("status", "returned")
          .eq("return_verification_status", "pending")
          .order("returned_at", { ascending: true }),
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

      if (pendingRes.error) {
        setMessage(`반납 검수 목록 조회 실패: ${pendingRes.error.message}`);
        setPendingReturns([]);
      } else {
        const pendingRows = (pendingRes.data ?? []) as PendingReturnRow[];
        if (pendingRows.length === 0) {
          setPendingReturns([]);
        } else {
          const bookIds = Array.from(new Set(pendingRows.map((row) => row.book_item_id)));
          const borrowerIds = Array.from(new Set(pendingRows.map((row) => row.borrower_id)));

          const [bookItemsRes, borrowersRes] = await Promise.all([
            supabase
              .from("book_items")
              .select("id,title")
              .in("id", bookIds),
            supabase
              .from("profiles")
              .select("id,name,department")
              .in("id", borrowerIds),
          ]);

          const bookTitleById = new Map<string, string>();
          (bookItemsRes.data ?? []).forEach((row) => {
            bookTitleById.set(row.id, row.title ?? "제목 없음");
          });

          const borrowerInfoById = new Map<string, { name: string | null; department: string | null }>();
          (borrowersRes.data ?? []).forEach((row) => {
            borrowerInfoById.set(row.id, {
              name: row.name ?? null,
              department: row.department ?? null,
            });
          });

          setPendingReturns(
            pendingRows.map((row) => ({
              ...row,
              book_title: bookTitleById.get(row.book_item_id) ?? "제목 없음",
              borrower_name: borrowerInfoById.get(row.borrower_id)?.name ?? null,
              borrower_department: borrowerInfoById.get(row.borrower_id)?.department ?? null,
            }))
          );
        }
      }

      setLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [reloadTick]);

  const handleVerifyReturn = async (loanId: string, decision: "verified" | "rejected") => {
    if (!accessToken) {
      setVerifyMessage("인증 토큰이 없어 검수를 진행할 수 없습니다.");
      return;
    }

    setVerifyingLoanId(loanId);
    setVerifyMessage(null);

    const note = verifyNoteByLoanId[loanId]?.trim() || null;
    if (decision === "rejected" && !note) {
      setVerifyMessage("반려 시에는 사유를 입력해주세요.");
      setVerifyingLoanId(null);
      return;
    }

    try {
      const response = await fetch("/api/books/loans/verify-return", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          accessToken,
          loanId,
          decision,
          note,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            result?: { pointsAwarded?: Array<{ ruleKey: string; awardedPoints: number }> };
          }
        | null;

      if (!response.ok || !result?.ok) {
        setVerifyMessage(result?.message ?? "반납 검수 처리에 실패했습니다.");
        return;
      }

      const totalAwarded =
        (result.result?.pointsAwarded ?? []).reduce(
          (sum, row) => sum + Number(row.awardedPoints ?? 0),
          0
        ) ?? 0;
      setVerifyMessage(
        decision === "verified"
          ? totalAwarded > 0
            ? `반납 승인 완료. 총 ${totalAwarded}점이 반영되었습니다.`
            : "반납 승인 완료."
          : "반납이 반려되었습니다."
      );

      setVerifyNoteByLoanId((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
      setReloadTick((prev) => prev + 1);
    } catch (error) {
      setVerifyMessage(
        error instanceof Error ? `반납 검수 오류: ${error.message}` : "반납 검수 중 오류가 발생했습니다."
      );
    } finally {
      setVerifyingLoanId(null);
    }
  };

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
      {verifyMessage && (
        <Notice
          variant={verifyMessage.includes("실패") || verifyMessage.includes("오류") ? "warning" : "neutral"}
          className="text-left"
        >
          {verifyMessage}
        </Notice>
      )}

      {booksEnabled && (
        <SectionCard
          title="반납 검수 대기"
          description="사용자가 등록한 반납을 승인/반려하면 점수가 확정됩니다."
        >
          {pendingReturns.length === 0 ? (
            <Notice className="p-4">검수 대기중인 반납이 없습니다.</Notice>
          ) : (
            <ul className="space-y-3">
              {pendingReturns.map((item) => (
                <li key={item.id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.book_title}</p>
                      <p className="mt-1 text-xs text-neutral-600">
                        {item.borrower_name ?? item.borrower_id.slice(0, 8)}
                        {item.borrower_department ? ` (${item.borrower_department})` : ""}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        반납일:{" "}
                        {item.returned_at
                          ? new Date(item.returned_at).toLocaleString("ko-KR")
                          : "-"}
                        {item.due_at
                          ? ` · 반납기한: ${new Date(item.due_at).toLocaleDateString("ko-KR")}`
                          : ""}
                      </p>
                      {item.return_shelf_code && (
                        <p className="mt-1 text-xs text-neutral-500">서가 코드: {item.return_shelf_code}</p>
                      )}
                      {item.return_note && (
                        <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                          {item.return_note}
                        </p>
                      )}
                      {item.return_photo_url && (
                        <a
                          href={item.return_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs text-brand-primary underline"
                        >
                          반납 사진 보기
                        </a>
                      )}
                    </div>
                    <span className="inline-flex h-7 items-center rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-700">
                      확인 대기
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      className="form-input"
                      placeholder="검수 메모 (반려 시 필수)"
                      value={verifyNoteByLoanId[item.id] ?? ""}
                      onChange={(event) =>
                        setVerifyNoteByLoanId((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn-primary h-10 px-4"
                      onClick={() => void handleVerifyReturn(item.id, "verified")}
                      disabled={verifyingLoanId === item.id}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="btn-ghost h-10 px-4 text-rose-700 hover:bg-rose-50"
                      onClick={() => void handleVerifyReturn(item.id, "rejected")}
                      disabled={verifyingLoanId === item.id}
                    >
                      반려
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {organizationId && (
        <SectionCard title="다음 단계" description="운영 설정 이후 연결할 기능입니다.">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>도서 대여 신청/승인 UI를 붙여 대출 생성 흐름 완성</li>
            <li>도서 상세에서 응원 버튼과 메모 작성 흐름 연결</li>
            <li>월말 리더보드 스냅샷 및 시상 확정 배치 작업 연결</li>
          </ol>
        </SectionCard>
      )}
    </ManageLayout>
  );
}
