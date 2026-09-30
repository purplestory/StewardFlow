"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthCard from "@/components/auth/AuthCard";
import Notice from "@/components/common/Notice";

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

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inviteToken, setInviteToken] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const authError = searchParams.get("error");

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user && !authError) {
        // User is already logged in, redirect to home
        // replace를 사용하여 히스토리에 남기지 않음
        window.location.replace("/");
      }
    };

    void checkSession().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Login checkSession error:", error);
    });

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // OAuth 콜백에서 이미 리다이렉트를 처리하므로 여기서는 처리하지 않음
        // 단, 로그인 페이지에 직접 접근한 경우에만 리다이렉트
        if (event === "SIGNED_IN" && session?.user && !authError) {
          // 콜백 페이지를 거치지 않고 직접 로그인한 경우에만 리다이렉트
          // replace를 사용하여 히스토리에 남기지 않음
          window.location.replace("/");
        }
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [authError]);

  const extractTokenFromUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // URL 형식인지 확인 (http:// 또는 https:// 또는 /로 시작)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      try {
        // 전체 URL인 경우
        const url = trimmed.startsWith('/') ? new URL(trimmed, window.location.origin) : new URL(trimmed);
        const token = url.searchParams.get('token');
        if (token) return token;
        
        // URL 경로에서 토큰 추출 시도 (예: /join/AbC123XyZ9)
        const pathMatch = url.pathname.match(/\/join\/([^/?]+)/);
        if (pathMatch) return pathMatch[1];
      } catch {
        // URL 파싱 실패 시 원본 반환
      }
    }

    // 토큰만 입력한 경우 그대로 반환
    return trimmed;
  };

  const handleInviteTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);
    
    if (!inviteToken.trim()) {
      setInviteMessage("초대 링크를 입력해주세요.");
      return;
    }

    // URL에서 토큰 추출
    const extractedToken = extractTokenFromUrl(inviteToken);
    
    if (!extractedToken) {
      setInviteMessage("올바른 초대 링크를 입력해주세요.");
      return;
    }

    // 초대 링크로 가입 페이지로 이동
    router.push(`/join?token=${encodeURIComponent(extractedToken)}`);
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center py-6 md:py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <p className="text-xs font-semibold text-brand-primary">STEWARD FLOW</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">로그인</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            카카오 계정으로 안전하게 이어서 사용하세요.
          </p>
        </div>
        <div className="surface-panel p-5 md:p-6" aria-labelledby="login-card-title">
          <h2 id="login-card-title" className="sr-only">카카오 로그인과 초대 링크 가입</h2>
          {authError ? (
            <Notice variant="error" className="mb-4 break-words">
              <p className="font-semibold">로그인을 완료하지 못했습니다.</p>
              <p className="mt-1 text-sm">{authError}</p>
            </Notice>
          ) : null}
          <AuthCard />
          <div className="mt-5 space-y-3 border-t border-neutral-200 pt-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">처음 참여하시나요?</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">관리자가 보낸 초대 링크 또는 토큰을 입력하세요.</p>
            </div>
            <form onSubmit={handleInviteTokenSubmit} className="space-y-3">
              <label htmlFor="invite-link" className="sr-only">초대 링크 또는 토큰</label>
              <input
                id="invite-link"
                type="text"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="초대 링크 또는 토큰"
                autoComplete="off"
                aria-invalid={Boolean(inviteMessage)}
                aria-describedby={inviteMessage ? "invite-error" : undefined}
                className="form-input w-full text-sm"
              />
              <button type="submit" className="btn-outline w-full">
                초대 링크로 가입하기
              </button>
            </form>
            {inviteMessage && (
              <p id="invite-error" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
                {inviteMessage}
              </p>
            )}
          </div>
        </div>
        <p className="break-keep text-center text-xs leading-5 text-neutral-500">
          StewardFlow는 초대받은 기관 구성원만 사용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
        <div className="text-center">
          <div className="space-y-2">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
            <p className="text-sm text-neutral-600">로딩 중...</p>
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
