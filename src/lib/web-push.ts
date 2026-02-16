import { createSign } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type PushSendResult = {
  ok: boolean;
  attempted: number;
  sent: number;
  failed: number;
};

type SendWebPushToUserParams = {
  userId: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
};

const DEFAULT_SUBJECT = "mailto:admin@example.com";

function base64UrlEncode(input: Buffer | string): string {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return source
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createVapidJwt(endpoint: string): { jwt: string; publicKey: string } | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKeyPemRaw = process.env.WEB_PUSH_VAPID_PRIVATE_KEY_PEM;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || DEFAULT_SUBJECT;

  if (!publicKey || !privateKeyPemRaw) {
    return null;
  }

  const privateKeyPem = privateKeyPemRaw.replace(/\\n/g, "\n");
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;

  const header = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64UrlEncode(JSON.stringify({ aud, exp, sub: subject }));
  const unsignedToken = `${header}.${payload}`;

  const signer = createSign("SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign({
    key: privateKeyPem,
    dsaEncoding: "ieee-p1363",
  });
  const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

  return { jwt, publicKey };
}

async function sendPushPing(endpoint: string): Promise<{ ok: boolean; status?: number }> {
  const vapid = createVapidJwt(endpoint);
  if (!vapid) {
    return { ok: false };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: "60",
        Urgency: "normal",
        Authorization: `WebPush ${vapid.jwt}`,
        "Crypto-Key": `p256ecdsa=${vapid.publicKey}`,
      },
    });

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    return { ok: false, status: response.status };
  } catch {
    return { ok: false };
  }
}

export async function sendWebPushToUser({
  userId,
}: SendWebPushToUserParams): Promise<PushSendResult> {
  const hasVapidConfig =
    Boolean(process.env.WEB_PUSH_VAPID_PRIVATE_KEY_PEM) &&
    Boolean(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY);

  if (!hasVapidConfig) {
    return { ok: false, attempted: 0, sent: 0, failed: 0 };
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    return { ok: false, attempted: 0, sent: 0, failed: 0 };
  }

  const subscriptions = data as PushSubscriptionRow[];
  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  for (const subscription of subscriptions) {
    const result = await sendPushPing(subscription.endpoint);
    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;
    if (result.status === 404 || result.status === 410) {
      staleIds.push(subscription.id);
    }
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return {
    ok: sent > 0,
    attempted: subscriptions.length,
    sent,
    failed,
  };
}

