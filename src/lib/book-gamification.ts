export type BookRuleKey =
  | "book_complete"
  | "on_time_return"
  | "note_write"
  | "quiz_complete"
  | "streak_bonus"
  | "cheer_received"
  | "overdue_penalty";

export type BookPointSourceType =
  | "completion"
  | "return"
  | "note"
  | "quiz"
  | "streak"
  | "cheer"
  | "penalty"
  | "bonus";

type RuleMeta = {
  label: string;
  sourceType: BookPointSourceType;
  defaultPointValue: number;
};

const RULE_META: Record<BookRuleKey, RuleMeta> = {
  book_complete: {
    label: "완독/반납 완료",
    sourceType: "completion",
    defaultPointValue: 10,
  },
  on_time_return: {
    label: "정시 반납 보너스",
    sourceType: "return",
    defaultPointValue: 5,
  },
  note_write: {
    label: "독서 메모 작성",
    sourceType: "note",
    defaultPointValue: 8,
  },
  quiz_complete: {
    label: "퀴즈 완료",
    sourceType: "quiz",
    defaultPointValue: 7,
  },
  streak_bonus: {
    label: "연속 독서 보너스",
    sourceType: "streak",
    defaultPointValue: 10,
  },
  cheer_received: {
    label: "응원 받음",
    sourceType: "cheer",
    defaultPointValue: 2,
  },
  overdue_penalty: {
    label: "연체 패널티",
    sourceType: "penalty",
    defaultPointValue: -8,
  },
};

export function isBookRuleKey(value: string): value is BookRuleKey {
  return value in RULE_META;
}

export function getRuleMeta(ruleKey: BookRuleKey): RuleMeta {
  return RULE_META[ruleKey];
}

export function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toUtcMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function diffUtcDays(fromDateKey: string, toDateKey: string): number {
  const fromMs = parseDateKey(fromDateKey).getTime();
  const toMs = parseDateKey(toDateKey).getTime();
  return Math.floor((toMs - fromMs) / 86_400_000);
}

export function computeStreak(input: {
  lastActivityDate: string | null;
  currentStreakDays: number;
  longestStreakDays: number;
  nextActivityDate: string;
}) {
  const {
    lastActivityDate,
    currentStreakDays,
    longestStreakDays,
    nextActivityDate,
  } = input;

  if (!lastActivityDate) {
    return {
      currentStreakDays: 1,
      longestStreakDays: Math.max(1, longestStreakDays),
      isNewActivityDay: true,
    };
  }

  const dayDiff = diffUtcDays(lastActivityDate, nextActivityDate);
  if (dayDiff <= 0) {
    return {
      currentStreakDays,
      longestStreakDays,
      isNewActivityDay: false,
    };
  }

  if (dayDiff === 1) {
    const nextStreak = currentStreakDays + 1;
    return {
      currentStreakDays: nextStreak,
      longestStreakDays: Math.max(nextStreak, longestStreakDays),
      isNewActivityDay: true,
    };
  }

  return {
    currentStreakDays: 1,
    longestStreakDays: Math.max(1, longestStreakDays),
    isNewActivityDay: true,
  };
}

export function computeRankTier(lifetimePoints: number): "seed" | "bronze" | "silver" | "gold" | "diamond" {
  if (lifetimePoints >= 1200) return "diamond";
  if (lifetimePoints >= 700) return "gold";
  if (lifetimePoints >= 300) return "silver";
  if (lifetimePoints >= 80) return "bronze";
  return "seed";
}

export function toIsoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  const week = String(weekNo).padStart(2, "0");
  return `${utc.getUTCFullYear()}-W${week}`;
}
