"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type BookStatus = "available" | "requested" | "borrowed" | "overdue" | "archived";

type BookItem = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  published_year: number | null;
  status: BookStatus;
  owner_scope: "organization" | "member";
  shelf_label: string | null;
  cover_image_url: string | null;
  tags: string[] | null;
};

type ActiveBookLoan = {
  id: string;
  book_item_id: string;
  status: "approved" | "borrowed" | "overdue";
  due_at: string | null;
  return_verification_status: "not_required" | "pending" | "verified" | "rejected";
};

const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  available: "대여 가능",
  requested: "요청 처리중",
  borrowed: "대여 중",
  overdue: "연체",
  archived: "보관됨",
};

const BOOK_STATUS_BADGE_CLASS: Record<BookStatus, string> = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  requested: "bg-amber-50 text-amber-700 ring-amber-200",
  borrowed: "bg-blue-50 text-blue-700 ring-blue-200",
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  archived: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export default function BooksHomeClient() {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [booksEnabled, setBooksEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<BookSummary | null>(null);
  const [bookItems, setBookItems] = useState<BookItem[]>([]);
  const [booksLoadError, setBooksLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BookStatus>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [myActiveLoansByBookId, setMyActiveLoansByBookId] = useState<Record<string, ActiveBookLoan>>(
    {}
  );
  const [returnTarget, setReturnTarget] = useState<{
    loanId: string;
    bookId: string;
    title: string;
  } | null>(null);
  const [returnShelfCode, setReturnShelfCode] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setMessage(null);
      setActionMessage(null);

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
      setCurrentUserId(user.id);
      setAccessToken(session.access_token);

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

      const [summaryResponse, booksResponse, loansResponse] = await Promise.all([
        fetch("/api/books/gamification/summary?period=monthly", {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }),
        supabase
          .from("book_items")
          .select(
            "id,title,author,publisher,published_year,status,owner_scope,shelf_label,cover_image_url,tags,created_at"
          )
          .eq("organization_id", profileData.organization_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("book_loans")
          .select("id,book_item_id,status,due_at,return_verification_status")
          .eq("organization_id", profileData.organization_id)
          .eq("borrower_id", user.id)
          .in("status", ["approved", "borrowed", "overdue"]),
      ]);

      if (!isMounted) return;

      const summaryResult = (await summaryResponse.json().catch(() => null)) as
        | { ok?: boolean; message?: string; summary?: BookSummary }
        | null;

      if (!summaryResponse.ok || !summaryResult?.ok || !summaryResult.summary) {
        setMessage(summaryResult?.message ?? "도서 요약 정보를 불러오지 못했습니다.");
      } else {
        setSummary(summaryResult.summary);
      }

      if (booksResponse.error) {
        setBooksLoadError(`도서 목록 조회 실패: ${booksResponse.error.message}`);
      } else {
        setBooksLoadError(null);
        setBookItems((booksResponse.data ?? []) as BookItem[]);
      }

      if (loansResponse.error) {
        setActionMessage(`대출 상태 조회 실패: ${loansResponse.error.message}`);
        setMyActiveLoansByBookId({});
      } else {
        const rows = (loansResponse.data ?? []) as ActiveBookLoan[];
        const nextMap: Record<string, ActiveBookLoan> = {};
        rows.forEach((loan) => {
          if (!nextMap[loan.book_item_id]) {
            nextMap[loan.book_item_id] = loan;
          }
        });
        setMyActiveLoansByBookId(nextMap);
      }

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
  }, [reloadTick]);

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

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookItems.filter((book) => {
      const matchesQuery =
        normalized.length === 0 ||
        book.title.toLowerCase().includes(normalized) ||
        (book.author ?? "").toLowerCase().includes(normalized) ||
        (book.publisher ?? "").toLowerCase().includes(normalized) ||
        (book.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized));

      const matchesStatus = statusFilter === "all" || book.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [bookItems, query, statusFilter]);

  const handleReturnSubmit = async () => {
    if (!returnTarget || !accessToken) {
      setActionMessage("반납 요청에 필요한 인증 정보가 없습니다.");
      return;
    }

    setReturnSubmitting(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/books/loans/return", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          accessToken,
          loanId: returnTarget.loanId,
          returnMethod: "self_photo",
          returnShelfCode: returnShelfCode || null,
          returnNote: returnNote || null,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            result?: {
              pendingVerification?: boolean;
              pointsAwarded?: Array<{ ruleKey: string; awardedPoints: number }>;
            };
          }
        | null;

      if (!response.ok || !result?.ok) {
        setActionMessage(result?.message ?? "반납 처리에 실패했습니다.");
        return;
      }

      if (result.result?.pendingVerification) {
        setActionMessage("반납이 등록되었습니다. 관리자 확인 후 점수가 반영됩니다.");
      } else {
        const totalAwarded =
          (result.result?.pointsAwarded ?? []).reduce(
            (sum, row) => sum + Number(row.awardedPoints ?? 0),
            0
          ) ?? 0;
        setActionMessage(
          totalAwarded > 0
            ? `반납이 완료되었습니다. 총 ${totalAwarded}점이 반영되었습니다.`
            : "반납이 완료되었습니다."
        );
      }

      setReturnTarget(null);
      setReturnShelfCode("");
      setReturnNote("");
      setReloadTick((prev) => prev + 1);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? `반납 처리 오류: ${error.message}` : "반납 처리 중 오류가 발생했습니다."
      );
    } finally {
      setReturnSubmitting(false);
    }
  };

  const formatDueDate = (dueAt: string | null) => {
    if (!dueAt) return null;
    const date = new Date(dueAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("ko-KR");
  };

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
      {actionMessage && (
        <Notice variant={actionMessage.includes("실패") || actionMessage.includes("오류") ? "warning" : "neutral"} className="text-left">
          {actionMessage}
        </Notice>
      )}

      <SectionCard
        title="도서 카탈로그"
        description="기관 도서와 공유 도서를 검색하고 상태를 확인할 수 있습니다."
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[1.6fr_0.8fr]">
          <input
            className="form-input"
            placeholder="제목, 저자, 출판사, 태그 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="form-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | BookStatus)}
          >
            <option value="all">전체 상태</option>
            <option value="available">대여 가능</option>
            <option value="requested">요청 처리중</option>
            <option value="borrowed">대여 중</option>
            <option value="overdue">연체</option>
            <option value="archived">보관됨</option>
          </select>
        </div>

        {booksLoadError ? (
          <Notice variant="warning" className="text-left">
            {booksLoadError}
          </Notice>
        ) : filteredBooks.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBooks.map((book) => (
              <article
                key={book.id}
                className="rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <div className="h-[84px] w-[64px] shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                    {book.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.cover_image_url}
                        alt={book.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                        표지 없음
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900">{book.title}</p>
                    <p className="mt-1 text-xs text-neutral-600">{book.author || "저자 정보 없음"}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {book.publisher || "출판사 미상"}
                      {book.published_year ? ` · ${book.published_year}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                          BOOK_STATUS_BADGE_CLASS[book.status]
                        }`}
                      >
                        {BOOK_STATUS_LABEL[book.status]}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {book.owner_scope === "organization" ? "기관 도서" : "개인 공유"}
                      </span>
                    </div>
                  </div>
                </div>
                {book.shelf_label && (
                  <p className="mt-2 text-xs text-neutral-500">서가: {book.shelf_label}</p>
                )}
                {currentUserId && myActiveLoansByBookId[book.id] && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs text-blue-800">
                      내 대여 건 (
                      {myActiveLoansByBookId[book.id].status === "overdue" ? "연체" : "대여 중"})
                      {formatDueDate(myActiveLoansByBookId[book.id].due_at)
                        ? ` · 반납예정 ${formatDueDate(myActiveLoansByBookId[book.id].due_at)}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      className="btn-ghost mt-2 h-9 w-full justify-center"
                      onClick={() =>
                        setReturnTarget({
                          loanId: myActiveLoansByBookId[book.id].id,
                          bookId: book.id,
                          title: book.title,
                        })
                      }
                    >
                      반납하기
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Notice className="p-4">
            조건에 맞는 도서가 없습니다.
          </Notice>
        )}
      </SectionCard>

      <Dialog
        open={Boolean(returnTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setReturnTarget(null);
            setReturnShelfCode("");
            setReturnNote("");
          }
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="rounded-t-2xl border-b border-neutral-200 px-6 py-4">
            <DialogTitle>도서 반납</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{returnTarget?.title}</p>
              <p className="mt-1 text-xs text-neutral-500">
                반납 등록 후 검수 정책에 따라 즉시 완료 또는 확인 대기 상태가 됩니다.
              </p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-700">서가 코드(선택)</span>
              <input
                className="form-input"
                value={returnShelfCode}
                onChange={(event) => setReturnShelfCode(event.target.value)}
                placeholder="예: B2-A-03"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-700">반납 메모(선택)</span>
              <textarea
                className="form-input min-h-[96px] resize-y"
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
                placeholder="책 상태나 특이사항을 남겨주세요."
              />
            </label>
          </div>
          <div className="flex gap-3 rounded-b-2xl border-t border-neutral-200 bg-neutral-50 px-6 py-4">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => void handleReturnSubmit()}
              disabled={returnSubmitting}
            >
              {returnSubmitting ? "반납 처리 중..." : "반납 등록"}
            </button>
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => {
                setReturnTarget(null);
                setReturnShelfCode("");
                setReturnNote("");
              }}
              disabled={returnSubmitting}
            >
              취소
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
