import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { subscribeAuthQueryCache } from "./auth-query-cache";

function setup() {
  let listener: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0];
  const clear = vi.fn();
  const unsubscribe = vi.fn();
  const auth = {
    onAuthStateChange: vi.fn((callback: typeof listener) => {
      listener = callback;
      return { data: { subscription: { id: "test", callback, unsubscribe } } };
    }),
  };
  const cleanup = subscribeAuthQueryCache(auth, { clear });
  const emit = (event: AuthChangeEvent, id: string | null) => listener(
    event,
    id ? { user: { id } } as Session : null
  );
  return { clear, unsubscribe, cleanup, emit };
}

describe("authenticated query cache lifecycle", () => {
  it("clears cached data immediately on logout", () => {
    const { clear, emit } = setup();
    emit("INITIAL_SESSION", "user-1");
    emit("SIGNED_OUT", null);
    expect(clear).toHaveBeenCalledOnce();
  });

  it("clears data when switching between accounts", () => {
    const { clear, emit } = setup();
    emit("INITIAL_SESSION", "user-1");
    emit("SIGNED_IN", "user-2");
    expect(clear).toHaveBeenCalledOnce();
  });

  it("keeps data during token refresh and repeated sign-in for the same user", () => {
    const { clear, emit } = setup();
    emit("INITIAL_SESSION", "user-1");
    emit("TOKEN_REFRESHED", "user-1");
    emit("SIGNED_IN", "user-1");
    expect(clear).not.toHaveBeenCalled();
  });

  it("unsubscribes when the provider unmounts", () => {
    const { cleanup, unsubscribe } = setup();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
