import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type BookRuleKey,
  computeRankTier,
  computeStreak,
  getRuleMeta,
  toUtcDateKey,
  toUtcMonthKey,
} from "@/lib/book-gamification";

type ProgressRow = {
  current_streak_days: number | null;
  longest_streak_days: number | null;
  last_activity_date: string | null;
  total_books_completed: number | null;
  total_notes_written: number | null;
  total_quizzes_completed: number | null;
  monthly_books_completed: number | null;
  monthly_points: number | null;
  lifetime_points: number | null;
  cheers_received: number | null;
  cheers_sent: number | null;
};

type ScoringRuleRow = {
  enabled: boolean | null;
  point_value: number | null;
  daily_limit: number | null;
};

export type AwardBookPointsInput = {
  admin: SupabaseClient;
  organizationId: string;
  profileId: string;
  ruleKey: BookRuleKey;
  sourceId?: string | null;
  sourceDate?: Date;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
};

export type AwardBookPointsResult = {
  applied: boolean;
  reason?: "gamification_disabled";
  ruleKey: BookRuleKey;
  configuredPoint: number;
  awardedPoints: number;
  cappedByDailyPointCap: boolean;
  cappedByRuleDailyCap: boolean;
  sourceDateKey: string;
  progress: {
    current_streak_days: number;
    longest_streak_days: number;
    last_activity_date: string;
    total_books_completed: number;
    total_notes_written: number;
    total_quizzes_completed: number;
    monthly_books_completed: number;
    monthly_points: number;
    lifetime_points: number;
    cheers_received: number;
    cheers_sent: number;
    rank_tier: "seed" | "bronze" | "silver" | "gold" | "diamond";
  } | null;
};

const toNumber = (value: number | null | undefined) => Number(value ?? 0);

const isSameMonth = (leftDateKey: string | null | undefined, rightDateKey: string): boolean => {
  if (!leftDateKey) return false;
  return toUtcMonthKey(leftDateKey) === toUtcMonthKey(rightDateKey);
};

const deltaForRule = (ruleKey: BookRuleKey) => ({
  books: ruleKey === "book_complete" ? 1 : 0,
  notes: ruleKey === "note_write" ? 1 : 0,
  quizzes: ruleKey === "quiz_complete" ? 1 : 0,
  cheersReceived: ruleKey === "cheer_received" ? 1 : 0,
});

export async function awardBookPoints(input: AwardBookPointsInput): Promise<AwardBookPointsResult> {
  const {
    admin,
    organizationId,
    profileId,
    ruleKey,
    sourceId = null,
    sourceDate = new Date(),
    metadata = {},
    actorId = profileId,
  } = input;

  const sourceDateKey = toUtcDateKey(sourceDate);
  const ruleMeta = getRuleMeta(ruleKey);

  const { data: settings, error: settingsError } = await admin
    .from("book_program_settings")
    .select("gamification_enabled,daily_point_cap")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (settingsError) {
    throw new Error(`게임화 설정 조회 실패: ${settingsError.message}`);
  }

  if (settings?.gamification_enabled === false) {
    return {
      applied: false,
      reason: "gamification_disabled",
      ruleKey,
      configuredPoint: 0,
      awardedPoints: 0,
      cappedByDailyPointCap: false,
      cappedByRuleDailyCap: false,
      sourceDateKey,
      progress: null,
    };
  }

  const { data: scoringRule, error: scoringRuleError } = await admin
    .from("book_scoring_rules")
    .select("enabled,point_value,daily_limit")
    .eq("organization_id", organizationId)
    .eq("rule_key", ruleKey)
    .maybeSingle<ScoringRuleRow>();

  if (scoringRuleError) {
    throw new Error(`점수 규칙 조회 실패: ${scoringRuleError.message}`);
  }

  const configuredPoint = scoringRule?.point_value ?? ruleMeta.defaultPointValue;
  const ruleEnabled = scoringRule?.enabled ?? true;
  const dayPointCap = settings?.daily_point_cap ?? 120;
  const ruleDailyCap = scoringRule?.daily_limit ?? null;

  const [dayPointRowsRes, ruleDayRowsRes] = await Promise.all([
    admin
      .from("book_point_ledger")
      .select("points")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("source_date", sourceDateKey),
    admin
      .from("book_point_ledger")
      .select("points")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .eq("source_date", sourceDateKey)
      .eq("rule_key", ruleKey),
  ]);

  if (dayPointRowsRes.error) {
    throw new Error(`일일 점수 조회 실패: ${dayPointRowsRes.error.message}`);
  }
  if (ruleDayRowsRes.error) {
    throw new Error(`일일 규칙 점수 조회 실패: ${ruleDayRowsRes.error.message}`);
  }

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

  const { error: ledgerError } = await admin.from("book_point_ledger").insert({
    organization_id: organizationId,
    profile_id: profileId,
    source_type: ruleMeta.sourceType,
    source_id: sourceId,
    rule_key: ruleKey,
    points: awardedPoints,
    source_date: sourceDateKey,
    metadata: {
      ...metadata,
      configuredPoint,
      cappedByDailyPointCap,
      cappedByRuleDailyCap,
      sourceDateKey,
    },
    note: ruleMeta.label,
  });

  if (ledgerError) {
    throw new Error(`점수 적립 실패: ${ledgerError.message}`);
  }

  const { data: existingProgress, error: progressSelectError } = await admin
    .from("book_user_progress")
    .select(
      "current_streak_days,longest_streak_days,last_activity_date,total_books_completed,total_notes_written,total_quizzes_completed,monthly_books_completed,monthly_points,lifetime_points,cheers_received,cheers_sent"
    )
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle<ProgressRow>();

  if (progressSelectError) {
    throw new Error(`독서 진행도 조회 실패: ${progressSelectError.message}`);
  }

  const streakState = computeStreak({
    lastActivityDate: existingProgress?.last_activity_date ?? null,
    currentStreakDays: toNumber(existingProgress?.current_streak_days),
    longestStreakDays: toNumber(existingProgress?.longest_streak_days),
    nextActivityDate: sourceDateKey,
  });

  const deltas = deltaForRule(ruleKey);
  const monthlyBooksBase = isSameMonth(existingProgress?.last_activity_date, sourceDateKey)
    ? toNumber(existingProgress?.monthly_books_completed)
    : 0;
  const monthlyPointsBase = isSameMonth(existingProgress?.last_activity_date, sourceDateKey)
    ? toNumber(existingProgress?.monthly_points)
    : 0;

  const lifetimePoints = toNumber(existingProgress?.lifetime_points) + awardedPoints;
  const rankTier = computeRankTier(lifetimePoints);

  const upsertPayload = {
    organization_id: organizationId,
    profile_id: profileId,
    current_streak_days: streakState.currentStreakDays,
    longest_streak_days: streakState.longestStreakDays,
    last_activity_date:
      streakState.isNewActivityDay || !existingProgress?.last_activity_date
        ? sourceDateKey
        : existingProgress.last_activity_date,
    total_books_completed: toNumber(existingProgress?.total_books_completed) + deltas.books,
    total_notes_written: toNumber(existingProgress?.total_notes_written) + deltas.notes,
    total_quizzes_completed: toNumber(existingProgress?.total_quizzes_completed) + deltas.quizzes,
    monthly_books_completed: monthlyBooksBase + deltas.books,
    monthly_points: monthlyPointsBase + awardedPoints,
    lifetime_points: lifetimePoints,
    cheers_received: toNumber(existingProgress?.cheers_received) + deltas.cheersReceived,
    cheers_sent: toNumber(existingProgress?.cheers_sent),
    rank_tier: rankTier,
  };

  const { data: savedProgress, error: progressUpsertError } = await admin
    .from("book_user_progress")
    .upsert(upsertPayload, { onConflict: "organization_id,profile_id" })
    .select(
      "current_streak_days,longest_streak_days,last_activity_date,total_books_completed,total_notes_written,total_quizzes_completed,monthly_books_completed,monthly_points,lifetime_points,cheers_received,cheers_sent,rank_tier"
    )
    .maybeSingle();

  if (progressUpsertError) {
    throw new Error(`독서 진행도 저장 실패: ${progressUpsertError.message}`);
  }

  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action: "book_gamification_activity_recorded",
    target_type: "book_user_progress",
    target_id: profileId,
    metadata: {
      rule_key: ruleKey,
      awarded_points: awardedPoints,
      configured_point: configuredPoint,
      source_date: sourceDateKey,
      source_id: sourceId,
      capped_by_daily_point_cap: cappedByDailyPointCap,
      capped_by_rule_daily_cap: cappedByRuleDailyCap,
    },
  });

  return {
    applied: true,
    ruleKey,
    configuredPoint,
    awardedPoints,
    cappedByDailyPointCap,
    cappedByRuleDailyCap,
    sourceDateKey,
    progress: {
      current_streak_days: toNumber(savedProgress?.current_streak_days),
      longest_streak_days: toNumber(savedProgress?.longest_streak_days),
      last_activity_date: savedProgress?.last_activity_date ?? sourceDateKey,
      total_books_completed: toNumber(savedProgress?.total_books_completed),
      total_notes_written: toNumber(savedProgress?.total_notes_written),
      total_quizzes_completed: toNumber(savedProgress?.total_quizzes_completed),
      monthly_books_completed: toNumber(savedProgress?.monthly_books_completed),
      monthly_points: toNumber(savedProgress?.monthly_points),
      lifetime_points: toNumber(savedProgress?.lifetime_points),
      cheers_received: toNumber(savedProgress?.cheers_received),
      cheers_sent: toNumber(savedProgress?.cheers_sent),
      rank_tier:
        (savedProgress?.rank_tier as
          | "seed"
          | "bronze"
          | "silver"
          | "gold"
          | "diamond"
          | null) ?? rankTier,
    },
  };
}
