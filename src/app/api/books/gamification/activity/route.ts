import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  computeRankTier,
  computeStreak,
  getRuleMeta,
  isBookRuleKey,
  toUtcDateKey,
  toUtcMonthKey,
} from "@/lib/book-gamification";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type ActivityBody = {
  accessToken?: string;
  ruleKey?: string;
  sourceId?: string;
  sourceDate?: string;
  metadata?: Record<string, unknown>;
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

  const body = (await request.json().catch(() => null)) as ActivityBody | null;
  const accessToken = body?.accessToken?.trim();
  const ruleKeyInput = body?.ruleKey?.trim();

  if (!accessToken || !ruleKeyInput) {
    return NextResponse.json(
      { ok: false, message: "accessToken, ruleKey가 필요합니다." },
      { status: 400 }
    );
  }

  if (!isBookRuleKey(ruleKeyInput)) {
    return NextResponse.json(
      { ok: false, message: "지원하지 않는 ruleKey입니다." },
      { status: 400 }
    );
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { ok: false, message: "소속 기관 정보를 찾을 수 없습니다." },
      { status: 400 }
    );
  }

  const organizationId = profile.organization_id;
  const now = new Date();
  const sourceDateRaw = body?.sourceDate ? new Date(body.sourceDate) : now;
  const sourceDate = Number.isNaN(sourceDateRaw.getTime()) ? now : sourceDateRaw;
  const sourceDateKey = toUtcDateKey(sourceDate);

  const { data: settings } = await admin
    .from("book_program_settings")
    .select("gamification_enabled,daily_point_cap")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (settings && settings.gamification_enabled === false) {
    return NextResponse.json(
      { ok: false, message: "이 기관은 독서 게임화 기능이 비활성화되어 있습니다." },
      { status: 403 }
    );
  }

  const { data: scoringRule } = await admin
    .from("book_scoring_rules")
    .select("enabled,point_value,daily_limit")
    .eq("organization_id", organizationId)
    .eq("rule_key", ruleKeyInput)
    .maybeSingle();

  const ruleMeta = getRuleMeta(ruleKeyInput);
  const ruleEnabled = scoringRule?.enabled ?? true;
  const configuredPoint = scoringRule?.point_value ?? ruleMeta.defaultPointValue;
  const dayPointCap = settings?.daily_point_cap ?? 120;
  const ruleDailyCap = scoringRule?.daily_limit ?? null;

  const [dayPointRowsRes, ruleDayRowsRes] = await Promise.all([
    admin
      .from("book_point_ledger")
      .select("points")
      .eq("organization_id", organizationId)
      .eq("profile_id", user.id)
      .eq("source_date", sourceDateKey),
    admin
      .from("book_point_ledger")
      .select("points")
      .eq("organization_id", organizationId)
      .eq("profile_id", user.id)
      .eq("source_date", sourceDateKey)
      .eq("rule_key", ruleKeyInput),
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
  let cappedByDailyPointCap = false;
  let cappedByRuleDailyCap = false;

  if (awardedPoints > 0) {
    const remainingDailyCap = Math.max(0, dayPointCap - dayEarned);
    if (awardedPoints > remainingDailyCap) {
      awardedPoints = remainingDailyCap;
      cappedByDailyPointCap = true;
    }

    if (ruleDailyCap !== null) {
      const remainingRuleCap = Math.max(0, ruleDailyCap - ruleDayEarned);
      if (awardedPoints > remainingRuleCap) {
        awardedPoints = remainingRuleCap;
        cappedByRuleDailyCap = true;
      }
    }
  }

  const sourceId = isUuid(body?.sourceId) ? body?.sourceId : null;
  const ledgerMetadata = {
    ...(body?.metadata ?? {}),
    configuredPoint,
    cappedByDailyPointCap,
    cappedByRuleDailyCap,
    sourceDateKey,
  };

  const { error: ledgerError } = await admin.from("book_point_ledger").insert({
    organization_id: organizationId,
    profile_id: user.id,
    source_type: ruleMeta.sourceType,
    source_id: sourceId,
    rule_key: ruleKeyInput,
    points: awardedPoints,
    source_date: sourceDateKey,
    metadata: ledgerMetadata,
    note: ruleMeta.label,
  });

  if (ledgerError) {
    return NextResponse.json(
      { ok: false, message: `점수 적립에 실패했습니다: ${ledgerError.message}` },
      { status: 400 }
    );
  }

  const { data: existingProgress } = await admin
    .from("book_user_progress")
    .select(
      "id,current_streak_days,longest_streak_days,last_activity_date,total_books_completed,total_notes_written,total_quizzes_completed,monthly_books_completed,monthly_points,lifetime_points,cheers_received,cheers_sent"
    )
    .eq("organization_id", organizationId)
    .eq("profile_id", user.id)
    .maybeSingle();

  const currentStreak = Number(existingProgress?.current_streak_days ?? 0);
  const longestStreak = Number(existingProgress?.longest_streak_days ?? 0);
  const streakState = computeStreak({
    lastActivityDate: existingProgress?.last_activity_date ?? null,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    nextActivityDate: sourceDateKey,
  });

  const previousMonthKey = existingProgress?.last_activity_date
    ? toUtcMonthKey(existingProgress.last_activity_date)
    : null;
  const currentMonthKey = toUtcMonthKey(sourceDateKey);
  const isSameMonth = previousMonthKey === currentMonthKey;

  const booksDelta = ruleKeyInput === "book_complete" ? 1 : 0;
  const notesDelta = ruleKeyInput === "note_write" ? 1 : 0;
  const quizzesDelta = ruleKeyInput === "quiz_complete" ? 1 : 0;
  const cheersReceivedDelta = ruleKeyInput === "cheer_received" ? 1 : 0;

  const baseMonthlyBooks = isSameMonth ? Number(existingProgress?.monthly_books_completed ?? 0) : 0;
  const baseMonthlyPoints = isSameMonth ? Number(existingProgress?.monthly_points ?? 0) : 0;
  const nextLifetimePoints = Number(existingProgress?.lifetime_points ?? 0) + awardedPoints;
  const nextRankTier = computeRankTier(nextLifetimePoints);

  const { data: savedProgress, error: progressError } = await admin
    .from("book_user_progress")
    .upsert(
      {
        organization_id: organizationId,
        profile_id: user.id,
        current_streak_days: streakState.currentStreakDays,
        longest_streak_days: streakState.longestStreakDays,
        last_activity_date:
          streakState.isNewActivityDay || !existingProgress?.last_activity_date
            ? sourceDateKey
            : existingProgress.last_activity_date,
        total_books_completed: Number(existingProgress?.total_books_completed ?? 0) + booksDelta,
        total_notes_written: Number(existingProgress?.total_notes_written ?? 0) + notesDelta,
        total_quizzes_completed: Number(existingProgress?.total_quizzes_completed ?? 0) + quizzesDelta,
        monthly_books_completed: baseMonthlyBooks + booksDelta,
        monthly_points: baseMonthlyPoints + awardedPoints,
        lifetime_points: nextLifetimePoints,
        cheers_received: Number(existingProgress?.cheers_received ?? 0) + cheersReceivedDelta,
        cheers_sent: Number(existingProgress?.cheers_sent ?? 0),
        rank_tier: nextRankTier,
      },
      { onConflict: "organization_id,profile_id" }
    )
    .select(
      "current_streak_days,longest_streak_days,last_activity_date,total_books_completed,total_notes_written,total_quizzes_completed,monthly_books_completed,monthly_points,lifetime_points,rank_tier"
    )
    .maybeSingle();

  if (progressError) {
    return NextResponse.json(
      { ok: false, message: `진행도 갱신에 실패했습니다: ${progressError.message}` },
      { status: 400 }
    );
  }

  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: user.id,
    action: "book_gamification_activity_recorded",
    target_type: "book_user_progress",
    target_id: user.id,
    metadata: {
      rule_key: ruleKeyInput,
      awarded_points: awardedPoints,
      configured_point: configuredPoint,
      source_date: sourceDateKey,
      capped_by_daily_point_cap: cappedByDailyPointCap,
      capped_by_rule_daily_cap: cappedByRuleDailyCap,
      source_id: sourceId,
    },
  });

  return NextResponse.json({
    ok: true,
    result: {
      ruleKey: ruleKeyInput,
      awardedPoints,
      configuredPoint,
      cappedByDailyPointCap,
      cappedByRuleDailyCap,
      progress: savedProgress,
    },
  });
}
