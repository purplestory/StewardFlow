import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { awardBookPoints } from "@/lib/book-gamification-award";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type VerifyBody = {
  accessToken?: string;
  loanId?: string;
  decision?: "verified" | "rejected";
  note?: string;
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
  due_at: string | null;
  return_verification_status: "not_required" | "pending" | "verified" | "rejected";
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

  const body = (await request.json().catch(() => null)) as VerifyBody | null;
  const accessToken = body?.accessToken?.trim();
  const loanId = body?.loanId?.trim();
  const decision = body?.decision;
  const note = body?.note?.trim() || null;

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
      { ok: false, message: "반납 확인은 관리자/매니저만 가능합니다." },
      { status: 403 }
    );
  }

  const { data: loan, error: loanError } = await admin
    .from("book_loans")
    .select("id,organization_id,book_item_id,borrower_id,status,due_at,return_verification_status")
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

  if (loan.status !== "returned" || loan.return_verification_status !== "pending") {
    return NextResponse.json(
      { ok: false, message: "확인 대기 상태의 반납 건만 처리할 수 있습니다." },
      { status: 400 }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const dueAt = loan.due_at ? new Date(loan.due_at) : null;
  const overdue = Boolean(dueAt && now.getTime() > dueAt.getTime());
  const rollbackLoanStatus = overdue ? "overdue" : "borrowed";

  const { error: loanUpdateError } = await admin
    .from("book_loans")
    .update({
      return_verification_status: decision,
      return_verification_note: note,
      return_verified_by: user.id,
      return_verified_at: nowIso,
      status: decision === "rejected" ? rollbackLoanStatus : "returned",
    })
    .eq("id", loan.id);

  if (loanUpdateError) {
    return NextResponse.json(
      { ok: false, message: `반납 확인 상태 업데이트 실패: ${loanUpdateError.message}` },
      { status: 400 }
    );
  }

  const { error: evidenceUpdateError } = await admin
    .from("book_return_evidences")
    .update({
      verify_status: decision,
      verify_note: note,
      verified_by: user.id,
      verified_at: nowIso,
    })
    .eq("loan_id", loan.id)
    .eq("verify_status", "pending");

  if (evidenceUpdateError) {
    return NextResponse.json(
      { ok: false, message: `반납 증빙 업데이트 실패: ${evidenceUpdateError.message}` },
      { status: 400 }
    );
  }

  const nextBookStatus = decision === "verified" ? "available" : overdue ? "overdue" : "borrowed";

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

  const awardResults: Array<{ ruleKey: string; awardedPoints: number }> = [];
  if (decision === "verified") {
    const { data: existsRow } = await admin
      .from("book_point_ledger")
      .select("id")
      .eq("organization_id", loan.organization_id)
      .eq("profile_id", loan.borrower_id)
      .eq("source_id", loan.id)
      .eq("rule_key", "book_complete")
      .limit(1)
      .maybeSingle();

    if (!existsRow) {
      try {
        const completeResult = await awardBookPoints({
          admin,
          organizationId: loan.organization_id,
          profileId: loan.borrower_id,
          ruleKey: "book_complete",
          sourceId: loan.id,
          sourceDate: now,
          metadata: { loanId: loan.id, verifiedBy: user.id },
          actorId: user.id,
        });
        awardResults.push({
          ruleKey: "book_complete",
          awardedPoints: completeResult.awardedPoints,
        });

        if (overdue) {
          const penaltyResult = await awardBookPoints({
            admin,
            organizationId: loan.organization_id,
            profileId: loan.borrower_id,
            ruleKey: "overdue_penalty",
            sourceId: loan.id,
            sourceDate: now,
            metadata: { loanId: loan.id, dueAt: loan.due_at, verifiedBy: user.id },
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
            metadata: { loanId: loan.id, dueAt: loan.due_at, verifiedBy: user.id },
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
          action: "book_return_verify_points_award_failed",
          target_type: "book_loan",
          target_id: loan.id,
          metadata: {
            error: error instanceof Error ? error.message : "unknown",
          },
        });
      }
    }
  }

  await admin.from("audit_logs").insert({
    organization_id: loan.organization_id,
    actor_id: user.id,
    action: "book_loan_return_verification",
    target_type: "book_loan",
    target_id: loan.id,
    metadata: {
      decision,
      note,
      book_item_id: loan.book_item_id,
      borrower_id: loan.borrower_id,
      awarded: awardResults,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      loanId: loan.id,
      decision,
      pointsAwarded: awardResults,
    },
  });
}
