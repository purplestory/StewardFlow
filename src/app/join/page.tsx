"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getInviteByToken } from "@/actions/invite-actions";
import Link from "next/link";

export default function JoinPage() {
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
  } | null>(null);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setIsAuthenticated(!!sessionData.session?.user);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const loadInvite = async () => {
      const result = await getInviteByToken(token);
      if (!result.ok || !result.invite) {
        setMessage(result.message ?? "초대 정보를 불러올 수 없습니다.");
        setLoading(false);
        return;
      }

      // Get organization name and departments
      const [orgResult, deptResult] = await Promise.all([
        supabase
          .from("organizations")
          .select("name")
          .eq("id", result.invite.organization_id)
          .maybeSingle(),
        supabase
          .from("departments")
          .select("name")
          .eq("organization_id", result.invite.organization_id)
          .order("name", { ascending: true }),
      ]);

      if (deptResult.data) {
        setAvailableDepartments(deptResult.data.map((d) => d.name));
      }

      setInviteInfo({
        email: result.invite.email,
        organization_name: orgResult.data?.name ?? "기관",
        role: result.invite.role,
        department: result.invite.department || null,
        name: result.invite.name || null,
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

    // Get organization name and departments
    const [orgResult, deptResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("name")
        .eq("id", result.invite.organization_id)
        .maybeSingle(),
      supabase
        .from("departments")
        .select("name")
        .eq("organization_id", result.invite.organization_id)
        .order("name", { ascending: true }),
    ]);

    if (deptResult.data) {
      setAvailableDepartments(deptResult.data.map((d) => d.name));
    }

    setInviteInfo({
      email: result.invite.email,
      organization_name: orgResult.data?.name ?? "기관",
      role: result.invite.role,
      department: result.invite.department || null,
      name: result.invite.name || null,
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

    // Send magic link
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: inviteResult.invite.email,
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

  useEffect(() => {
    // Check if user is already authenticated after email click
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (user && token) {
        // User clicked email link, now complete signup
        const inviteResult = await getInviteByToken(token);
        if (inviteResult.ok && inviteResult.invite) {
          // Create/update profile
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: user.id,
              email: user.email ?? inviteResult.invite.email,
              organization_id: inviteResult.invite.organization_id,
              role: inviteResult.invite.role,
              name: name || null,
              department: department || null,
              phone: phone || null,
            });

          if (profileError) {
            setMessage(profileError.message);
            return;
          }

          // Mark invite as accepted
          await supabase
            .from("organization_invites")
            .update({ accepted_at: new Date().toISOString() })
            .eq("token", token);

          // Record audit log
          await supabase.from("audit_logs").insert({
            organization_id: inviteResult.invite.organization_id,
            actor_id: user.id,
            action: "invite_accepted",
            target_type: "organization_invite",
            target_id: inviteResult.invite.id,
            metadata: {
              email: inviteResult.invite.email,
              role: inviteResult.invite.role,
            },
          });

          router.push("/");
        }
      }
    };

    checkAuth();
  }, [token, name, department, phone, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">초대 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 토큰이 없고 이미 로그인된 사용자인 경우: 토큰 입력 UI 표시
  if (!token && isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white p-8">
          <div>
            <h1 className="text-2xl font-semibold">초대 토큰 입력</h1>
            <p className="mt-2 text-sm text-neutral-600">
              관리자가 보낸 초대 링크의 토큰을 입력해주세요.
            </p>
          </div>

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
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
            <p className="text-sm text-rose-600">{message}</p>
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setToken("");
                  setMessage(null);
                  setInviteInfo(null);
                }}
                className="mt-4 inline-block text-sm text-neutral-600 underline"
              >
                다시 입력하기
              </button>
            ) : (
              <Link
                href="/login"
                className="mt-4 inline-block text-sm text-neutral-600 underline"
              >
                로그인 페이지로 이동
              </Link>
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
          <h1 className="text-2xl font-semibold">가입하기</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {inviteInfo.organization_name}에 초대되었습니다.
          </p>
        </div>

        {/* 이미 로그인된 사용자는 프로필 생성 폼, 로그인되지 않은 사용자는 이메일 가입 폼 */}
        {isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              초대 정보를 확인했습니다. 아래 정보를 확인하고 수정한 후 가입을 완료하세요.
            </p>
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

                // Create/update profile
                const { error: profileError } = await supabase
                  .from("profiles")
                  .upsert({
                    id: user.id,
                    email: (user.email ?? email) || inviteResult.invite.email,
                    organization_id: inviteResult.invite.organization_id,
                    role: inviteResult.invite.role,
                    name: name || inviteResult.invite.name || null,
                    department: department || inviteResult.invite.department || null,
                    phone: phone || null,
                  });

                if (profileError) {
                  setMessage(profileError.message);
                  setSigningUp(false);
                  return;
                }

                // Mark invite as accepted
                await supabase
                  .from("organization_invites")
                  .update({ accepted_at: new Date().toISOString() })
                  .eq("token", token);

                // Record audit log
                await supabase.from("audit_logs").insert({
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

                router.push("/");
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
                {signingUp ? "처리 중..." : "가입 완료"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
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
