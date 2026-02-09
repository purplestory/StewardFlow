const JOIN_REDIRECT_KEY = "join_redirect";

/** OAuth 리다이렉트 시 next 파라미터가 유실되는 문제 해결: 카카오 로그인 전에 토큰 저장 (localStorage + 쿠키) */
export function setJoinRedirectCookie(nextPath: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(JOIN_REDIRECT_KEY, nextPath);
  } catch {
    /* ignore */
  }
  try {
    const maxAge = 60 * 10; // 10분
    document.cookie = `${JOIN_REDIRECT_KEY}=${encodeURIComponent(nextPath)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function getJoinRedirectCookie(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromStorage = localStorage.getItem(JOIN_REDIRECT_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    /* ignore */
  }
  try {
    const match = document.cookie.match(new RegExp(`(^| )${JOIN_REDIRECT_KEY}=([^;]+)`));
    const value = match?.[2];
    if (!value) return null;
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function clearJoinRedirectCookie(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(JOIN_REDIRECT_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${JOIN_REDIRECT_KEY}=; path=/; max-age=0`;
  } catch {
    /* ignore */
  }
}

/**
 * Get the origin URL, converting 0.0.0.0 to localhost for Safari compatibility
 */
export function getOrigin(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  const origin = window.location.origin;
  
  // Convert 0.0.0.0 to localhost for Safari compatibility
  if (origin.includes("0.0.0.0")) {
    return origin.replace("0.0.0.0", "localhost");
  }
  
  return origin;
}
