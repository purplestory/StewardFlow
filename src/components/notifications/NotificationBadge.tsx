"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  addNotificationBadgeSyncListener,
} from "@/lib/notification-ui-events";

type NotificationRealtimeRow = {
  user_id?: string | null;
};

export default function NotificationBadge() {
  const [count, setCount] = useState(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user ?? null;

        if (!user) {
          if (isMounted) {
            setCount(0);
          }
          userIdRef.current = null;
          return;
        }

        userIdRef.current = user.id;

        const { count: unreadCount } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null);

        if (!isMounted) return;
        setCount(unreadCount ?? 0);
      } catch {
        if (!isMounted) return;
        setCount(0);
      }
    };

    void load();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    const channel = supabase
      .channel("notifications-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const newRecord = payload.new as NotificationRealtimeRow | null;
          const oldRecord = payload.old as NotificationRealtimeRow | null;
          const affectedUserId = newRecord?.user_id ?? oldRecord?.user_id;
          if (affectedUserId && affectedUserId === userIdRef.current) {
            void load();
          }
        }
      )
      .subscribe();

    const removeSyncListener = addNotificationBadgeSyncListener((nextCount) => {
      if (typeof nextCount === "number") {
        setCount(Math.max(0, nextCount));
        return;
      }
      void load();
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
      removeSyncListener();
    };
  }, []);

  if (count === 0) {
    return null;
  }

  return (
    <Link href="/notifications" className="relative inline-flex items-center">
      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
        {count}
      </span>
    </Link>
  );
}
