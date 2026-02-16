"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const permissionRequestStorageKey = "web_push_permission_requested";

type PushSubscriptionJson = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function syncSubscription(accessToken: string, subscription: PushSubscription) {
  const json = subscription.toJSON() as PushSubscriptionJson;
  await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      subscription: json,
    }),
  });
}

async function removeSubscription(accessToken: string, endpoint: string) {
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      endpoint,
    }),
  });
}

export default function WebPushRegistrar() {
  const lastEndpointRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (!("Notification" in window)) return;
    if (!window.isSecureContext) return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    const register = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) return;
      accessTokenRef.current = session.access_token;

      if (
        Notification.permission === "default" &&
        localStorage.getItem(permissionRequestStorageKey) !== "1"
      ) {
        localStorage.setItem(permissionRequestStorageKey, "1");
        try {
          await Notification.requestPermission();
        } catch {
          return;
        }
      }

      if (Notification.permission !== "granted") return;

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        lastEndpointRef.current = existing.endpoint;
        await syncSubscription(session.access_token, existing);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      lastEndpointRef.current = subscription.endpoint;
      await syncSubscription(session.access_token, subscription);
    };

    void register();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const accessToken = session?.access_token ?? accessTokenRef.current;
        if (session?.access_token) {
          accessTokenRef.current = session.access_token;
        }

        if (event === "SIGNED_OUT" && accessToken && lastEndpointRef.current) {
          await removeSubscription(accessToken, lastEndpointRef.current);
          lastEndpointRef.current = null;
          accessTokenRef.current = null;
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          void register();
        }
      }
    );

    return () => {
      authSubscription?.subscription?.unsubscribe();
    };
  }, []);

  return null;
}
