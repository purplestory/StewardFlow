import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type DecisionBody = {
  accessToken?: string;
  loanId?: string;
  decision?: "approved" | "rejected";
  note?: string;
  dueAt?: string;
};

type ProfileRow = {
  organization_id: string | null;
  role: "admin" | "manager" | "user" | null;
};

type LoanRow = {
  id: string;
  organization_id: string;
  book_item_id: string;
  borrower_id: string;
  status:
    | "requested"
    | "approved"
    | "borrowed"
    | "returned"
    | "rejected"
    | "cancelled"
    | "overdue";
};

type BookItemRow = {
  id: string;
  status: "available" | "requested" | "borrowed" | "overdue" | "archived";
  is_active: boolean;
};

type OtherActiveLoanRow = {
  status: "requested" | "approved" | "borrowed" | "overdue";
};

const isUuid = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

async function getAuthedUser(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  return userData.user ?? null;
}

function resolveBookStatusFromActiveLoans(rows: OtherActiveLoanRow[]) {
  if (rows.some((row) => row.status === "overdue")) return "overdue";
  if (rows.some((row) => row.status === "borrowed" || row.status === "approved")) return "borrowed";
  if (rows.some((row) => row.status === "requested")) return "requested";
  return "available";
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경 변수가 없습니다." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as DecisionBody | null;
  const accessToken = body?.accessToken?.trim();
  const loanId = body?.loanId?.trim();
  const decision = body?.decision;
  const note = body?.note?.trim() || null;
  const dueAtRaw = body?.dueAt?.trim() || null;

  if (!accessToken || !loanId || !isUuid(loanId) || !decision) {
    return NextResponse.json(
      { ok: false, message: "accessToken, loanId, decision이 필요합니다." },
      { status: 400 }
    );
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data: actorProfile, error: actorError } = await admin
    .from("profiles")
    .select("organization_id,role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (actorError || !actorProfile?.organization_id) {
    return NextResponse.json(
      { ok: false, message: "사용자 기관 정보를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  if (!(actorProfile.role === "admin" || actorProfile.role === "manager")) {
    return NextResponse.json(
      { ok: false, message: "대여 요청 처리는 관리자/매니저만 가능합니다." },
      { status: 403 }
    );
  }

  const { data: loan, error: loanError } = await admin
    .from("book_loans")
    .select("id,organization_id,book_item_id,borrower_id,status")
    .eq("id", loanId)
    .maybeSingle<LoanRow>();

  if (loanError || !loan) {
    return NextResponse.json(
      { ok: false, message: "대여 요청 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (loan.organization_id !== actorProfile.organization_id) {
    return NextResponse.json(
      { ok: false, message: "다른 기관의 대여 요청에는 접근할 수 없습니다." },
      { status: 403 }
    );
  }

  if (loan.status !== "requested") {
    return NextResponse.json(
      { ok: false, message: `현재 상태(${loan.status})에서는 요청 처리를 할 수 없습니다.` },
      { status: 400 }
    );
  }

  const { data: bookItem, error: bookError } = await admin
    .from("book_items")
    .select("id,status,is_active")
    .eq("id", loan.book_item_id)
    .maybeSingle<BookItemRow>();

  if (bookError || !bookItem) {
    return NextResponse.json({ ok: false, message: "도서 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!bookItem.is_active || bookItem.status === "archived") {
    return NextResponse.json(
      { ok: false, message: "보관 처리된 도서는 대여 승인할 수 없습니다." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();

  let parsedDueAt: string | null = null;
  if (decision === "approved" && dueAtRaw) {
    const parsed = new Date(dueAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { ok: false, message: "dueAt 형식이 올바르지 않습니다. (예: 2026-02-28)" },
        { status: 400 }
      );
    }
    parsedDueAt = parsed.toISOString();
  }

  if (decision === "rejected" && !note) {
    return NextResponse.json(
      { ok: false, message: "거절 시에는 사유(note)를 입력해주세요." },
      { status: 400 }
    );
  }

  const nextLoanStatus = decision === "approved" ? "borrowed" : "rejected";
  const { error: loanUpdateError } = await admin
    .from("book_loans")
    .update({
      status: nextLoanStatus,
      approved_at: decision === "approved" ? nowIso : null,
      borrowed_at: decision === "approved" ? nowIso : null,
      due_at: decision === "approved" ? parsedDueAt : null,
      note,
      checkout_method: "staff",
    })
    .eq("id", loan.id);

  if (loanUpdateError) {
    return NextResponse.json(
      { ok: false, message: `대여 요청 상태 업데이트 실패: ${loanUpdateError.message}` },
      { status: 400 }
    );
  }

  let nextBookStatus: "available" | "requested" | "borrowed" | "overdue";
  if (decision === "approved") {
    nextBookStatus = "borrowed";
  } else {
    const { data: remainingRows, error: remainingError } = await admin
      .from("book_loans")
      .select("status")
      .eq("organization_id", loan.organization_id)
      .eq("book_item_id", loan.book_item_id)
      .neq("id", loan.id)
      .in("status", ["requested", "approved", "borrowed", "overdue"])
      .returns<OtherActiveLoanRow[]>();

    if (remainingError) {
      return NextResponse.json(
        { ok: false, message: `후속 대여 상태 조회 실패: ${remainingError.message}` },
        { status: 400 }
      );
    }
    nextBookStatus = resolveBookStatusFromActiveLoans(remainingRows ?? []);
  }

  const { error: itemUpdateError } = await admin
    .from("book_items")
    .update({ status: nextBookStatus })
    .eq("id", loan.book_item_id);

  if (itemUpdateError) {
    return NextResponse.json(
      { ok: false, message: `도서 상태 업데이트 실패: ${itemUpdateError.message}` },
      { status: 400 }
    );
  }

  await admin.from("audit_logs").insert({
    organization_id: loan.organization_id,
    actor_id: user.id,
    action: "book_loan_decision",
    target_type: "book_loan",
    target_id: loan.id,
    metadata: {
      decision,
      note,
      due_at: parsedDueAt,
      borrower_id: loan.borrower_id,
      book_item_id: loan.book_item_id,
      loan_status: nextLoanStatus,
      book_status: nextBookStatus,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      loanId: loan.id,
      decision,
      loanStatus: nextLoanStatus,
      bookStatus: nextBookStatus,
      dueAt: parsedDueAt,
    },
  });
}
