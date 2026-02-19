import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { computeRankTier, getRuleMeta, toUtcDateKey, toUtcMonthKey } from "@/lib/book-gamification";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CheerBody = {
  accessToken?: string;
  toProfileId?: string;
  targetType?: "progress" | "note" | "quiz" | "ranking";
  targetId?: string;
  message?: string;
};

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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

  const body = (await request.json().catch(() => null)) as CheerBody | null;
  const accessToken = body?.accessToken?.trim();
  const toProfileId = body?.toProfileId?.trim();
  const targetType = body?.targetType ?? "progress";
  const targetId = isUuid(body?.targetId) ? body?.targetId : null;
  const message = body?.message?.trim() || null;

  if (!accessToken || !toProfileId) {
    return NextResponse.json(
      { ok: false, message: "accessToken, toProfileId가 필요합니다." },
      { status: 400 }
    );
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  if (user.id === toProfileId) {
    return NextResponse.json(
      { ok: false, message: "자기 자신에게는 응원할 수 없습니다." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();
  const [senderProfileRes, recipientProfileRes] = await Promise.all([
    admin.from("profiles").select("organization_id").eq("id", user.id).maybeSingle(),
    admin.from("profiles").select("organization_id").eq("id", toProfileId).maybeSingle(),
  ]);

  const senderOrgId = senderProfileRes.data?.organization_id;
  const recipientOrgId = recipientProfileRes.data?.organization_id;

  if (!senderOrgId || !recipientOrgId || senderOrgId !== recipientOrgId) {
    return NextResponse.json(
      { ok: false, message: "같은 기관 사용자에게만 응원할 수 있습니다." },
      { status: 400 }
    );
  }

  const organizationId = senderOrgId;
  const { data: settings } = await admin
    .from("book_program_settings")
    .select("gamification_enabled,cheer_enabled,daily_point_cap")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (settings?.gamification_enabled === false || settings?.cheer_enabled === false) {
    return NextResponse.json(
      { ok: false, message: "응원 기능이 비활성화되어 있습니다." },
      { status: 403 }
    );
  }

  const { data: cheerRow, error: cheerError } = await admin
    .from("book_cheers")
    .insert({
      organization_id: organizationId,
      from_profile_id: user.id,
      to_profile_id: toProfileId,
      target_type: targetType,
      target_id: targetId,
      message,
    })
    .select("id,created_at")
    .maybeSingle();

  if (cheerError) {
    if (cheerError.message.includes("idx_book_cheers_daily_unique")) {
      return NextResponse.json(
        { ok: false, message: "같은 대상에는 하루 1회만 응원할 수 있습니다." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, message: `응원 등록 실패: ${cheerError.message}` },
      { status: 400 }
    );
  }

  const todayKey = toUtcDateKey(new Date());
  const { data: cheerRule } = await admin
    .from("book_scoring_rules")
    .select("enabled,point_value,daily_limit")
    .eq("organization_id", organizationId)
    .eq("rule_key", "cheer_received")
    .maybeSingle();

  const cheerRuleMeta = getRuleMeta("cheer_received");
  const configuredPoint = cheerRule?.point_value ?? cheerRuleMeta.defaultPointValue;
  const dayPointCap = settings?.daily_point_cap ?? 120;
  const ruleDailyCap = cheerRule?.daily_limit ?? null;
  const ruleEnabled = cheerRule?.enabled ?? true;

  const [dayPointRowsRes, ruleDayRowsRes] = await Promise.all([
    admin
      .from("book_point_ledger")
      .select("points")
      .eq("organization_id", organizationId)
      .eq("profile_id", toProfileId)
      .eq("source_date", todayKey),
    admin
      .from("book_point_ledger")
      .select("points")
      .eq("organization_id", organizationId)
      .eq("profile_id", toProfileId)
      .eq("source_date", todayKey)
      .eq("rule_key", "cheer_received"),
  ]);

  const dayEarned = (dayPointRowsRes.data ?? []).reduce((sum, row) => {
    const point = Number(row.points ?? 0);
    return point > 0 ? sum + point : sum;
  }, 0);
  const ruleDayEarned = (ruleDayRowsRes.data ?? []).reduce((sum, row) => {
    const point = Number(row.points ?? 0);
    return point > 0 ? sum + point : sum;
  }, 0);

  let awardedPoints = ruleEnabled ? configuredPoint : 0;
  if (awardedPoints > 0) {
    awardedPoints = Math.min(awardedPoints, Math.max(0, dayPointCap - dayEarned));
    if (ruleDailyCap !== null) {
      awardedPoints = Math.min(awardedPoints, Math.max(0, ruleDailyCap - ruleDayEarned));
    }
  }

  const { error: ledgerError } = await admin.from("book_point_ledger").insert({
    organization_id: organizationId,
    profile_id: toProfileId,
    source_type: cheerRuleMeta.sourceType,
    source_id: cheerRow?.id ?? null,
    rule_key: "cheer_received",
    points: awardedPoints,
    source_date: todayKey,
    metadata: {
      cheer_id: cheerRow?.id ?? null,
      from_profile_id: user.id,
      target_type: targetType,
      target_id: targetId,
    },
    note: cheerRuleMeta.label,
  });

  if (ledgerError) {
    return NextResponse.json(
      { ok: false, message: `응원 점수 적립 실패: ${ledgerError.message}` },
      { status: 400 }
    );
  }

  const [senderProgressRes, receiverProgressRes] = await Promise.all([
    admin
      .from("book_user_progress")
      .select("monthly_points,lifetime_points,monthly_books_completed,cheers_received,cheers_sent,last_activity_date,current_streak_days,longest_streak_days,total_books_completed,total_notes_written,total_quizzes_completed")
      .eq("organization_id", organizationId)
      .eq("profile_id", user.id)
      .maybeSingle(),
    admin
      .from("book_user_progress")
      .select("monthly_points,lifetime_points,monthly_books_completed,cheers_received,cheers_sent,last_activity_date,current_streak_days,longest_streak_days,total_books_completed,total_notes_written,total_quizzes_completed")
      .eq("organization_id", organizationId)
      .eq("profile_id", toProfileId)
      .maybeSingle(),
  ]);

  const senderProgress = senderProgressRes.data;
  const receiverProgress = receiverProgressRes.data;
  const senderMonthKey = senderProgress?.last_activity_date
    ? toUtcMonthKey(senderProgress.last_activity_date)
    : null;
  const receiverMonthKey = receiverProgress?.last_activity_date
    ? toUtcMonthKey(receiverProgress.last_activity_date)
    : null;

  const senderMonthlyPointsBase = senderMonthKey === toUtcMonthKey(todayKey)
    ? Number(senderProgress?.monthly_points ?? 0)
    : 0;
  const receiverMonthlyPointsBase = receiverMonthKey === toUtcMonthKey(todayKey)
    ? Number(receiverProgress?.monthly_points ?? 0)
    : 0;

  const senderLifetime = Number(senderProgress?.lifetime_points ?? 0);
  const receiverLifetime = Number(receiverProgress?.lifetime_points ?? 0) + awardedPoints;

  const [senderUpsertRes, receiverUpsertRes] = await Promise.all([
    admin.from("book_user_progress").upsert(
      {
        organization_id: organizationId,
        profile_id: user.id,
        current_streak_days: Number(senderProgress?.current_streak_days ?? 0),
        longest_streak_days: Number(senderProgress?.longest_streak_days ?? 0),
        last_activity_date: senderProgress?.last_activity_date ?? todayKey,
        total_books_completed: Number(senderProgress?.total_books_completed ?? 0),
        total_notes_written: Number(senderProgress?.total_notes_written ?? 0),
        total_quizzes_completed: Number(senderProgress?.total_quizzes_completed ?? 0),
        monthly_books_completed: Number(senderProgress?.monthly_books_completed ?? 0),
        monthly_points: senderMonthlyPointsBase,
        lifetime_points: senderLifetime,
        cheers_received: Number(senderProgress?.cheers_received ?? 0),
        cheers_sent: Number(senderProgress?.cheers_sent ?? 0) + 1,
        rank_tier: computeRankTier(senderLifetime),
      },
      { onConflict: "organization_id,profile_id" }
    ),
    admin.from("book_user_progress").upsert(
      {
        organization_id: organizationId,
        profile_id: toProfileId,
        current_streak_days: Number(receiverProgress?.current_streak_days ?? 0),
        longest_streak_days: Number(receiverProgress?.longest_streak_days ?? 0),
        last_activity_date: receiverProgress?.last_activity_date ?? todayKey,
        total_books_completed: Number(receiverProgress?.total_books_completed ?? 0),
        total_notes_written: Number(receiverProgress?.total_notes_written ?? 0),
        total_quizzes_completed: Number(receiverProgress?.total_quizzes_completed ?? 0),
        monthly_books_completed: Number(receiverProgress?.monthly_books_completed ?? 0),
        monthly_points: receiverMonthlyPointsBase + awardedPoints,
        lifetime_points: receiverLifetime,
        cheers_received: Number(receiverProgress?.cheers_received ?? 0) + 1,
        cheers_sent: Number(receiverProgress?.cheers_sent ?? 0),
        rank_tier: computeRankTier(receiverLifetime),
      },
      { onConflict: "organization_id,profile_id" }
    ),
  ]);

  if (senderUpsertRes.error || receiverUpsertRes.error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          senderUpsertRes.error?.message ??
          receiverUpsertRes.error?.message ??
          "응원 진행도 갱신에 실패했습니다.",
      },
      { status: 400 }
    );
  }

  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: user.id,
    action: "book_cheer_sent",
    target_type: "book_cheer",
    target_id: cheerRow?.id ?? null,
    metadata: {
      to_profile_id: toProfileId,
      target_type: targetType,
      target_id: targetId,
      cheer_points_awarded: awardedPoints,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      cheerId: cheerRow?.id ?? null,
      createdAt: cheerRow?.created_at ?? null,
      awardedPoints,
    },
  });
}
