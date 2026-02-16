import { supabase } from "@/lib/supabase";

type DispatchTarget = {
  userId: string;
  type: string;
  payload?: Record<string, unknown> | null;
};

export async function dispatchNotificationChannelsClient(
  notifications: DispatchTarget[]
): Promise<void> {
  if (!notifications.length) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return;

  try {
    await fetch("/api/notifications/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        notifications,
      }),
    });
  } catch {
    // 채널 발송 실패는 사용자 동작을 막지 않음
  }
}

