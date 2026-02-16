import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { dispatchNotificationChannels } from "@/lib/notification-channels";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type DispatchTarget = {
  userId: string;
  type: string;
  payload?: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, message: "Supabase 환경 변수가 없습니다." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        accessToken?: string;
        notifications?: DispatchTarget[];
      }
    | null;

  const accessToken = body?.accessToken;
  const notifications = body?.notifications ?? [];

  if (!accessToken || !Array.isArray(notifications) || notifications.length === 0) {
    return NextResponse.json({ ok: false, message: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user;
  if (!actor) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data: actorProfile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .maybeSingle();

  if (!actorProfile?.organization_id) {
    return NextResponse.json({ ok: false, message: "소속 기관을 확인할 수 없습니다." }, { status: 403 });
  }

  const targetIds = Array.from(
    new Set(
      notifications
        .map((item) => item.userId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const { data: targetProfiles } = await admin
    .from("profiles")
    .select("id,organization_id")
    .in("id", targetIds);

  const allowedTargetIds = new Set(
    (targetProfiles ?? [])
      .filter((row) => row.organization_id === actorProfile.organization_id)
      .map((row) => row.id)
  );

  const dispatched: Array<{ userId: string; type: string; ok: boolean }> = [];
  for (const item of notifications) {
    if (!allowedTargetIds.has(item.userId)) {
      dispatched.push({ userId: item.userId, type: item.type, ok: false });
      continue;
    }

    try {
      await dispatchNotificationChannels({
        userId: item.userId,
        type: item.type,
        payload: item.payload ?? {},
      });
      dispatched.push({ userId: item.userId, type: item.type, ok: true });
    } catch {
      dispatched.push({ userId: item.userId, type: item.type, ok: false });
    }
  }

  return NextResponse.json({ ok: true, dispatched });
}

