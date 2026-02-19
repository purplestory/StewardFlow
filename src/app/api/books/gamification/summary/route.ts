import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { toIsoWeekKey, toUtcDateKey, toUtcMonthKey } from "@/lib/book-gamification";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type PeriodType = "weekly" | "monthly" | "quarterly" | "yearly";

function extractAccessToken(request: Request, url: URL): string | null {
  const fromQuery = url.searchParams.get("accessToken")?.trim();
  if (fromQuery) return fromQuery;

  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function parsePeriodType(raw: string | null): PeriodType {
  if (raw === "weekly" || raw === "monthly" || raw === "quarterly" || raw === "yearly") {
    return raw;
  }
  return "monthly";
}

function toQuarterKey(date: Date): string {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}

function toPeriodKey(periodType: PeriodType, date: Date): string {
  if (periodType === "weekly") return toIsoWeekKey(date);
  if (periodType === "monthly") return toUtcMonthKey(toUtcDateKey(date));
  if (periodType === "quarterly") return toQuarterKey(date);
  return `${date.getUTCFullYear()}`;
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

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경 변수가 없습니다." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const accessToken = extractAccessToken(request, url);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "accessToken 또는 Authorization 헤더가 필요합니다." },
      { status: 400 }
    );
  }

  const periodType = parsePeriodType(url.searchParams.get("period"));
  const now = new Date();
  const periodKey = toPeriodKey(periodType, now);
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

  const [settingsRes, progressRes, leaderboardSnapshotRes, leaderboardLiveRes, cheersRes] =
    await Promise.all([
      admin
        .from("book_program_settings")
        .select(
          "gamification_enabled,leaderboard_enabled,cheer_enabled,streak_enabled,rewards_enabled,reward_mode,daily_point_cap,monthly_reset_day"
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin
        .from("book_user_progress")
        .select(
          "profile_id,current_streak_days,longest_streak_days,last_activity_date,total_books_completed,total_notes_written,total_quizzes_completed,monthly_books_completed,monthly_points,lifetime_points,cheers_received,cheers_sent,rank_tier"
        )
        .eq("organization_id", organizationId)
        .eq("profile_id", user.id)
        .maybeSingle(),
      admin
        .from("book_leaderboard_snapshots")
        .select("profile_id,rank_no,total_points,books_completed,streak_days,cheers_received")
        .eq("organization_id", organizationId)
        .eq("period_type", periodType)
        .eq("period_key", periodKey)
        .order("rank_no", { ascending: true })
        .limit(20),
      admin
        .from("book_user_progress")
        .select(
          "profile_id,monthly_points,monthly_books_completed,current_streak_days,cheers_received,rank_tier"
        )
        .eq("organization_id", organizationId)
        .order("monthly_points", { ascending: false })
        .order("current_streak_days", { ascending: false })
        .limit(20),
      admin
        .from("book_cheers")
        .select("id,from_profile_id,to_profile_id,target_type,target_id,message,created_at")
        .eq("organization_id", organizationId)
        .eq("to_profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const settings = settingsRes.data ?? null;
  if (settings?.gamification_enabled === false) {
    return NextResponse.json(
      {
        ok: true,
        summary: {
          periodType,
          periodKey,
          gamificationEnabled: false,
          settings,
          myProgress: progressRes.data ?? null,
          leaderboard: [],
          myRank: null,
          recentCheers: [],
        },
      },
      { status: 200 }
    );
  }

  const leaderboard =
    (leaderboardSnapshotRes.data ?? []).length > 0
      ? (leaderboardSnapshotRes.data ?? []).map((item) => ({
          profileId: item.profile_id,
          rankNo: item.rank_no,
          totalPoints: item.total_points,
          booksCompleted: item.books_completed,
          streakDays: item.streak_days,
          cheersReceived: item.cheers_received,
          source: "snapshot" as const,
        }))
      : (leaderboardLiveRes.data ?? []).map((item, index) => ({
          profileId: item.profile_id,
          rankNo: index + 1,
          totalPoints: item.monthly_points ?? 0,
          booksCompleted: item.monthly_books_completed ?? 0,
          streakDays: item.current_streak_days ?? 0,
          cheersReceived: item.cheers_received ?? 0,
          rankTier: item.rank_tier ?? "seed",
          source: "live" as const,
        }));

  const myRank = leaderboard.find((entry) => entry.profileId === user.id)?.rankNo ?? null;

  return NextResponse.json({
    ok: true,
    summary: {
      periodType,
      periodKey,
      gamificationEnabled: true,
      settings,
      myProgress: progressRes.data ?? null,
      leaderboard,
      myRank,
      recentCheers: cheersRes.data ?? [],
    },
  });
}
