"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ManageLayout from "@/components/manage/ManageLayout";
import ManageSubmenuLayout from "@/components/manage/ManageSubmenuLayout";
import CategoryTabs from "@/components/manage/CategoryTabs";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
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

type PendingRequestRow = {
  id: string;
  book_item_id: string;
  borrower_id: string;
  requested_at: string;
  note: string | null;
};

type PendingRequestItem = PendingRequestRow & {
  book_title: string;
  borrower_name: string | null;
  borrower_department: string | null;
};

type ManagedBookStatus = "available" | "requested" | "borrowed" | "overdue" | "archived";

type ManagedBookItem = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  published_year: number | null;
  status: ManagedBookStatus;
  shelf_label: string | null;
  isbn: string | null;
  created_at: string;
};

type BookLookupPayload = {
  isbn: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
  description: string | null;
  source:
    | "data4library"
    | "nationallibrary"
    | "naverbook"
    | "openlibrary"
    | "googlebooks";
};

type BookManageTab = "register" | "requests" | "returns" | "settings";

type BooksManageCache = {
  loading: boolean;
  hasPermission: boolean;
  organizationId: string | null;
  currentUserId: string | null;
  booksEnabled: boolean;
  programSettings: ProgramSettings | null;
  ruleCount: number;
  message: string | null;
  accessToken: string | null;
  bookItems: ManagedBookItem[];
  pendingRequests: PendingRequestItem[];
  pendingReturns: PendingReturnItem[];
  fetchedAt: number;
};

const BOOKS_MANAGE_CACHE_TTL_MS = 2 * 60 * 1000;
const BOOKS_MANAGE_CACHE_STORAGE_KEY = "booksManageCache";
let booksManageCache: BooksManageCache | null = null;

const isFreshBooksManageCache = (cache: BooksManageCache | null) =>
  Boolean(cache && Date.now() - cache.fetchedAt < BOOKS_MANAGE_CACHE_TTL_MS);

const readBooksManageCache = (): BooksManageCache | null => {
  if (isFreshBooksManageCache(booksManageCache)) {
    return booksManageCache;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(BOOKS_MANAGE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BooksManageCache;
    if (!isFreshBooksManageCache(parsed)) {
      window.sessionStorage.removeItem(BOOKS_MANAGE_CACHE_STORAGE_KEY);
      return null;
    }
    booksManageCache = parsed;
    return parsed;
  } catch {
    return null;
  }
};

const writeBooksManageCache = (cache: BooksManageCache | null) => {
  booksManageCache = cache;
  if (typeof window === "undefined") return;

  if (!cache) {
    window.sessionStorage.removeItem(BOOKS_MANAGE_CACHE_STORAGE_KEY);
    return;
  }

  try {
    window.sessionStorage.setItem(BOOKS_MANAGE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors and keep in-memory cache only.
  }
};

const toBooksDataErrorMessage = (message: string, fallback: string) => {
  if (
    message.includes("Could not find the table") ||
    message.includes("schema cache") ||
    message.includes("book_items") ||
    message.includes("book_loans")
  ) {
    return "도서 기능 초기화가 필요합니다. 관리자에게 마이그레이션 적용을 요청해주세요.";
  }
  return fallback;
};

const BOOK_STATUS_LABEL: Record<ManagedBookStatus, string> = {
  available: "대여 가능",
  requested: "요청 처리중",
  borrowed: "대여 중",
  overdue: "연체",
  archived: "보관됨",
};

const BOOK_STATUS_BADGE_CLASS: Record<ManagedBookStatus, string> = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  requested: "bg-amber-50 text-amber-700 ring-amber-200",
  borrowed: "bg-blue-50 text-blue-700 ring-blue-200",
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  archived: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

const bookStatusFilterOptions: Array<{ value: ManagedBookStatus | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "available", label: "대여 가능" },
  { value: "requested", label: "요청 처리중" },
  { value: "borrowed", label: "대여 중" },
  { value: "overdue", label: "연체" },
  { value: "archived", label: "보관됨" },
];

export default function BooksManagePage() {
  const freshCache = readBooksManageCache();
  const [loading, setLoading] = useState(freshCache?.loading ?? !freshCache);
  const [hasPermission, setHasPermission] = useState(freshCache?.hasPermission ?? false);
  const [organizationId, setOrganizationId] = useState<string | null>(freshCache?.organizationId ?? null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(freshCache?.currentUserId ?? null);
  const [booksEnabled, setBooksEnabled] = useState(freshCache?.booksEnabled ?? false);
  const [programSettings, setProgramSettings] = useState<ProgramSettings | null>(freshCache?.programSettings ?? null);
  const [ruleCount, setRuleCount] = useState(freshCache?.ruleCount ?? 0);
  const [message, setMessage] = useState<string | null>(freshCache?.message ?? null);
  const [bookRegisterMessage, setBookRegisterMessage] = useState<string | null>(null);
  const [bookLookupLoading, setBookLookupLoading] = useState(false);
  const [bookRegistering, setBookRegistering] = useState(false);
  const [bookItems, setBookItems] = useState<ManagedBookItem[]>(freshCache?.bookItems ?? []);
  const [showBookRegisterForm, setShowBookRegisterForm] = useState(false);
  const [bookSearchKeyword, setBookSearchKeyword] = useState("");
  const [bookStatusFilter, setBookStatusFilter] = useState<ManagedBookStatus | "all">("all");
  const [bookForm, setBookForm] = useState({
    isbn: "",
    title: "",
    author: "",
    publisher: "",
    publishedYear: "",
    shelfLabel: "",
    tags: "",
    coverImageUrl: "",
    description: "",
  });
  const [accessToken, setAccessToken] = useState<string | null>(freshCache?.accessToken ?? null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequestItem[]>(
    freshCache?.pendingRequests ?? []
  );
  const [decisionNoteByLoanId, setDecisionNoteByLoanId] = useState<Record<string, string>>({});
  const [decisionDueDateByLoanId, setDecisionDueDateByLoanId] = useState<Record<string, string>>({});
  const [decidingLoanId, setDecidingLoanId] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [pendingReturns, setPendingReturns] = useState<PendingReturnItem[]>(
    freshCache?.pendingReturns ?? []
  );
  const [verifyNoteByLoanId, setVerifyNoteByLoanId] = useState<Record<string, string>>({});
  const [verifyingLoanId, setVerifyingLoanId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeTab, setActiveTab] = useState<BookManageTab>("register");
  const [requestSearchKeyword, setRequestSearchKeyword] = useState("");
  const [returnSearchKeyword, setReturnSearchKeyword] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!readBooksManageCache()) {
        setLoading(true);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      const sessionAccessToken = sessionData.session?.access_token ?? null;
      if (!user) {
        if (!isMounted) return;
        setHasPermission(false);
        setCurrentUserId(null);
        setBookItems([]);
        writeBooksManageCache(null);
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);
      setAccessToken(sessionAccessToken);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError || !profileData?.organization_id) {
        setMessage("기관 정보를 불러오지 못했습니다.");
        setBookItems([]);
        writeBooksManageCache({
          loading: false,
          hasPermission: false,
          organizationId: null,
          currentUserId: user.id,
          booksEnabled: false,
          programSettings: null,
          ruleCount: 0,
          message: "기관 정보를 불러오지 못했습니다.",
          accessToken: sessionAccessToken,
          bookItems: [],
          pendingRequests: [],
          pendingReturns: [],
          fetchedAt: Date.now(),
        });
        setLoading(false);
        return;
      }

      const isManager = profileData.role === "admin" || profileData.role === "manager";
      setHasPermission(isManager);
      setOrganizationId(profileData.organization_id);

      if (!isManager) {
        setBookItems([]);
        writeBooksManageCache({
          loading: false,
          hasPermission: false,
          organizationId: profileData.organization_id,
          currentUserId: user.id,
          booksEnabled: false,
          programSettings: null,
          ruleCount: 0,
          message: null,
          accessToken: sessionAccessToken,
          bookItems: [],
          pendingRequests: [],
          pendingReturns: [],
          fetchedAt: Date.now(),
        });
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
        setBookItems([]);
        writeBooksManageCache({
          loading: false,
          hasPermission: true,
          organizationId: profileData.organization_id,
          currentUserId: user.id,
          booksEnabled: false,
          programSettings: null,
          ruleCount: 0,
          message: "기관 기능 설정을 확인하지 못했습니다.",
          accessToken: sessionAccessToken,
          bookItems: [],
          pendingRequests: [],
          pendingReturns: [],
          fetchedAt: Date.now(),
        });
        setLoading(false);
        return;
      }

      const enabled = orgData?.features?.books === true;
      setBooksEnabled(enabled);

      const [settingsRes, rulesRes, catalogRes, pendingReturnRes, pendingRequestRes] = await Promise.all([
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
          .from("book_items")
          .select("id,title,author,publisher,published_year,status,shelf_label,isbn,created_at")
          .eq("organization_id", profileData.organization_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("book_loans")
          .select(
            "id,book_item_id,borrower_id,due_at,returned_at,return_note,return_shelf_code,return_photo_url"
          )
          .eq("organization_id", profileData.organization_id)
          .eq("status", "returned")
          .eq("return_verification_status", "pending")
          .order("returned_at", { ascending: true }),
        supabase
          .from("book_loans")
          .select("id,book_item_id,borrower_id,requested_at,note")
          .eq("organization_id", profileData.organization_id)
          .eq("status", "requested")
          .order("requested_at", { ascending: true }),
      ]);

      if (!isMounted) return;

      const nextProgramSettings = settingsRes.error ? null : (settingsRes.data ?? null);
      const nextRuleCount = rulesRes.error ? 0 : (rulesRes.count ?? 0);
      const settingsErrorMessage = settingsRes.error
        ? toBooksDataErrorMessage(
            settingsRes.error.message,
            `도서 운영 설정 조회 실패: ${settingsRes.error.message}`
          )
        : null;
      const rulesErrorMessage = rulesRes.error ? `점수 규칙 조회 실패: ${rulesRes.error.message}` : null;
      const booksErrorMessage = catalogRes.error
        ? toBooksDataErrorMessage(
            catalogRes.error.message,
            `도서 목록 조회 실패: ${catalogRes.error.message}`
          )
        : null;
      setProgramSettings(nextProgramSettings);
      setRuleCount(nextRuleCount);
      setBookItems(catalogRes.error ? [] : ((catalogRes.data ?? []) as ManagedBookItem[]));

      const pendingReturnErrorMessage = pendingReturnRes.error
        ? toBooksDataErrorMessage(
            pendingReturnRes.error.message,
            `반납 검수 목록 조회 실패: ${pendingReturnRes.error.message}`
          )
        : null;
      const pendingRequestErrorMessage = pendingRequestRes.error
        ? toBooksDataErrorMessage(
            pendingRequestRes.error.message,
            `대여 요청 목록 조회 실패: ${pendingRequestRes.error.message}`
          )
        : null;
      const nextMessage =
        booksErrorMessage ??
        pendingRequestErrorMessage ??
        pendingReturnErrorMessage ??
        rulesErrorMessage ??
        settingsErrorMessage;
      setMessage(nextMessage);

      if (pendingReturnRes.error) {
        setPendingReturns([]);
      }
      if (pendingRequestRes.error) {
        setPendingRequests([]);
      }

      const pendingReturnRows = pendingReturnRes.error
        ? []
        : ((pendingReturnRes.data ?? []) as PendingReturnRow[]);
      const pendingRequestRows = pendingRequestRes.error
        ? []
        : ((pendingRequestRes.data ?? []) as PendingRequestRow[]);

      const bookIds = Array.from(
        new Set(
          [...pendingReturnRows, ...pendingRequestRows].map((row) => row.book_item_id)
        )
      );
      const borrowerIds = Array.from(
        new Set(
          [...pendingReturnRows, ...pendingRequestRows].map((row) => row.borrower_id)
        )
      );

      if (bookIds.length === 0 || borrowerIds.length === 0) {
        setPendingReturns([]);
        setPendingRequests([]);
        writeBooksManageCache({
          loading: false,
          hasPermission: true,
          organizationId: profileData.organization_id,
          currentUserId: user.id,
          booksEnabled: enabled,
          programSettings: nextProgramSettings,
          ruleCount: nextRuleCount,
          message: nextMessage,
          accessToken: sessionAccessToken,
          bookItems: catalogRes.error ? [] : ((catalogRes.data ?? []) as ManagedBookItem[]),
          pendingRequests: [],
          pendingReturns: [],
          fetchedAt: Date.now(),
        });
      } else {
        const [requestBookItemsRes, borrowersRes] = await Promise.all([
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
        (requestBookItemsRes.data ?? []).forEach((row) => {
          bookTitleById.set(row.id, row.title ?? "제목 없음");
        });

        const borrowerInfoById = new Map<string, { name: string | null; department: string | null }>();
        (borrowersRes.data ?? []).forEach((row) => {
          borrowerInfoById.set(row.id, {
            name: row.name ?? null,
            department: row.department ?? null,
          });
        });

        const nextPendingReturns = pendingReturnRows.map((row) => ({
            ...row,
            book_title: bookTitleById.get(row.book_item_id) ?? "제목 없음",
            borrower_name: borrowerInfoById.get(row.borrower_id)?.name ?? null,
            borrower_department: borrowerInfoById.get(row.borrower_id)?.department ?? null,
          }));
        const nextPendingRequests = pendingRequestRows.map((row) => ({
            ...row,
            book_title: bookTitleById.get(row.book_item_id) ?? "제목 없음",
            borrower_name: borrowerInfoById.get(row.borrower_id)?.name ?? null,
            borrower_department: borrowerInfoById.get(row.borrower_id)?.department ?? null,
          }));

        setPendingReturns(nextPendingReturns);
        setPendingRequests(nextPendingRequests);
        writeBooksManageCache({
          loading: false,
          hasPermission: true,
          organizationId: profileData.organization_id,
          currentUserId: user.id,
          booksEnabled: enabled,
          programSettings: nextProgramSettings,
          ruleCount: nextRuleCount,
          message: nextMessage,
          accessToken: sessionAccessToken,
          bookItems: catalogRes.error ? [] : ((catalogRes.data ?? []) as ManagedBookItem[]),
          pendingRequests: nextPendingRequests,
          pendingReturns: nextPendingReturns,
          fetchedAt: Date.now(),
        });
      }

      setLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [reloadTick]);

  useEffect(() => {
    if (activeTab !== "register") {
      setShowBookRegisterForm(false);
    }
  }, [activeTab]);

  const normalizeIsbn = (input: string) =>
    input.replace(/[^0-9Xx]/g, "").toUpperCase();

  const updateBookForm = (field: keyof typeof bookForm, value: string) => {
    setBookForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLookupByIsbn = async () => {
    const normalizedIsbn = normalizeIsbn(bookForm.isbn);
    if (!(normalizedIsbn.length === 10 || normalizedIsbn.length === 13)) {
      setBookRegisterMessage("ISBN 10자리 또는 13자리를 입력해주세요.");
      return;
    }

    setBookLookupLoading(true);
    setBookRegisterMessage(null);

    try {
      const response = await fetch(
        `/api/books/lookup?isbn=${encodeURIComponent(normalizedIsbn)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; book?: BookLookupPayload; meta?: { notice?: string } }
        | null;

      if (!response.ok || !result?.ok || !result.book) {
        setBookRegisterMessage(result?.message ?? "ISBN 조회에 실패했습니다.");
        return;
      }

      setBookForm((prev) => ({
        ...prev,
        isbn: result.book?.isbn ?? prev.isbn,
        title: result.book?.title ?? prev.title,
        author: result.book?.author ?? prev.author,
        publisher: result.book?.publisher ?? prev.publisher,
        publishedYear: result.book?.publishedYear
          ? String(result.book.publishedYear)
          : prev.publishedYear,
        coverImageUrl: result.book?.coverImageUrl ?? prev.coverImageUrl,
        description: result.book?.description ?? prev.description,
      }));
      const sourceLabel =
        result.book.source === "data4library"
          ? "도서관정보나루"
          : result.book.source === "nationallibrary"
          ? "국립중앙도서관"
          : result.book.source === "naverbook"
          ? "네이버 도서"
          : result.book.source === "openlibrary"
          ? "Open Library"
          : "Google Books";
      const noticeSuffix = result.meta?.notice ? ` · ${result.meta.notice}` : "";
      setBookRegisterMessage(
        `ISBN 조회 완료 (${sourceLabel})${noticeSuffix}`
      );
    } catch (error) {
      setBookRegisterMessage(
        error instanceof Error ? `ISBN 조회 오류: ${error.message}` : "ISBN 조회 중 오류가 발생했습니다."
      );
    } finally {
      setBookLookupLoading(false);
    }
  };

  const handleRegisterBook = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!organizationId || !currentUserId) {
      setBookRegisterMessage("기관 또는 사용자 정보를 찾을 수 없습니다.");
      return;
    }

    const title = bookForm.title.trim();
    if (!title) {
      setBookRegisterMessage("도서 제목은 필수입니다.");
      return;
    }

    const normalizedIsbn = normalizeIsbn(bookForm.isbn);
    const publishedYearRaw = bookForm.publishedYear.trim();
    let publishedYear: number | null = null;
    if (publishedYearRaw.length > 0) {
      const parsed = Number(publishedYearRaw);
      if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 2100) {
        setBookRegisterMessage("출판연도는 1000~2100 사이의 숫자로 입력해주세요.");
        return;
      }
      publishedYear = parsed;
    }

    const tags = Array.from(
      new Set(
        bookForm.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    setBookRegistering(true);
    setBookRegisterMessage(null);

    const { error } = await supabase.from("book_items").insert({
      organization_id: organizationId,
      owner_scope: "organization",
      owner_profile_id: null,
      created_by: currentUserId,
      title,
      author: bookForm.author.trim() || null,
      publisher: bookForm.publisher.trim() || null,
      published_year: publishedYear,
      isbn: normalizedIsbn || null,
      shelf_label: bookForm.shelfLabel.trim() || null,
      tags,
      cover_image_url: bookForm.coverImageUrl.trim() || null,
      description: bookForm.description.trim() || null,
      share_mode: "lend_only",
      status: "available",
      is_active: true,
    });

    if (error) {
      setBookRegisterMessage(
        toBooksDataErrorMessage(
          error.message,
          `도서 등록 실패: ${error.message}`
        )
      );
      setBookRegistering(false);
      return;
    }

    setBookRegisterMessage("도서가 등록되었습니다.");
    setShowBookRegisterForm(false);
    setBookForm({
      isbn: "",
      title: "",
      author: "",
      publisher: "",
      publishedYear: "",
      shelfLabel: "",
      tags: "",
      coverImageUrl: "",
      description: "",
    });
    setBookRegistering(false);
    setReloadTick((prev) => prev + 1);
  };

  const handleLoanDecision = async (loanId: string, decision: "approved" | "rejected") => {
    if (!accessToken) {
      setDecisionMessage("인증 토큰이 없어 대여 요청 처리를 진행할 수 없습니다.");
      return;
    }

    setDecidingLoanId(loanId);
    setDecisionMessage(null);

    const note = decisionNoteByLoanId[loanId]?.trim() || null;
    const dueDate = decisionDueDateByLoanId[loanId]?.trim() || null;

    if (decision === "rejected" && !note) {
      setDecisionMessage("거절 시에는 사유를 입력해주세요.");
      setDecidingLoanId(null);
      return;
    }

    try {
      const response = await fetch("/api/books/loans/decision", {
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
          dueAt: decision === "approved" ? dueDate : null,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.ok) {
        setDecisionMessage(result?.message ?? "대여 요청 처리에 실패했습니다.");
        return;
      }

      setDecisionMessage(decision === "approved" ? "대여 요청을 승인했습니다." : "대여 요청을 거절했습니다.");
      setDecisionNoteByLoanId((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
      setDecisionDueDateByLoanId((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
      setReloadTick((prev) => prev + 1);
    } catch (error) {
      setDecisionMessage(
        error instanceof Error ? `대여 요청 처리 오류: ${error.message}` : "대여 요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setDecidingLoanId(null);
    }
  };

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

  const requestKeyword = requestSearchKeyword.trim().toLowerCase();
  const returnKeyword = returnSearchKeyword.trim().toLowerCase();
  const bookKeyword = bookSearchKeyword.trim().toLowerCase();

  const filteredBookItems = useMemo(() => {
    return bookItems.filter((book) => {
      if (bookStatusFilter !== "all" && book.status !== bookStatusFilter) {
        return false;
      }
      if (!bookKeyword) {
        return true;
      }
      const searchable = [
        book.title,
        book.author ?? "",
        book.publisher ?? "",
        book.shelf_label ?? "",
        book.isbn ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(bookKeyword);
    });
  }, [bookItems, bookKeyword, bookStatusFilter]);

  const filteredPendingRequests = pendingRequests.filter((item) => {
    if (!requestKeyword) {
      return true;
    }
    const searchable = [item.book_title, item.borrower_name, item.borrower_department]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchable.includes(requestKeyword);
  });

  const filteredPendingReturns = pendingReturns.filter((item) => {
    if (!returnKeyword) {
      return true;
    }
    const searchable = [item.book_title, item.borrower_name, item.borrower_department, item.return_shelf_code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchable.includes(returnKeyword);
  });

  const tabs: Array<{ key: BookManageTab; label: string; count?: number }> = [
    { key: "register", label: "도서 목록", count: bookItems.length },
    { key: "requests", label: "대여 요청", count: pendingRequests.length },
    { key: "returns", label: "반납 검수", count: pendingReturns.length },
    { key: "settings", label: "운영 설정" },
  ];

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
        title="자원 관리"
        description="도서 카탈로그 등록과 대여 승인/반납 검수, 운영 정책을 한 화면에서 관리합니다."
      />
      <CategoryTabs />

      {!booksEnabled ? (
        <Notice variant="warning" className="text-left">
          도서 기능이 비활성화되어 있습니다.{" "}
          <Link href="/settings/menu" className="underline font-medium">
            메뉴 설정
          </Link>
          에서 `도서`를 활성화하세요.
        </Notice>
      ) : (
        <>
          <ManageSubmenuLayout
            items={tabs}
            activeKey={activeTab}
            onChange={setActiveTab}
            menuTitle="도서 관리"
          >
              {activeTab === "register" ? (
                <SectionCard
                  title={showBookRegisterForm ? "도서 등록" : "등록된 도서"}
                  description={
                    showBookRegisterForm
                      ? "ISBN 조회 후 도서 카탈로그에 등록할 수 있습니다."
                      : "등록된 도서를 조회하고, 필요할 때 등록 화면으로 전환할 수 있습니다."
                  }
                  actions={
                    <button
                      type="button"
                      className={showBookRegisterForm ? "btn-outline" : "btn-primary"}
                      onClick={() => setShowBookRegisterForm((prev) => !prev)}
                    >
                      {showBookRegisterForm ? "목록 보기" : "도서 등록"}
                    </button>
                  }
                >
                  {showBookRegisterForm ? (
                    <form id="book-register" className="space-y-3" onSubmit={handleRegisterBook}>
                      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <input
                          className="form-input"
                          placeholder="ISBN (10/13자리)"
                          value={bookForm.isbn}
                          onChange={(event) => updateBookForm("isbn", event.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-outline h-10 px-4"
                          onClick={() => void handleLookupByIsbn()}
                          disabled={bookLookupLoading}
                        >
                          {bookLookupLoading ? "조회 중..." : "ISBN 조회"}
                        </button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="form-input"
                          placeholder="도서 제목 *"
                          value={bookForm.title}
                          onChange={(event) => updateBookForm("title", event.target.value)}
                          required
                        />
                        <input
                          className="form-input"
                          placeholder="저자"
                          value={bookForm.author}
                          onChange={(event) => updateBookForm("author", event.target.value)}
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="form-input"
                          placeholder="출판사"
                          value={bookForm.publisher}
                          onChange={(event) => updateBookForm("publisher", event.target.value)}
                        />
                        <input
                          className="form-input"
                          placeholder="출판연도 (예: 2024)"
                          value={bookForm.publishedYear}
                          onChange={(event) => updateBookForm("publishedYear", event.target.value)}
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="form-input"
                          placeholder="서가 라벨 (예: B2-03)"
                          value={bookForm.shelfLabel}
                          onChange={(event) => updateBookForm("shelfLabel", event.target.value)}
                        />
                        <input
                          className="form-input"
                          placeholder="태그 (쉼표로 구분)"
                          value={bookForm.tags}
                          onChange={(event) => updateBookForm("tags", event.target.value)}
                        />
                      </div>
                      <input
                        className="form-input"
                        placeholder="표지 이미지 URL"
                        value={bookForm.coverImageUrl}
                        onChange={(event) => updateBookForm("coverImageUrl", event.target.value)}
                      />
                      <textarea
                        className="form-textarea min-h-[96px]"
                        placeholder="도서 설명 (선택)"
                        value={bookForm.description}
                        onChange={(event) => updateBookForm("description", event.target.value)}
                      />
                      <div className="flex justify-end">
                        <button type="submit" className="btn-primary px-5" disabled={bookRegistering}>
                          {bookRegistering ? "등록 중..." : "도서 등록"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="module-toolbar space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="module-kpi">총 {bookItems.length}권</span>
                            <button
                              type="button"
                              onClick={() => setReloadTick((prev) => prev + 1)}
                              className="btn-outline"
                            >
                              새로고침
                            </button>
                          </div>
                          <input
                            className="form-input text-sm md:w-80"
                            placeholder="제목/저자/출판사/ISBN 검색"
                            value={bookSearchKeyword}
                            onChange={(event) => setBookSearchKeyword(event.target.value)}
                          />
                        </div>
                        <StatusFilterPills
                          options={bookStatusFilterOptions}
                          value={bookStatusFilter}
                          onChange={(next) => setBookStatusFilter(next as ManagedBookStatus | "all")}
                        />
                      </div>

                      {filteredBookItems.length === 0 ? (
                        <Notice>
                          {bookItems.length === 0
                            ? "등록된 도서가 없습니다. 우측 상단 `도서 등록` 버튼으로 추가하세요."
                            : "조건에 맞는 도서가 없습니다."}
                        </Notice>
                      ) : (
                        <div className="module-list module-list-resources">
                          <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_7rem]">
                            <span>도서 정보</span>
                            <span className="text-right">상태</span>
                          </div>
                          {filteredBookItems.map((book) => (
                            <div
                              key={book.id}
                              className="list-row text-sm lg:grid lg:grid-cols-[minmax(0,1fr)_7rem] lg:items-center"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{book.title}</p>
                                <p className="mt-1 truncate text-xs text-neutral-600">
                                  {book.author || "저자 미상"}
                                  {book.publisher ? ` · ${book.publisher}` : ""}
                                  {book.published_year ? ` · ${book.published_year}` : ""}
                                  {book.shelf_label ? ` · 서가 ${book.shelf_label}` : ""}
                                  {book.isbn ? ` · ISBN ${book.isbn}` : ""}
                                </p>
                              </div>
                              <span
                                className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium ring-1 lg:justify-self-end ${
                                  BOOK_STATUS_BADGE_CLASS[book.status]
                                }`}
                              >
                                {BOOK_STATUS_LABEL[book.status]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>
              ) : null}

              {activeTab === "requests" ? (
                <SectionCard
                  title="대여 요청 대기"
                  description="신청 도서를 승인/거절하면 대여 상태가 자동 갱신됩니다."
                >
                  <div className="module-toolbar mb-4">
                    <div className="module-toolbar-grid">
                      <input
                        className="form-input"
                        placeholder="도서명/신청자/부서 검색"
                        value={requestSearchKeyword}
                        onChange={(event) => setRequestSearchKeyword(event.target.value)}
                      />
                      <div className="field-static justify-between">
                        <span>처리 대상</span>
                        <span className="font-semibold text-slate-900">{filteredPendingRequests.length}건</span>
                      </div>
                    </div>
                  </div>
                  {filteredPendingRequests.length === 0 ? (
                    <Notice className="p-4">
                      {requestSearchKeyword ? "검색 결과가 없습니다." : "처리 대기중인 대여 요청이 없습니다."}
                    </Notice>
                  ) : (
                    <ul className="space-y-3">
                      {filteredPendingRequests.map((item) => (
                        <li key={item.id} className="rounded-xl border border-neutral-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{item.book_title}</p>
                              <p className="mt-1 text-xs text-neutral-600">
                                {item.borrower_name ?? item.borrower_id.slice(0, 8)}
                                {item.borrower_department ? ` (${item.borrower_department})` : ""}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                신청일: {new Date(item.requested_at).toLocaleString("ko-KR")}
                              </p>
                              {item.note && (
                                <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                                  {item.note}
                                </p>
                              )}
                            </div>
                            <span className="inline-flex h-7 items-center rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-700">
                              승인 대기
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto_auto]">
                            <input
                              className="form-input"
                              placeholder="운영 메모 (거절 시 필수)"
                              value={decisionNoteByLoanId[item.id] ?? ""}
                              onChange={(event) =>
                                setDecisionNoteByLoanId((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                            <input
                              type="date"
                              className="form-input"
                              value={decisionDueDateByLoanId[item.id] ?? ""}
                              onChange={(event) =>
                                setDecisionDueDateByLoanId((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="btn-primary h-10 px-4"
                              onClick={() => void handleLoanDecision(item.id, "approved")}
                              disabled={decidingLoanId === item.id}
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              className="btn-ghost h-10 px-4 text-rose-700 hover:bg-rose-50"
                              onClick={() => void handleLoanDecision(item.id, "rejected")}
                              disabled={decidingLoanId === item.id}
                            >
                              거절
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              ) : null}

              {activeTab === "returns" ? (
                <SectionCard
                  title="반납 검수 대기"
                  description="사용자가 등록한 반납을 승인/반려하면 점수가 확정됩니다."
                >
                  <div className="module-toolbar mb-4">
                    <div className="module-toolbar-grid">
                      <input
                        className="form-input"
                        placeholder="도서명/반납자/서가코드 검색"
                        value={returnSearchKeyword}
                        onChange={(event) => setReturnSearchKeyword(event.target.value)}
                      />
                      <div className="field-static justify-between">
                        <span>검수 대상</span>
                        <span className="font-semibold text-slate-900">{filteredPendingReturns.length}건</span>
                      </div>
                    </div>
                  </div>
                  {filteredPendingReturns.length === 0 ? (
                    <Notice className="p-4">
                      {returnSearchKeyword ? "검색 결과가 없습니다." : "검수 대기중인 반납이 없습니다."}
                    </Notice>
                  ) : (
                    <ul className="space-y-3">
                      {filteredPendingReturns.map((item) => (
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
                                {item.returned_at ? new Date(item.returned_at).toLocaleString("ko-KR") : "-"}
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
              ) : null}

              {activeTab === "settings" ? (
                <>
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

                  {organizationId ? (
                    <SectionCard title="다음 단계" description="운영 설정 이후 연결할 기능입니다.">
                      <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
                        <li>도서 상세에서 응원 버튼과 메모 작성 흐름 연결</li>
                        <li>월말 리더보드 스냅샷 및 시상 확정 배치 작업 연결</li>
                        <li>반납 사진 업로드/검수 SLA 알림 자동화</li>
                      </ol>
                    </SectionCard>
                  ) : null}
                </>
              ) : null}
          </ManageSubmenuLayout>
        </>
      )}

      {message && (
        <Notice variant="warning" className="text-left">
          {message}
        </Notice>
      )}
      {bookRegisterMessage && (
        <Notice
          variant={bookRegisterMessage.includes("실패") || bookRegisterMessage.includes("오류") ? "warning" : "neutral"}
          className="text-left"
        >
          {bookRegisterMessage}
        </Notice>
      )}
      {decisionMessage && (
        <Notice
          variant={decisionMessage.includes("실패") || decisionMessage.includes("오류") ? "warning" : "neutral"}
          className="text-left"
        >
          {decisionMessage}
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

    </ManageLayout>
  );
}
