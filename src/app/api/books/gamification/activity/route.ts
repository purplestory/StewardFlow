import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isBookRuleKey } from "@/lib/book-gamification";
import { awardBookPoints } from "@/lib/book-gamification-award";

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
  const sourceId = isUuid(body?.sourceId) ? body.sourceId : null;

  let awardResult;
  try {
    awardResult = await awardBookPoints({
      admin,
      organizationId,
      profileId: user.id,
      ruleKey: ruleKeyInput,
      sourceId,
      sourceDate,
      metadata: body?.metadata ?? {},
      actorId: user.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "점수 적립 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }

  if (!awardResult.applied && awardResult.reason === "gamification_disabled") {
    return NextResponse.json(
      { ok: false, message: "이 기관은 독서 게임화 기능이 비활성화되어 있습니다." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    result: {
      ruleKey: ruleKeyInput,
      awardedPoints: awardResult.awardedPoints,
      configuredPoint: awardResult.configuredPoint,
      cappedByDailyPointCap: awardResult.cappedByDailyPointCap,
      cappedByRuleDailyCap: awardResult.cappedByRuleDailyCap,
      progress: awardResult.progress,
    },
  });
}
