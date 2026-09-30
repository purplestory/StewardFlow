import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

type AuthSource = Pick<SupabaseClient["auth"], "onAuthStateChange">;

export function subscribeAuthQueryCache(
  auth: AuthSource,
  queryClient: Pick<QueryClient, "clear">
) {
  let previousUserId: string | null | undefined;

  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    const userId = session?.user.id ?? null;
    if (event === "SIGNED_OUT" || (previousUserId !== undefined && previousUserId !== userId)) {
      queryClient.clear();
    }
    previousUserId = userId;
  });

  return () => subscription.unsubscribe();
}
