"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getJoinRedirectCookie, clearJoinRedirectCookie } from "@/lib/utils";
import { getAndClearPendingJoinTokenCookie } from "@/actions/invite-actions";

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  ) {
    return true;
  }
  return false;
}

function AuthCallbackPageContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hasOpener = (() => {
          try {
            return (
              typeof window.opener !== "undefined" &&
              window.opener !== null &&
              window.opener !== window &&
              !window.opener.closed
            );
          } catch {
            return false;
          }
        })();
        const isIframe = (() => {
          try {
            return window.self !== window.top;
          } catch {
            // cross-origin 프레임 접근 오류가 나면 iframe으로 간주
            return true;
          }
        })();
        const isPopup = hasOpener;

        const hasActiveSessionUser = async () => {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            return Boolean(user);
          } catch {
            return false;
          }
        };

        const completeSuccess = async () => {
          if (isPopup || isIframe) {
            // Wait for session to be fully established and verify
            let retries = 0;
            while (retries < 10) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) break;
              retries++;
            }

            try {
              if (hasOpener && window.opener) {
                window.opener.postMessage({ type: "OAUTH_SUCCESS" }, window.location.origin);
              } else if (isIframe && window.parent && window.parent !== window) {
                window.parent.postMessage({ type: "OAUTH_SUCCESS" }, window.location.origin);
              }
            } catch (e) {
              console.error("Failed to send message to opener:", e);
            }

            if (isPopup) {
              setTimeout(() => {
                try {
                  window.close();
                } catch (e) {
                  console.error("Failed to close popup:", e);
                }
              }, 200);
            }
            return;
          }

          // 리다이렉트 대상: next 쿼리 → 서버 httpOnly 쿠키(초대 토큰) → 클라이언트 저장 → /
          let next = searchParams.get("next") || "/";
          if (!searchParams.get("next")) {
            try {
              const { token: pendingToken } = await getAndClearPendingJoinTokenCookie();
              if (pendingToken) next = `/join?token=${encodeURIComponent(pendingToken)}`;
            } catch (tokenError) {
              console.warn("Failed to restore pending join token:", tokenError);
            }
          }
          if (!next || next === "/") next = getJoinRedirectCookie() || "/";
          clearJoinRedirectCookie();
          const currentOrigin = window.location.origin;
          const nextUrl = next.startsWith("http")
            ? next
            : `${currentOrigin}${next.startsWith("/") ? next : `/${next}`}`;
          window.location.replace(nextUrl);
        };

        const handleAuthError = async (message: string) => {
          // 콜백이 중복 실행되어 code 재교환 실패가 나도, 이미 세션이 있으면 성공 흐름으로 처리한다.
          if (await hasActiveSessionUser()) {
            await completeSuccess();
            return;
          }

          setError(message);
          if (isPopup || isIframe) {
            const target = hasOpener ? window.opener : window.parent;
            if (target && target !== window) {
              target.postMessage(
                {
                  type: "OAUTH_ERROR",
                  error: message,
                },
                window.location.origin
              );
            }
            if (isPopup) {
              setTimeout(() => window.close(), 100);
            }
          } else {
            window.location.replace(`/login?error=${encodeURIComponent(message)}`);
          }
        };

        // Strict mode / 경합 상황에서 이미 세션이 만들어진 경우 바로 성공 처리
        if (await hasActiveSessionUser()) {
          await completeSuccess();
          return;
        }

        // Check for hash fragment (OAuth callback with tokens)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);

        // Check for access_token in hash (OAuth callback)
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          // Set session from hash fragment
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            await handleAuthError("인증에 실패했습니다.");
            return;
          }

          // Clear hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          await completeSuccess();
          return;
        }

        // Check for code in query params (PKCE flow)
        const code = searchParams.get("code");
        if (code) {
          // Exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            await handleAuthError("인증에 실패했습니다.");
            return;
          }
          await completeSuccess();
          return;
        }

        if (await hasActiveSessionUser()) {
          await completeSuccess();
          return;
        }

        await handleAuthError("인증 정보를 찾을 수 없습니다.");
      } catch (callbackError) {
        console.error("Auth callback error:", callbackError);
        if (await supabase.auth.getUser().then(({ data }) => Boolean(data.user)).catch(() => false)) {
          const currentOrigin = window.location.origin;
          const next = getJoinRedirectCookie() || "/";
          clearJoinRedirectCookie();
          const nextUrl = next.startsWith("http")
            ? next
            : `${currentOrigin}${next.startsWith("/") ? next : `/${next}`}`;
          window.location.replace(nextUrl);
          return;
        }

        setError("오류가 발생했습니다.");
        // 팝업 창 또는 iframe인지 확인
        const isPopupError = (() => {
          try {
            return window.opener !== null && !window.opener.closed;
          } catch {
            return false;
          }
        })();
        const isIframe = (() => {
          try {
            return window.self !== window.top;
          } catch {
            return true;
          }
        })();
        if ((isPopupError && window.opener) || isIframe) {
          const target = (window.opener && !window.opener.closed) ? window.opener : window.parent;
          if (target && target !== window) {
            target.postMessage({ 
              type: "OAUTH_ERROR", 
              error: "오류가 발생했습니다." 
            }, window.location.origin);
          }
          if (isPopupError) {
            setTimeout(() => window.close(), 100);
          }
        } else {
          // replace를 사용하여 히스토리에 남기지 않음
          window.location.replace("/login?error=오류가 발생했습니다");
        }
      }
    };

    void handleCallback().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Auth callback unhandled error:", error);
      setError("오류가 발생했습니다.");
      window.location.replace("/login?error=오류가 발생했습니다");
    });
  }, [searchParams]);

  // 리다이렉트 중이면 아무것도 표시하지 않음 (깜빡임 방지)
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-600">{error}</p>
            <p className="text-xs text-neutral-500">로그인 페이지로 이동합니다...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
            <p className="text-sm text-neutral-600">로그인 처리 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="space-y-2">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
            <p className="text-sm text-neutral-600">로딩 중...</p>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackPageContent />
    </Suspense>
  );
}
