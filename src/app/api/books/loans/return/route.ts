import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { awardBookPoints } from "@/lib/book-gamification-award";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type ReturnBody = {
  accessToken?: string;
  loanId?: string;
  returnNote?: string;
  returnMethod?: "staff" | "self_photo";
  returnShelfCode?: string;
  returnPhotoUrl?: string;
  returnPhotoUrls?: string[];
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
  due_at: string | null;
};

type ProfileRow = {
  organization_id: string | null;
  role: "admin" | "manager" | "user" | null;
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

  const body = (await request.json().catch(() => null)) as ReturnBody | null;
  const accessToken = body?.accessToken?.trim();
  const loanId = body?.loanId?.trim();
  const returnMethod = body?.returnMethod ?? "self_photo";
  const returnNote = body?.returnNote?.trim() || null;
  const returnShelfCode = body?.returnShelfCode?.trim() || null;
  const returnPhotoUrls = Array.isArray(body?.returnPhotoUrls)
    ? body?.returnPhotoUrls.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  const returnPhotoUrl = body?.returnPhotoUrl?.trim() || returnPhotoUrls[0] || null;

  if (!accessToken || !loanId || !isUuid(loanId)) {
    return NextResponse.json(
      { ok: false, message: "accessToken과 유효한 loanId가 필요합니다." },
      { status: 400 }
    );
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: actorProfile, error: actorProfileError } = await admin
    .from("profiles")
    .select("organization_id,role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (actorProfileError || !actorProfile?.organization_id) {
    return NextResponse.json(
      { ok: false, message: "사용자 기관 정보를 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  const { data: loan, error: loanError } = await admin
    .from("book_loans")
    .select("id,organization_id,book_item_id,borrower_id,status,due_at")
    .eq("id", loanId)
    .maybeSingle<LoanRow>();

  if (loanError || !loan) {
    return NextResponse.json(
      { ok: false, message: "대출 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (loan.organization_id !== actorProfile.organization_id) {
    return NextResponse.json(
      { ok: false, message: "다른 기관의 대출 정보에는 접근할 수 없습니다." },
      { status: 403 }
    );
  }

  const isManager = actorProfile.role === "admin" || actorProfile.role === "manager";
  const canReturn = isManager || loan.borrower_id === user.id;
  if (!canReturn) {
    return NextResponse.json(
      { ok: false, message: "반납 처리 권한이 없습니다." },
      { status: 403 }
    );
  }

  if (loan.status === "returned") {
    return NextResponse.json(
      { ok: true, message: "이미 반납 처리된 대출입니다.", alreadyReturned: true },
      { status: 200 }
    );
  }

  if (!["approved", "borrowed", "overdue"].includes(loan.status)) {
    return NextResponse.json(
      { ok: false, message: `현재 상태(${loan.status})에서는 반납 처리를 할 수 없습니다.` },
      { status: 400 }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const dueAt = loan.due_at ? new Date(loan.due_at) : null;
  const isOverdueReturn = Boolean(dueAt && now.getTime() > dueAt.getTime());

  const returnVerificationStatus =
    isManager && returnMethod === "staff"
      ? "verified"
      : returnPhotoUrl || returnPhotoUrls.length > 0
        ? "pending"
        : "not_required";
  const evidenceVerifyStatus =
    returnVerificationStatus === "pending" ? "pending" : "verified";

  const { error: updateLoanError } = await admin
    .from("book_loans")
    .update({
      status: "returned",
      returned_at: nowIso,
      return_note: returnNote,
      return_method: returnMethod,
      return_shelf_code: returnShelfCode,
      return_photo_url: returnPhotoUrl,
      return_verification_status: returnVerificationStatus,
      return_verified_by: returnVerificationStatus === "verified" ? user.id : null,
      return_verified_at: returnVerificationStatus === "verified" ? nowIso : null,
    })
    .eq("id", loan.id);

  if (updateLoanError) {
    return NextResponse.json(
      { ok: false, message: `반납 상태 업데이트 실패: ${updateLoanError.message}` },
      { status: 400 }
    );
  }

  const nextBookStatus =
    returnVerificationStatus === "pending"
      ? isOverdueReturn
        ? "overdue"
        : "borrowed"
      : "available";

  const { error: updateItemError } = await admin
    .from("book_items")
    .update({ status: nextBookStatus })
    .eq("id", loan.book_item_id);

  if (updateItemError) {
    return NextResponse.json(
      { ok: false, message: `도서 상태 업데이트 실패: ${updateItemError.message}` },
      { status: 400 }
    );
  }

  const { error: evidenceError } = await admin.from("book_return_evidences").insert({
    organization_id: loan.organization_id,
    loan_id: loan.id,
    book_item_id: loan.book_item_id,
    returned_by: user.id,
    shelf_code: returnShelfCode,
    photo_url: returnPhotoUrl,
    photo_urls: returnPhotoUrls,
    verify_status: evidenceVerifyStatus,
    verify_note: returnNote,
    verified_by: returnVerificationStatus === "verified" ? user.id : null,
    verified_at: returnVerificationStatus === "verified" ? nowIso : null,
  });

  if (evidenceError) {
    return NextResponse.json(
      { ok: false, message: `반납 증빙 저장 실패: ${evidenceError.message}` },
      { status: 400 }
    );
  }

  const shouldAwardNow = returnVerificationStatus === "verified" || returnVerificationStatus === "not_required";
  const awardResults: Array<{ ruleKey: string; awardedPoints: number }> = [];

  if (shouldAwardNow) {
    try {
      const completeResult = await awardBookPoints({
        admin,
        organizationId: loan.organization_id,
        profileId: loan.borrower_id,
        ruleKey: "book_complete",
        sourceId: loan.id,
        sourceDate: now,
        metadata: {
          loanId: loan.id,
          bookItemId: loan.book_item_id,
          returnMethod,
          returnVerificationStatus,
        },
        actorId: user.id,
      });
      awardResults.push({
        ruleKey: "book_complete",
        awardedPoints: completeResult.awardedPoints,
      });

      if (isOverdueReturn) {
        const penaltyResult = await awardBookPoints({
          admin,
          organizationId: loan.organization_id,
          profileId: loan.borrower_id,
          ruleKey: "overdue_penalty",
          sourceId: loan.id,
          sourceDate: now,
          metadata: {
            loanId: loan.id,
            dueAt: loan.due_at,
          },
          actorId: user.id,
        });
        awardResults.push({
          ruleKey: "overdue_penalty",
          awardedPoints: penaltyResult.awardedPoints,
        });
      } else if (loan.due_at) {
        const onTimeResult = await awardBookPoints({
          admin,
          organizationId: loan.organization_id,
          profileId: loan.borrower_id,
          ruleKey: "on_time_return",
          sourceId: loan.id,
          sourceDate: now,
          metadata: {
            loanId: loan.id,
            dueAt: loan.due_at,
          },
          actorId: user.id,
        });
        awardResults.push({
          ruleKey: "on_time_return",
          awardedPoints: onTimeResult.awardedPoints,
        });
      }
    } catch (error) {
      await admin.from("audit_logs").insert({
        organization_id: loan.organization_id,
        actor_id: user.id,
        action: "book_return_points_award_failed",
        target_type: "book_loan",
        target_id: loan.id,
        metadata: {
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  }

  await admin.from("audit_logs").insert({
    organization_id: loan.organization_id,
    actor_id: user.id,
    action: "book_loan_return",
    target_type: "book_loan",
    target_id: loan.id,
    metadata: {
      return_method: returnMethod,
      return_verification_status: returnVerificationStatus,
      borrower_id: loan.borrower_id,
      book_item_id: loan.book_item_id,
      is_overdue_return: isOverdueReturn,
      awarded: awardResults,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      loanId: loan.id,
      returnVerificationStatus,
      pointsAwarded: awardResults,
      pendingVerification: returnVerificationStatus === "pending",
    },
  });
}
