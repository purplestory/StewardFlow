"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getJoinRedirectCookie, clearJoinRedirectCookie } from "@/lib/utils";
import { sanitizeInternalRedirectPath } from "@/lib/auth-redirect";
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
    const SESSION_RECOVERY_RETRIES = 24;
    const SESSION_RECOVERY_DELAY_MS = 150;
    const resolveAuthErrorMessage = (message?: string | null) => {
      const normalized = (message || "").toLowerCase();
      if (!normalized) return "인증에 실패했습니다.";
      if (
        normalized.includes("flow_state_not_found") ||
        normalized.includes("flow state") ||
        normalized.includes("code verifier") ||
        normalized.includes("pkce")
      ) {
        return "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
      }
      if (normalized.includes("cancel") || normalized.includes("access_denied")) {
        return "로그인이 취소되었습니다.";
      }
      return "인증에 실패했습니다.";
    };
    const isRecoverableOAuthError = (message?: string | null) => {
      const normalized = (message || "").toLowerCase();
      return (
        normalized.includes("flow_state_not_found") ||
        normalized.includes("flow state") ||
        normalized.includes("invalid flow state") ||
        normalized.includes("invalid_grant") ||
        normalized.includes("code verifier") ||
        (normalized.includes("code") && normalized.includes("used")) ||
        normalized.includes("pkce") ||
        normalized.includes("exchange")
      );
    };

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

        const waitForActiveSessionUser = async (retries = 8, delayMs = 120) => {
          let attempt = 0;
          while (attempt < retries) {
            if (await hasActiveSessionUser()) return true;
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
          return false;
        };

        const completeSuccess = async () => {
          if (isPopup || isIframe) {
            // Wait for session to be fully established and verify
            await waitForActiveSessionUser(10, 100);

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

          // 리다이렉트 대상 우선순위:
          // 1) next 쿼리(명시값) 2) 서버 httpOnly 쿠키(초대 토큰) 3) 클라이언트 저장 4) /
          const explicitNext = sanitizeInternalRedirectPath(searchParams.get("next"));
          let next = explicitNext;
          if (!explicitNext) {
            try {
              const { token: pendingToken } = await getAndClearPendingJoinTokenCookie();
              if (pendingToken) {
                next = `/join?token=${encodeURIComponent(pendingToken)}`;
              }
            } catch (tokenError) {
              console.warn("Failed to restore pending join token:", tokenError);
            }
          }
          if (!next) {
            next = sanitizeInternalRedirectPath(getJoinRedirectCookie()) || "/";
          }
          clearJoinRedirectCookie();
          window.location.replace(next);
        };

        const handleAuthError = async (message: string) => {
          // 콜백이 중복 실행되어 code 재교환 실패가 나도, 이미 세션이 있으면 성공 흐름으로 처리한다.
          if (
            await waitForActiveSessionUser(
              SESSION_RECOVERY_RETRIES,
              SESSION_RECOVERY_DELAY_MS
            )
          ) {
            await completeSuccess();
            return;
          }

          if (isPopup || isIframe) {
            setError(message);
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
            // 전체 페이지 콜백에서는 에러 텍스트를 먼저 그리지 않고 즉시 이동해 깜빡임을 줄인다.
            window.location.replace(`/login?error=${encodeURIComponent(message)}`);
          }
        };

        const getOAuthErrorFromParams = () => {
          const queryError =
            searchParams.get("error_description") ||
            searchParams.get("error");
          if (queryError) return queryError;

          const hash = window.location.hash.substring(1);
          if (!hash) return null;
          const hashParams = new URLSearchParams(hash);
          return (
            hashParams.get("error_description") ||
            hashParams.get("error")
          );
        };

        const oauthParamError = getOAuthErrorFromParams();
        if (oauthParamError) {
          await handleAuthError(resolveAuthErrorMessage(oauthParamError));
          return;
        }

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
          // createBrowserClient(@supabase/ssr)는 detectSessionInUrl에서 code 교환을 자동 처리한다.
          // 자동 교환 완료 전에 수동 교환을 바로 호출하면 flow_state_not_found가 발생할 수 있어 먼저 대기한다.
          if (
            await waitForActiveSessionUser(
              SESSION_RECOVERY_RETRIES,
              SESSION_RECOVERY_DELAY_MS
            )
          ) {
            await completeSuccess();
            return;
          }

          // Exchange code for session
          let exchangeErrorMessage: string | null = null;
          try {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            exchangeErrorMessage = exchangeError?.message ?? null;
          } catch (exchangeException) {
            exchangeErrorMessage =
              exchangeException instanceof Error
                ? exchangeException.message
                : "code exchange exception";
          }

          if (exchangeErrorMessage) {
            if (isRecoverableOAuthError(exchangeErrorMessage)) {
              if (
                await waitForActiveSessionUser(
                  SESSION_RECOVERY_RETRIES,
                  SESSION_RECOVERY_DELAY_MS
                )
              ) {
                await completeSuccess();
                return;
              }
            }
            await handleAuthError(resolveAuthErrorMessage(exchangeErrorMessage));
            return;
          }
          await completeSuccess();
          return;
        }

        if (
          (await hasActiveSessionUser()) ||
          (await waitForActiveSessionUser(8, 120))
        ) {
          await completeSuccess();
          return;
        }

        await handleAuthError("인증 정보를 찾을 수 없습니다.");
      } catch (callbackError) {
        console.error("Auth callback error:", callbackError);
        const fallbackMessage = resolveAuthErrorMessage(
          callbackError instanceof Error ? callbackError.message : null
        );
        if (await supabase.auth.getUser().then(({ data }) => Boolean(data.user)).catch(() => false)) {
          const next = sanitizeInternalRedirectPath(getJoinRedirectCookie()) || "/";
          clearJoinRedirectCookie();
          window.location.replace(next);
          return;
        }

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
          setError(fallbackMessage);
          const target = (window.opener && !window.opener.closed) ? window.opener : window.parent;
          if (target && target !== window) {
            target.postMessage({ 
              type: "OAUTH_ERROR", 
              error: fallbackMessage 
            }, window.location.origin);
          }
          if (isPopupError) {
            setTimeout(() => window.close(), 100);
          }
        } else {
          // replace를 사용하여 히스토리에 남기지 않음
          window.location.replace(`/login?error=${encodeURIComponent(fallbackMessage)}`);
        }
      }
    };

    void handleCallback().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Auth callback unhandled error:", error);
      const fallbackMessage = resolveAuthErrorMessage(
        error instanceof Error ? error.message : null
      );
      const isPopupUnhandled = (() => {
        try {
          return window.opener !== null && !window.opener.closed;
        } catch {
          return false;
        }
      })();
      const isIframeUnhandled = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();
      if (isPopupUnhandled || isIframeUnhandled) {
        setError(fallbackMessage);
      } else {
        window.location.replace(`/login?error=${encodeURIComponent(fallbackMessage)}`);
      }
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
