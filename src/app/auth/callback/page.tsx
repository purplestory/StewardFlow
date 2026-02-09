"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getJoinRedirectCookie, clearJoinRedirectCookie } from "@/lib/utils";
import { getAndClearPendingJoinTokenCookie } from "@/actions/invite-actions";

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 팝업 창인지 먼저 확인 (가장 먼저 확인)
        // window.opener가 있고, window.opener가 window 자신이 아닌 경우
        const isPopup = typeof window.opener !== 'undefined' && 
                       window.opener !== null && 
                       window.opener !== window;
        
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
            setError("인증에 실패했습니다.");
            // 팝업 창 또는 iframe인지 확인
            if (isPopup || window.self !== window.top) {
              const target = (window.opener && !window.opener.closed) ? window.opener : window.parent;
              if (target && target !== window) {
                target.postMessage({ 
                  type: "OAUTH_ERROR", 
                  error: "인증에 실패했습니다." 
                }, window.location.origin);
              }
              if (isPopup) {
                setTimeout(() => window.close(), 100);
              }
            } else {
              // replace를 사용하여 히스토리에 남기지 않음
              window.location.replace("/login?error=인증에 실패했습니다");
            }
            return;
          }

          // Clear hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          
          // 팝업 창 또는 iframe인 경우 - 절대 리다이렉트하지 않음
          if (isPopup || window.self !== window.top) {
            // Wait for session to be fully established and verify
            let retries = 0;
            while (retries < 10) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                break;
              }
              retries++;
            }
            
            try {
              // 부모 창에 메시지 전송 (팝업 또는 iframe)
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: "OAUTH_SUCCESS" }, window.location.origin);
              } else if (window.parent && window.parent !== window) {
                // iframe인 경우
                window.parent.postMessage({ type: "OAUTH_SUCCESS" }, window.location.origin);
              }
            } catch (e) {
              console.error("Failed to send message to opener:", e);
            }
            // 팝업인 경우에만 닫기
            if (isPopup) {
              setTimeout(() => {
                try {
                  window.close();
                } catch (e) {
                  console.error("Failed to close popup:", e);
                }
              }, 200);
            }
            return; // 여기서 반드시 종료 - 리다이렉트하지 않음
          }
          
          // 리다이렉트 대상: next 쿼리 → 서버 httpOnly 쿠키(초대 토큰) → 클라이언트 저장 → /
          let next = searchParams.get("next");
          if (!next) {
            const { token: pendingToken } = await getAndClearPendingJoinTokenCookie();
            if (pendingToken) next = `/join?token=${encodeURIComponent(pendingToken)}`;
          }
          if (!next) next = getJoinRedirectCookie() || "/";
          clearJoinRedirectCookie();
          const currentOrigin = window.location.origin;
          const nextUrl = next.startsWith("http") ? next : `${currentOrigin}${next.startsWith("/") ? next : `/${next}`}`;
          window.location.replace(nextUrl);
          return;
        }

        // Check for code in query params (PKCE flow)
        const code = searchParams.get("code");
        if (code) {
          // Exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            setError("인증에 실패했습니다.");
            // 팝업 창 또는 iframe인지 확인
            if (isPopup || window.self !== window.top) {
              const target = (window.opener && !window.opener.closed) ? window.opener : window.parent;
              if (target && target !== window) {
                target.postMessage({ 
                  type: "OAUTH_ERROR", 
                  error: "인증에 실패했습니다." 
                }, window.location.origin);
              }
              if (isPopup) {
                setTimeout(() => window.close(), 100);
              }
            } else {
              // replace를 사용하여 히스토리에 남기지 않음
              window.location.replace("/login?error=인증에 실패했습니다");
            }
            return;
          }
          
          // 팝업 창 또는 iframe인 경우 - 절대 리다이렉트하지 않음
          if (isPopup || window.self !== window.top) {
            // Wait for session to be fully established and verify
            let retries = 0;
            while (retries < 10) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                break;
              }
              retries++;
            }
            
            try {
              // 부모 창에 메시지 전송 (팝업 또는 iframe)
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: "OAUTH_SUCCESS" }, window.location.origin);
              } else if (window.parent && window.parent !== window) {
                // iframe인 경우
                window.parent.postMessage({ type: "OAUTH_SUCCESS" }, window.location.origin);
              }
            } catch (e) {
              console.error("Failed to send message to opener:", e);
            }
            // 팝업인 경우에만 닫기
            if (isPopup) {
              setTimeout(() => {
                try {
                  window.close();
                } catch (e) {
                  console.error("Failed to close popup:", e);
                }
              }, 200);
            }
            return; // 여기서 반드시 종료 - 리다이렉트하지 않음
          }
          
          // 리다이렉트 대상: next 쿼리 → 서버 httpOnly 쿠키(초대 토큰) → 클라이언트 저장 → /
          let next = searchParams.get("next");
          if (!next) {
            const { token: pendingToken } = await getAndClearPendingJoinTokenCookie();
            if (pendingToken) next = `/join?token=${encodeURIComponent(pendingToken)}`;
          }
          if (!next) next = getJoinRedirectCookie() || "/";
          clearJoinRedirectCookie();
          const currentOrigin = window.location.origin;
          const nextUrl = next.startsWith("http") ? next : `${currentOrigin}${next.startsWith("/") ? next : `/${next}`}`;
          window.location.replace(nextUrl);
          return;
        }

        // If no tokens or code, redirect to login
        if (isPopup && window.opener) {
          window.opener.postMessage({ 
            type: "OAUTH_ERROR", 
            error: "인증 정보를 찾을 수 없습니다." 
          }, window.location.origin);
          setTimeout(() => window.close(), 100);
        } else {
          // replace를 사용하여 히스토리에 남기지 않음
          window.location.replace("/login?error=인증 정보를 찾을 수 없습니다");
        }
      } catch (err) {
        setError("오류가 발생했습니다.");
        // 팝업 창 또는 iframe인지 확인
        const isPopupError = window.opener !== null && !window.opener.closed;
        const isIframe = window.self !== window.top;
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

    handleCallback();
  }, [router, searchParams]);

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
