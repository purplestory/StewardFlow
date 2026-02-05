"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthCard from "@/components/auth/AuthCard";
import Link from "next/link";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inviteToken, setInviteToken] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for error message from callback
    const error = searchParams.get("error");
    if (error) {
      // Error will be displayed by AuthCard component
    }

    // Check if user is already logged in
    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        // User is already logged in, redirect to home
        // replace를 사용하여 히스토리에 남기지 않음
        window.location.replace("/");
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // OAuth 콜백에서 이미 리다이렉트를 처리하므로 여기서는 처리하지 않음
        // 단, 로그인 페이지에 직접 접근한 경우에만 리다이렉트
        if (event === "SIGNED_IN" && session?.user && !searchParams.get("error")) {
          // 콜백 페이지를 거치지 않고 직접 로그인한 경우에만 리다이렉트
          // replace를 사용하여 히스토리에 남기지 않음
          window.location.replace("/");
        }
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [router]);

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
      } catch (e) {
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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">로그인 / 가입</h1>
          <p className="text-sm text-neutral-600 mt-2">
            이 서비스는 기관 내부 사용자만 이용할 수 있습니다.
            <br />
            관리자가 보낸 초대 링크가 있어야 가입할 수 있습니다.
          </p>
        </div>
        <AuthCard />
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <p className="font-medium text-sm mb-4">초대 링크로 가입하기</p>
          <form onSubmit={handleInviteTokenSubmit} className="space-y-3">
            <input
              type="text"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="초대 링크를 붙여넣으세요 (예: https://example.com/join?token=AbC123XyZ9 또는 AbC123XyZ9)"
              className="form-input w-full text-sm"
            />
            <button
              type="submit"
              className="btn-secondary w-full"
            >
              초대 링크로 가입하기
            </button>
          </form>
          {inviteMessage && (
            <p className="mt-3 text-xs text-red-600">{inviteMessage}</p>
          )}
          <p className="mt-4 text-xs text-neutral-500">
            관리자가 보낸 초대 링크 전체, 또는 토큰을 붙여넣으세요.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginPageContent />
    </Suspense>
  );
}
