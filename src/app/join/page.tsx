"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getInviteByToken } from "@/actions/invite-actions";
import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";

import { getOrigin } from "@/lib/utils";

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get("token");
  const [token, setToken] = useState(tokenFromUrl || "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(!!tokenFromUrl);
  const [signingUp, setSigningUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      setIsAuthenticated(!!user);
      
      // If logged in via Kakao, pre-fill email
      if (user?.email) {
        setEmail(user.email);
      }
    };
    checkAuth();
  }, []);

  const handleKakaoSignIn = async () => {
    setMessage(null);
    setSigningUp(true);

    try {
      const origin = getOrigin();
      // 카카오 로그인 후 다시 이 페이지로 돌아오도록 설정 (토큰 유지)
      const nextUrl = token ? `/join?token=${token}` : `/join`;
      const redirectUrl = `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`;
      
      console.log("Starting Kakao login from join page:", {
        origin,
        redirectUrl,
        token
      });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            redirect_to: redirectUrl,
            prompt: "select_account",
          },
        },
      });

      if (error) {
        console.error("Kakao login error:", error);
        setMessage(`로그인 오류: ${error.message}`);
        setSigningUp(false);
        return;
      }

      if (data?.url) {
        // Redirect to Kakao
        window.location.href = data.url;
      } else {
        setMessage("로그인 URL을 생성할 수 없습니다.");
        setSigningUp(false);
      }
    } catch (error) {
      console.error("Kakao login exception:", error);
      setMessage(error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.");
      setSigningUp(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // 기관 이름 조회 실패해도 초대 정보는 반환 (organization_id는 있음)
    // RLS 문제로 인해 클라이언트에서 조회 실패할 수 있으므로, 
    // 여기서 실패하더라도 로직은 계속 진행되어야 함.
    // 하지만 Admin Client를 사용하여 해결했으므로 이 문제는 발생하지 않아야 함.

    const loadInvite = async () => {
      // 로딩 시작 시 에러 메시지 초기화
      setMessage(null);
      
      const result = await getInviteByToken(token);
      if (!result.ok || !result.invite) {
        setMessage(result.message ?? "초대 정보를 불러올 수 없습니다.");
        setLoading(false);
        return;
      }

      // Get departments (organization name is already included in invite)
      const { data: deptResult } = await supabase
        .from("departments")
        .select("name")
        .eq("organization_id", result.invite.organization_id)
        .order("name", { ascending: true });

      if (deptResult) {
        setAvailableDepartments(deptResult.map((d) => d.name));
      }

      setInviteInfo({
        email: result.invite.email,
        organization_name: result.invite.organization_name || "",
        role: result.invite.role,
        department: result.invite.department || null,
        name: result.invite.name || null,
        inviter: result.invite.inviter,
      });
      // 초대 시 지정한 이메일이 있으면 기본값으로 설정 (변경 가능)
      if (result.invite.email) {
        setEmail(result.invite.email);
      }
      // 초대 시 지정한 이름이 있으면 기본값으로 설정 (수정 가능)
      if (result.invite.name) {
        setName(result.invite.name);
      }
      // 초대 시 지정한 부서가 있으면 기본값으로 설정 (수정 가능)
      if (result.invite.department) {
        setDepartment(result.invite.department);
      }
      setLoading(false);
    };

    loadInvite();
  }, [token]);

  // Handle token input (when user manually enters token)
  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setMessage("초대 토큰을 입력해주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    
    const result = await getInviteByToken(token.trim());
    if (!result.ok || !result.invite) {
      setMessage(result.message ?? "초대 정보를 불러올 수 없습니다.");
      setLoading(false);
      return;
    }

    // Get departments (organization name is already included in invite)
    const { data: deptResult } = await supabase
      .from("departments")
      .select("name")
      .eq("organization_id", result.invite.organization_id)
      .order("name", { ascending: true });

    if (deptResult) {
      setAvailableDepartments(deptResult.map((d) => d.name));
    }

    setInviteInfo({
      email: result.invite.email,
      organization_name: result.invite.organization_name || "",
      role: result.invite.role,
      department: result.invite.department || null,
      name: result.invite.name || null,
      inviter: result.invite.inviter,
    });
    
    // 초대 시 지정한 이메일이 있으면 기본값으로 설정 (변경 가능)
    if (result.invite.email) {
      setEmail(result.invite.email);
    }
    // 초대 시 지정한 이름이 있으면 기본값으로 설정 (수정 가능)
    if (result.invite.name) {
      setName(result.invite.name);
    }
    // 초대 시 지정한 부서가 있으면 기본값으로 설정 (수정 가능)
    if (result.invite.department) {
      setDepartment(result.invite.department);
    }
    setLoading(false);
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSigningUp(true);

    if (!token) {
      setMessage("초대 링크가 올바르지 않습니다.");
      setSigningUp(false);
      return;
    }

    const inviteResult = await getInviteByToken(token);
    if (!inviteResult.ok || !inviteResult.invite) {
      setMessage(inviteResult.message ?? "초대 정보를 불러올 수 없습니다.");
      setSigningUp(false);
      return;
    }

    // 사용자가 입력한 이메일 또는 초대 정보의 이메일 사용
    const signUpEmail = email.trim() || inviteResult.invite.email;
    
    if (!signUpEmail) {
      setMessage("이메일을 입력해주세요.");
      setSigningUp(false);
      return;
    }

    // Send magic link
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: signUpEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/join?token=${token}`,
      },
    });

    if (signInError) {
      setMessage(signInError.message);
      setSigningUp(false);
      return;
    }

    setMessage(
      "가입 링크를 이메일로 보냈습니다. 이메일의 링크를 클릭하여 가입을 완료하세요."
    );
    setSigningUp(false);
  };

  // 자동 수락 로직 제거: 사용자가 명시적으로 "초대 수락" 버튼을 눌러야 함

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

  // 토큰이 없고 이미 로그인된 사용자인 경우: 토큰 입력 UI 표시
  // 또는 토큰이 있었으나 유효하지 않아 inviteInfo가 없는 경우
  if ((!token && isAuthenticated) || (token && !inviteInfo)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-neutral-50">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900">초대 토큰 입력</h1>
            <p className="mt-2 text-sm text-neutral-600">
              관리자가 보낸 초대 링크의 토큰을 입력해주세요.
            </p>
          </div>

          {message && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
              {message}
            </div>
          )}

          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div className="space-y-2 text-sm">
              <label className="font-medium">초대 토큰</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                placeholder="초대 토큰을 입력하세요"
                required
              />
              <p className="text-xs text-neutral-500">
                초대 링크에서 토큰 부분만 입력하거나, 전체 링크를 붙여넣으세요.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "확인 중..." : "확인"}
            </button>
          </form>

          {message && (
            <p className="text-sm text-rose-600" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 토큰이 없고 로그인되지 않은 경우
  if (!token && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">
            초대 링크가 올바르지 않습니다.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm text-neutral-600 underline"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  // 초대 정보가 없으면 로딩 또는 에러
  if (!inviteInfo) {
    if (message) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center space-y-4">
            <div>
              <p className="text-sm font-medium text-rose-600 mb-2">{message}</p>
              <p className="text-xs text-neutral-500">
                초대 링크의 토큰 부분을 다시 확인하거나, 관리자에게 새로운 초대를 요청하세요.
              </p>
            </div>
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setToken("");
                  setMessage(null);
                  setInviteInfo(null);
                }}
                className="btn-primary w-full"
              >
                다시 입력하기
              </button>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="btn-primary w-full inline-block text-center"
                >
                  로그인 페이지로 이동
                </Link>
                <button
                  onClick={() => {
                    setToken("");
                    setMessage(null);
                    setInviteInfo(null);
                  }}
                  className="btn-outline w-full"
                >
                  토큰 다시 입력하기
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white p-8">
        <div>
          {/* 로고 */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <LogoIcon className="w-full h-full" />
            </div>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-center mb-2">
            교회 자원관리 시스템에 초대합니다.
          </h1>
          
          {/* 초대 정보 상세 표시 */}
          <div className="mt-4 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <div className="font-medium text-neutral-900">초대 정보</div>
            
            {/* 초대한 사람 정보 */}
            {inviteInfo.inviter && (
              <div className="space-y-1 text-neutral-600">
                <div>
                  <span className="font-medium">초대한 사람:</span>{" "}
                  {inviteInfo.inviter.name || "이름 없음"}
                  {inviteInfo.inviter.department && ` (${inviteInfo.inviter.department})`}
                </div>
                {inviteInfo.inviter.organization_name && (
                  <div>
                    <span className="font-medium">초대한 사람의 기관:</span>{" "}
                    {inviteInfo.inviter.organization_name}
                  </div>
                )}
              </div>
            )}
            
            {/* 초대하는 기관 정보 */}
            <div className="space-y-1 text-neutral-600">
              <div>
                <span className="font-medium">초대하는 기관:</span>{" "}
                {inviteInfo.organization_name || (
                  <span className="text-amber-600">기관명 조회 실패 (기관 ID는 정상)</span>
                )}
              </div>
              {inviteInfo.department && (
                <div>
                  <span className="font-medium">초대받는 부서:</span>{" "}
                  {inviteInfo.department}
                </div>
              )}
              <div>
                <span className="font-medium">역할:</span>{" "}
                {inviteInfo.role === "admin" ? "관리자" : inviteInfo.role === "manager" ? "부서 관리자" : "일반 사용자"}
              </div>
            </div>
          </div>
        </div>

        {/* 이미 로그인된 사용자는 초대 수락 버튼, 로그인되지 않은 사용자는 이메일 가입 폼 */}
        {isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              초대 정보를 확인했습니다. 아래 정보를 확인한 후 "초대 수락" 버튼을 눌러 가입을 완료하세요.
            </p>
            
            {/* 현재 사용자 정보 표시 (선택적 수정) */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSigningUp(true);
                setMessage(null);

                const { data: sessionData } = await supabase.auth.getSession();
                const user = sessionData.session?.user;
                if (!user || !token) {
                  setMessage("로그인 상태를 확인할 수 없습니다.");
                  setSigningUp(false);
                  return;
                }

                const inviteResult = await getInviteByToken(token);
                if (!inviteResult.ok || !inviteResult.invite) {
                  setMessage(inviteResult.message ?? "초대 정보를 불러올 수 없습니다.");
                  setSigningUp(false);
                  return;
                }

                // Check if profile already exists
                const { data: existingProfile } = await supabase
                  .from("profiles")
                  .select("id,role,organization_id,name,department,phone")
                  .eq("id", user.id)
                  .maybeSingle();

                // If profile exists and already has organization_id, preserve existing role
                // Only update role if user is joining a new organization
                const finalRole = existingProfile?.organization_id 
                  ? existingProfile.role 
                  : inviteResult.invite.role;

                // Ensure organization_id is always set from invite
                const finalOrganizationId = inviteResult.invite.organization_id;

                if (!finalOrganizationId) {
                  setMessage("초대 정보에 기관 ID가 없습니다. 관리자에게 문의하세요.");
                  setSigningUp(false);
                  return;
                }

                // Create/update profile
                let profileError = null;
                
                // 이메일 값 결정 (우선순위: 사용자 입력 > 소셜 로그인 이메일 > 초대 이메일)
                // 이메일은 필수값이므로 반드시 값이 있어야 함
                const finalEmail = email || user.email || inviteResult.invite.email;
                
                if (!finalEmail) {
                  setMessage("이메일 정보가 없습니다. 이메일을 입력해주세요.");
                  setSigningUp(false);
                  return;
                }

                if (existingProfile) {
                  // Update existing profile
                  const { error: updateError } = await supabase
                    .from("profiles")
                    .update({
                      email: finalEmail,
                      organization_id: finalOrganizationId,
                      role: finalRole,
                      name: name || inviteResult.invite.name || existingProfile?.name || null,
                      department: department || inviteResult.invite.department || existingProfile?.department || null,
                      phone: phone || existingProfile?.phone || null,
                    })
                    .eq("id", user.id);
                  profileError = updateError;
                } else {
                  // Insert new profile
                  const { error: insertError } = await supabase
                    .from("profiles")
                    .insert({
                      id: user.id,
                      email: finalEmail,
                      organization_id: finalOrganizationId,
                      role: finalRole,
                      name: name || inviteResult.invite.name || null,
                      department: department || inviteResult.invite.department || null,
                      phone: phone || null,
                    });
                  profileError = insertError;
                }

                if (profileError) {
                  console.error("Profile update/insert error:", {
                    error: profileError,
                    code: profileError.code,
                    message: profileError.message,
                    details: profileError.details,
                    hint: profileError.hint,
                    user_id: user.id,
                    organization_id: finalOrganizationId,
                    existingProfile: !!existingProfile,
                  });
                  setMessage(
                    `프로필 ${existingProfile ? "업데이트" : "생성"} 실패: ${profileError.message || "알 수 없는 오류"}`
                  );
                  setSigningUp(false);
                  return;
                }

                // Verify the update was successful
                const { data: verifyProfile, error: verifyError } = await supabase
                  .from("profiles")
                  .select("id,organization_id,role")
                  .eq("id", user.id)
                  .maybeSingle();

                if (verifyError || !verifyProfile) {
                  console.error("Profile verification error:", verifyError);
                  setMessage("프로필은 생성되었지만 확인에 실패했습니다. 페이지를 새로고침해주세요.");
                  setSigningUp(false);
                  return;
                }

                if (verifyProfile.organization_id !== finalOrganizationId) {
                  console.error("Organization ID mismatch:", {
                    expected: finalOrganizationId,
                    actual: verifyProfile.organization_id,
                  });
                  setMessage("기관 ID가 올바르게 설정되지 않았습니다. 관리자에게 문의하세요.");
                  setSigningUp(false);
                  return;
                }

                // Mark invite as accepted
                const { error: acceptError } = await supabase
                  .from("organization_invites")
                  .update({ accepted_at: new Date().toISOString() })
                  .eq("token", token);

                if (acceptError) {
                  console.error("Failed to mark invite as accepted:", acceptError);
                  // 프로필은 생성되었지만 초대 상태 업데이트 실패
                  // 사용자에게 알림하되 가입은 완료된 것으로 처리
                  setMessage(
                    "가입은 완료되었지만 초대 상태 업데이트에 실패했습니다. 관리자에게 문의하세요."
                  );
                  setSigningUp(false);
                  return;
                }

                // Record audit log
                const { error: auditError } = await supabase.from("audit_logs").insert({
                  organization_id: inviteResult.invite.organization_id,
                  actor_id: user.id,
                  action: "invite_accepted",
                  target_type: "organization_invite",
                  target_id: inviteResult.invite.id,
                  metadata: {
                    email: (user.email ?? email) || inviteResult.invite.email,
                    role: inviteResult.invite.role,
                  },
                });

                if (auditError) {
                  console.error("Failed to record audit log:", auditError);
                  // 감사 로그 실패는 치명적이지 않으므로 계속 진행
                }

                // 세션 새로고침을 위해 잠시 대기
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 세션 새로고침
                await supabase.auth.refreshSession();
                
                // 페이지 리로드하여 프로필 정보 갱신
                window.location.href = "/";
              }}
              className="space-y-4"
            >
              <div className="space-y-2 text-sm">
                <label className="font-medium">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                  placeholder="예: user@example.com"
                  required
                />
                <p className="text-xs text-neutral-500">
                  초대 시 지정된 이메일: {inviteInfo.email || "없음"} (변경 가능)
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <label className="font-medium">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                  placeholder="예: 김철수"
                  required
                />
                {inviteInfo.name && (
                  <p className="text-xs text-neutral-500">
                    초대 시 지정된 이름: {inviteInfo.name}
                  </p>
                )}
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
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
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
                {inviteInfo.department && (
                  <p className="text-xs text-neutral-500">
                    초대 시 지정된 부서: {inviteInfo.department}
                  </p>
                )}
                <p className="text-xs text-neutral-500 mt-1">
                  역할: {inviteInfo.role === "admin" ? "관리자" : inviteInfo.role === "manager" ? "부서 관리자" : "일반 사용자"} (초대 시 지정됨)
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <label className="font-medium">연락처</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                  placeholder="010-0000-0000"
                />
              </div>

              <button
                type="submit"
                disabled={signingUp}
                className="btn-primary w-full"
              >
                {signingUp ? "처리 중..." : "초대 수락"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* 카카오 로그인 버튼 추가 */}
            <div className="space-y-3 pb-4 border-b border-neutral-100">
              <button
                type="button"
                onClick={handleKakaoSignIn}
                disabled={signingUp}
                className="flex w-full items-center justify-center gap-2 h-12 rounded-lg bg-[#FEE500] px-6 text-sm font-semibold text-black transition-all duration-200 hover:bg-[#FDD835] hover:shadow-md active:bg-[#FBC02D] active:shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 0C4.03 0 0 3.27 0 7.3c0 2.55 1.7 4.8 4.25 6.05L3 18l5.25-2.8c.5.05 1 .1 1.5.1 4.97 0 9-3.27 9-7.3S13.97 0 9 0z"
                    fill="currentColor"
                  />
                </svg>
                카카오톡으로 시작하기
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-neutral-500">또는 이메일로 가입</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <label className="font-medium">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                placeholder="예: user@example.com"
                required
              />
              <p className="text-xs text-neutral-500">
                초대 시 지정된 이메일: {inviteInfo.email || "없음"} (변경 가능)
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <label className="font-medium">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                placeholder="예: 김철수"
                required
              />
              {inviteInfo.name && (
                <p className="text-xs text-neutral-500">
                  초대 시 지정된 이름: {inviteInfo.name}
                </p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <label className="font-medium">소속 부서</label>
              {availableDepartments.length > 0 ? (
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                >
                  <option value="">부서 선택</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                  placeholder="예: 유년부"
                />
              )}
              {inviteInfo.department && (
                <p className="text-xs text-neutral-500">
                  초대 시 지정된 부서: {inviteInfo.department}
                </p>
              )}
              <p className="text-xs text-neutral-500 mt-1">
                역할: {inviteInfo.role === "admin" ? "관리자" : inviteInfo.role === "manager" ? "부서 관리자" : "일반 사용자"} (초대 시 지정됨)
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <label className="font-medium">연락처</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                placeholder="010-0000-0000"
              />
            </div>

            <button
              type="submit"
              disabled={signingUp}
              className="btn-primary w-full"
            >
              {signingUp ? "처리 중..." : "가입 링크 받기"}
            </button>
          </form>
        )}

        {message && (
          <p className="text-sm text-neutral-600" role="status">
            {message}
          </p>
        )}

        <p className="text-xs text-neutral-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
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
      <JoinPageContent />
    </Suspense>
  );
}
