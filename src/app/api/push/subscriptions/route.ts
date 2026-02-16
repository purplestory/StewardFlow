import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type SubscriptionBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
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
    return NextResponse.json({ ok: false, message: "Supabase 환경 변수가 없습니다." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | { accessToken?: string; subscription?: SubscriptionBody }
    | null;
  const accessToken = body?.accessToken;
  const subscription = body?.subscription;

  if (!accessToken || !subscription?.endpoint) {
    return NextResponse.json({ ok: false, message: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      organization_id: profile?.organization_id ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh ?? null,
      auth: subscription.keys?.auth ?? null,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { accessToken?: string; endpoint?: string }
    | null;
  const accessToken = body?.accessToken;
  const endpoint = body?.endpoint;

  if (!accessToken || !endpoint) {
    return NextResponse.json({ ok: false, message: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

