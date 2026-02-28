"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Supabase Client
import { 
  getInviteByToken, 
  acceptInviteByToken, 
  setPendingJoinTokenCookie, 
  getAndClearPendingJoinTokenCookie 
} from "@/actions/invite-actions";
import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";
import { 
  getOAuthOrigin, 
  setJoinRedirectCookie, 
  getJoinRedirectCookie, 
  clearJoinRedirectCookie 
} from "@/lib/utils";

// 토큰 추출 헬퍼 함수
function extractTokenFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    try {
      const url = trimmed.startsWith("/") ? new URL(trimmed, window.location.origin) : new URL(trimmed);
      const t = url.searchParams.get("token");
      if (t) return decodeURIComponent(t).trim();
      const m = url.pathname.match(/\/join\/([^/?]+)/);
      if (m?.[1]) return decodeURIComponent(m[1]).trim();
    } catch {
      /* ignore */
    }
  }
  return trimmed;
}

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

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get("token");
  
  // 상태 관리
  const [token, setToken] = useState(tokenFromUrl || "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(!!tokenFromUrl);
  const [signingUp, setSigningUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    organization_name: string;
    role: string;
    department: string | null;
    name: string | null;
    inviter?: {
      name: string | null;
      department: string | null;
      organization_name: string | null;
    };
  } | null>(null);

  // 1. URL 토큰 동기화
  useEffect(() => {
    const t = searchParams.get("token");
    if (t && t !== token) {
      setToken(t);
      setMessage(null);
    }
  }, [searchParams, token]);

  // 2. 로그인 상태 확인 (이미 로그인된 유저 처리) - getUser()로 변경하여 정확도 향상
  useEffect(() => {
    const checkAuth = async () => {
      // getSession 대신 getUser 사용 (보안 및 정확성 위함)
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);
      if (user.email) setEmail(user.email);
      const displayName = user.user_metadata?.name || user.user_metadata?.full_name;
      if (displayName) setName(displayName);
    };
    void checkAuth().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Join checkAuth error:", error);
    });
  }, []);

  // 3. 리다이렉트 후 토큰 복원 (OAuth 복귀 시)
  useEffect(() => {
    if (tokenFromUrl) return;
    const restore = async () => {
      // 서버 쿠키 확인
      const { token: fromServer } = await getAndClearPendingJoinTokenCookie();
      if (fromServer) {
        router.replace(`/join?token=${encodeURIComponent(fromServer)}`);
        return;
      }
      // 클라이언트 쿠키 확인
      const stored = getJoinRedirectCookie();
      if (stored?.startsWith("/join?")) {
        try {
          const url = new URL(stored, window.location.origin);
          const t = url.searchParams.get("token");
          if (t) {
            clearJoinRedirectCookie();
            router.replace(`/join?token=${encodeURIComponent(t)}`);
          }
        } catch { /* ignore */ }
      }
    };
    void restore().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Join restore token error:", error);
    });
  }, [tokenFromUrl, router]);

  // 초대 정보 로딩
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const loadInvite = async () => {
      setMessage(null);
      const actualToken = extractTokenFromInput(token);
      if (!actualToken) {
        setLoading(false);
        return;
      }

      const result = await getInviteByToken(actualToken);
      if (!result.ok || !result.invite) {
        setMessage(result.message ?? "초대 정보를 불러올 수 없습니다.");
        setLoading(false);
        return;
      }

      // 부서 목록 조회
      if (result.invite.organization_id) {
        const { data: deptResult } = await supabase
          .from("departments")
          .select("name")
          .eq("organization_id", result.invite.organization_id)
          .order("name", { ascending: true });

        if (deptResult) {
          setAvailableDepartments(deptResult.map((d) => d.name));
        }
      }

      setInviteInfo({
        email: result.invite.email,
        organization_name: result.invite.organization_name || "",
        role: result.invite.role,
        department: result.invite.department || null,
        name: result.invite.name || null,
        inviter: result.invite.inviter,
      });

      setToken(actualToken);
      // 초대장에 있는 정보로 필드 초기화 (유저 입력값이 없으면)
      setEmail((prev) => prev || result.invite?.email || "");
      setName((prev) => prev || result.invite?.name || "");
      setDepartment((prev) => prev || result.invite?.department || "");
      
      setLoading(false);
    };

    void loadInvite().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Join loadInvite error:", error);
      setMessage("초대 정보를 불러오는 중 오류가 발생했습니다.");
      setLoading(false);
    });
  }, [token]);

  // 카카오 로그인 핸들러
  const handleKakaoSignIn = async () => {
    setMessage(null);
    setSigningUp(true);

    try {
      const origin = getOAuthOrigin();
      const nextUrl = token ? `/join?token=${encodeURIComponent(token)}` : `/join`;
      setJoinRedirectCookie(nextUrl);

      if (token) {
        const setResult = await setPendingJoinTokenCookie(token);
        if (!setResult.ok) {
          setMessage(setResult.error ?? "준비 중 오류가 발생했습니다.");
          setSigningUp(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      console.error("Kakao login exception:", error);
      setMessage(error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.");
      setSigningUp(false);
    }
  };

  // 초대 수락 핸들러 (이미 로그인된 상태)
  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningUp(true);
    setMessage(null);

    const actualToken = extractTokenFromInput(token);
    if (!actualToken) {
      setMessage("초대 토큰이 유효하지 않습니다.");
      setSigningUp(false);
      return;
    }

    const finalEmail = email.trim();
    if (!finalEmail) {
      setMessage("이메일을 입력해주세요.");
      setSigningUp(false);
      return;
    }

    try {
      // [핵심 수정] 서버 액션 호출 전 세션을 강제로 갱신하여 쿠키를 최신화함
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("Session refresh warning:", refreshError);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;

      // 서버 액션 호출
      const result = await acceptInviteByToken(actualToken, {
        email: finalEmail,
        name: name.trim() || null,
        department: department.trim() || null,
        phone: phone.trim() || null,
        accessToken,
      });

      if (!result.success) {
        setMessage(result.error ?? "초대 수락에 실패했습니다.");
        setSigningUp(false);
        return;
      }

      // 성공 처리: 세션 갱신 및 이동
      await new Promise((resolve) => setTimeout(resolve, 500));
      await supabase.auth.refreshSession(); 
      window.location.href = "/";
      
    } catch (err) {
      console.error("Invite processing error:", err);
      setMessage("처리 중 오류가 발생했습니다.");
      setSigningUp(false);
    }
  };

  // 수동 토큰 입력 핸들러
  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const actualToken = extractTokenFromInput(token);
    if(actualToken) setToken(actualToken); 
    setLoading(true); // useEffect 트리거
  };

  // --- 렌더링 ---

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900"></div>
          <p className="text-neutral-600">초대 정보를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // 1. 토큰이 없거나 유효하지 않은 경우 (초기 진입)
  if ((!token && isAuthenticated) || (token && !inviteInfo && !loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-neutral-50">
        <div className="surface-card w-full max-w-md space-y-6 p-6 md:p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900">초대 토큰 입력</h1>
            <p className="mt-2 text-sm text-neutral-600">관리자가 보낸 초대 링크의 토큰을 입력해주세요.</p>
          </div>

          {message && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {message}
            </div>
          )}

          <form onSubmit={handleManualTokenSubmit} className="space-y-4">
            <div className="space-y-2 text-sm">
              <label className="font-medium">초대 토큰</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="form-input w-full"
                placeholder="초대 토큰을 입력하세요"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "확인 중..." : "확인"}
            </button>
          </form>
          <div className="text-center mt-4">
             <Link href="/join-request" className="text-xs text-neutral-500 underline">
              가입 신청하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. 토큰도 없고 로그인도 안된 경우
  if (!token && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-neutral-600 mb-4">초대 링크가 올바르지 않습니다.</p>
          <Link href="/login" className="btn-primary inline-block text-sm">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  // 3. 초대 정보 로드 완료 -> 수락 화면
  if (inviteInfo) {
    const roleLabel =
      inviteInfo.role === "admin"
        ? "관리자"
        : inviteInfo.role === "manager"
        ? "부서 관리자"
        : "일반 사용자";
    const inviterName = inviteInfo.inviter?.name?.trim() || "초대한 사람";
    const inviteeName = inviteInfo.name?.trim() || "초대받는 사람";
    const organizationAndDepartment = `${inviteInfo.organization_name}${
      inviteInfo.department ? ` ${inviteInfo.department}` : ""
    }`;

    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-neutral-50">
        <div className="surface-card w-full max-w-md space-y-6 p-6 md:p-8">
          {/* 헤더 */}
          <div>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center">
                <LogoIcon className="w-full h-full" />
              </div>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold text-center mb-2">
              교회 자원관리 시스템
            </h1>
            
            {/* 초대 정보 카드 */}
            <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <p className="text-neutral-700 leading-relaxed">
                <span className="font-semibold text-neutral-900">{inviterName}</span>님께서{" "}
                <span className="font-semibold text-neutral-900">{inviteeName}</span>님을{" "}
                <span className="font-semibold text-neutral-900">{organizationAndDepartment}</span>의{" "}
                <span className="font-semibold text-neutral-900">{roleLabel}</span>로 초대합니다.
              </p>
            </div>
          </div>

          {/* A. 로그인 된 상태: 정보 확인 및 수락 폼 */}
          {isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 font-medium">
                아래 정보를 확인하고 &apos;초대 수락&apos;을 눌러주세요.
              </p>
              
              <form onSubmit={handleAcceptInvite} className="space-y-4">
                <div className="space-y-2 text-sm">
                  <label className="font-medium">이메일 (계정)</label>
                  <input
                    type="email"
                    value={email}
                    disabled // 이메일은 변경 불가 (로그인 계정과 일치해야 안전)
                    className="form-input w-full bg-neutral-100 text-neutral-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <label className="font-medium">이름</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input w-full"
                    placeholder="실명을 입력하세요"
                    required
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <label className="font-medium">소속 부서</label>
                  {availableDepartments.length > 0 ? (
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="form-select w-full"
                    >
                      <option value="">부서 선택</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="form-input w-full"
                      placeholder="예: 유년부"
                    />
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <label className="font-medium">연락처</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-input w-full"
                    placeholder="010-0000-0000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={signingUp}
                  className="btn-primary w-full"
                >
                  {signingUp ? "처리 중..." : "초대 수락 및 입장하기"}
                </button>
              </form>
            </div>
          ) : (
            /* B. 로그인 안 된 상태: 카카오 로그인 버튼 */
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 text-center">
                보안을 위해 카카오톡으로 본인 인증 후<br/>초대를 수락할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={handleKakaoSignIn}
                disabled={signingUp}
                className="btn-kakao"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 0C4.03 0 0 3.27 0 7.3c0 2.55 1.7 4.8 4.25 6.05L3 18l5.25-2.8c.5.05 1 .1 1.5.1 4.97 0 9-3.27 9-7.3S13.97 0 9 0z" fill="currentColor"/>
                </svg>
                카카오톡으로 로그인하고 수락하기
              </button>
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-700">
              {message}
            </div>
          )}

          <div className="text-center">
            <Link href="/login" className="text-xs text-neutral-500 underline">
              {isAuthenticated ? "다른 계정으로 로그인" : "이미 계정이 있으신가요? 로그인"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="space-y-2 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
          <p className="text-sm text-neutral-600">로딩 중...</p>
        </div>
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
