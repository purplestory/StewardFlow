import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type RequestBody = {
  accessToken?: string;
  bookItemId?: string;
  note?: string;
};

type ProfileRow = {
  organization_id: string | null;
};

type BookItemRow = {
  id: string;
  organization_id: string;
  owner_profile_id: string | null;
  status: "available" | "requested" | "borrowed" | "overdue" | "archived";
  is_active: boolean;
};

type ActiveLoanRow = {
  id: string;
  borrower_id: string;
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

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경 변수가 없습니다." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const accessToken = body?.accessToken?.trim();
  const bookItemId = body?.bookItemId?.trim();
  const note = body?.note?.trim() || null;

  if (!accessToken || !bookItemId || !isUuid(bookItemId)) {
    return NextResponse.json(
      { ok: false, message: "accessToken과 유효한 bookItemId가 필요합니다." },
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
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (actorError || !actorProfile?.organization_id) {
    return NextResponse.json(
      { ok: false, message: "사용자 기관 정보를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  const { data: bookItem, error: bookError } = await admin
    .from("book_items")
    .select("id,organization_id,owner_profile_id,status,is_active")
    .eq("id", bookItemId)
    .maybeSingle<BookItemRow>();

  if (bookError || !bookItem) {
    return NextResponse.json({ ok: false, message: "도서를 찾을 수 없습니다." }, { status: 404 });
  }

  if (bookItem.organization_id !== actorProfile.organization_id) {
    return NextResponse.json(
      { ok: false, message: "다른 기관의 도서에는 대여 요청할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!bookItem.is_active || bookItem.status === "archived") {
    return NextResponse.json(
      { ok: false, message: "보관 처리된 도서는 대여 요청할 수 없습니다." },
      { status: 400 }
    );
  }

  const { data: activeLoans, error: activeLoanError } = await admin
    .from("book_loans")
    .select("id,borrower_id,status")
    .eq("organization_id", actorProfile.organization_id)
    .eq("book_item_id", bookItem.id)
    .in("status", ["requested", "approved", "borrowed", "overdue"])
    .order("requested_at", { ascending: false })
    .returns<ActiveLoanRow[]>();

  if (activeLoanError) {
    return NextResponse.json(
      { ok: false, message: `기존 대여 상태를 확인하지 못했습니다: ${activeLoanError.message}` },
      { status: 400 }
    );
  }

  const myExisting = (activeLoans ?? []).find((row) => row.borrower_id === user.id);
  if (myExisting) {
    return NextResponse.json({
      ok: true,
      message:
        myExisting.status === "requested"
          ? "이미 대여 요청이 접수되어 있습니다."
          : "이미 대여중인 도서입니다.",
      result: {
        loanId: myExisting.id,
        status: myExisting.status,
        alreadyExists: true,
      },
    });
  }

  const hasActiveByOthers = (activeLoans ?? []).some((row) => row.borrower_id !== user.id);
  if (hasActiveByOthers || bookItem.status !== "available") {
    const statusLabel =
      bookItem.status === "requested"
        ? "요청 처리중"
        : bookItem.status === "borrowed"
          ? "대여 중"
          : bookItem.status === "overdue"
            ? "연체"
            : "대여 불가";

    return NextResponse.json(
      { ok: false, message: `현재 도서 상태가 ${statusLabel}이어서 요청할 수 없습니다.` },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();

  const { data: insertedLoan, error: insertError } = await admin
    .from("book_loans")
    .insert({
      organization_id: actorProfile.organization_id,
      book_item_id: bookItem.id,
      borrower_id: user.id,
      owner_profile_id: bookItem.owner_profile_id,
      status: "requested",
      requested_at: nowIso,
      note,
    })
    .select("id,status,requested_at")
    .single();

  if (insertError || !insertedLoan) {
    return NextResponse.json(
      { ok: false, message: `대여 요청 등록 실패: ${insertError?.message ?? "unknown"}` },
      { status: 400 }
    );
  }

  const { error: itemUpdateError } = await admin
    .from("book_items")
    .update({ status: "requested" })
    .eq("id", bookItem.id);

  if (itemUpdateError) {
    return NextResponse.json(
      { ok: false, message: `도서 상태 업데이트 실패: ${itemUpdateError.message}` },
      { status: 400 }
    );
  }

  await admin.from("audit_logs").insert({
    organization_id: actorProfile.organization_id,
    actor_id: user.id,
    action: "book_loan_request",
    target_type: "book_loan",
    target_id: insertedLoan.id,
    metadata: {
      book_item_id: bookItem.id,
      borrower_id: user.id,
      note,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      loanId: insertedLoan.id,
      status: insertedLoan.status,
      requestedAt: insertedLoan.requested_at,
    },
  });
}
