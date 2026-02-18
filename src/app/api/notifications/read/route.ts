import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReadRequestBody = {
  accessToken?: string;
  notificationId?: string;
  markAll?: boolean;
};

const getAuthedClient = async (accessToken: string) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { client: null, userId: null, error: "Supabase 환경 변수가 없습니다." };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return { client: null, userId: null, error: "로그인이 필요합니다." };
  }

  return { client, userId: userData.user.id as string, error: null };
};

const getWriteClient = () => {
  if (!supabaseUrl) return null;
  if (supabaseServiceRoleKey) {
    return createClient(supabaseUrl, supabaseServiceRoleKey);
  }
  if (supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
};

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as ReadRequestBody | null;
  const accessToken = body?.accessToken?.trim();
  const notificationId = body?.notificationId?.trim();
  const markAll = body?.markAll === true;

  if (!accessToken || (!notificationId && !markAll)) {
    return NextResponse.json(
      { ok: false, message: "요청 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const authResult = await getAuthedClient(accessToken);
  if (!authResult.client || !authResult.userId) {
    return NextResponse.json(
      { ok: false, message: authResult.error ?? "인증에 실패했습니다." },
      { status: 401 }
    );
  }

  const writeClient = getWriteClient();
  if (!writeClient) {
    return NextResponse.json(
      { ok: false, message: "알림 업데이트 클라이언트를 생성할 수 없습니다." },
      { status: 500 }
    );
  }

  const readAt = new Date().toISOString();

  if (markAll) {
    const { data: updatedRows, error: updateError } = await writeClient
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", authResult.userId)
      .is("read_at", null)
      .select("id");

    if (updateError) {
      return NextResponse.json(
        { ok: false, message: updateError.message },
        { status: 400 }
      );
    }

    const { count: unreadCount, error: unreadError } = await writeClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authResult.userId)
      .is("read_at", null);

    if (unreadError) {
      return NextResponse.json(
        { ok: false, message: unreadError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      updatedCount: updatedRows?.length ?? 0,
      unreadCount: unreadCount ?? 0,
      readAt,
    });
  }

  const { data: updatedRows, error: updateError } = await writeClient
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", notificationId)
    .eq("user_id", authResult.userId)
    .is("read_at", null)
    .select("id");

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: updateError.message },
      { status: 400 }
    );
  }

  const { count: unreadCount, error: unreadError } = await writeClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authResult.userId)
    .is("read_at", null);

  if (unreadError) {
    return NextResponse.json(
      { ok: false, message: unreadError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    updatedCount: updatedRows?.length ?? 0,
    unreadCount: unreadCount ?? 0,
    readAt,
  });
}
