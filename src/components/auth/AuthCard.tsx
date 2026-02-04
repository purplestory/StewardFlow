"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrigin } from "@/lib/utils";

type AuthState = {
  userId: string | null;
  email: string | null;
};

type Profile = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  phone: string | null;
};

export default function AuthCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AuthState>({
    userId: null,
    email: null,
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        // getUser()를 사용하여 더 안정적으로 세션 확인
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;
        
        // 세션이 없거나 에러가 있으면 상태 초기화
        if (userError || !user) {
          if (!isMounted) return;
          const { data: sessionData } = await supabase.auth.getSession();
          if (!isMounted) return;
          
          const sessionUser = sessionData.session?.user ?? null;
          setStatus({ userId: sessionUser?.id ?? null, email: sessionUser?.email ?? null });
          if (!sessionUser) {
            setProfile(null);
            setProfileLoading(false);
            return;
          }
          // getUser() 실패했지만 세션이 있으면 세션 사용
          setStatus({ userId: sessionUser.id, email: sessionUser.email ?? null });
        } else {
          setStatus({ userId: user.id, email: user.email ?? null });
        }
        
        if (!isMounted) return;
        const currentUser = user ?? (await supabase.auth.getSession()).data.session?.user ?? null;
        if (!isMounted) return;
        
        if (!currentUser) {
          setProfile(null);
          setProfileLoading(false);
          return;
        }

        setProfileLoading(true);
        if (!isMounted) return;
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("id,email,name,department,phone,organization_id")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error("Profile fetch error:", error);
          if (!isMounted) return;
          setMessage(error.message);
          setProfileLoading(false);
          return;
        }

        if (!isMounted) return;

        if (!profileData) {
        // 폐쇄형 서비스: 초대 링크가 있는 경우에만 가입 가능
        const userEmail = currentUser.email || currentUser.user_metadata?.email || "";
        
        // 초대 링크 확인 (이메일이 일치하거나 이메일이 null인 초대)
        let invite = null;
        if (userEmail) {
          // 이메일이 있는 경우: 이메일로 초대 찾기
          const { data: inviteByEmail } = await supabase
            .from("organization_invites")
            .select("id,organization_id,role,accepted_at,created_at,email")
            .eq("email", userEmail)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .order("created_at", { ascending: false })
            .maybeSingle();
          invite = inviteByEmail;
        }
        
        // 이메일로 찾지 못했거나 이메일이 없는 경우: 초대 토큰 입력 페이지로 리다이렉트
        if (!invite) {
          setMessage("가입하려면 관리자가 보낸 초대 링크가 필요합니다. 초대 토큰을 입력해주세요.");
          setProfileLoading(false);
          // 초대 토큰 입력 페이지로 리다이렉트 (로그인 상태 유지)
          router.push("/join");
          return;
        }

        // 초대가 만료되었는지 확인
        if (isInviteExpired(invite.created_at)) {
          await supabase
            .from("organization_invites")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", invite.id);
          setMessage("초대 링크가 만료되었습니다. 관리자에게 새로운 초대를 요청하세요.");
          await supabase.auth.signOut();
          setProfileLoading(false);
          return;
        }

        if (!isMounted) return;

        // 초대가 있으면 프로필 생성
        const userName = currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || null;

        const { error: insertError } = await supabase.from("profiles").insert({
          id: currentUser.id,
          email: userEmail,
          name: userName,
          organization_id: invite.organization_id,
          role: invite.role ?? "user",
        });

        if (!isMounted) return;

        if (insertError) {
          console.error("Profile insert error:", insertError);
          setMessage(insertError.message);
          setProfileLoading(false);
          return;
        }

        // 초대 수락 처리
        await supabase
          .from("organization_invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invite.id);

        if (!isMounted) return;

        await supabase.from("audit_logs").insert({
          organization_id: invite.organization_id,
          actor_id: currentUser.id,
          action: "invite_accepted",
          target_type: "organization_invite",
          target_id: invite.id,
          metadata: { email: userEmail, role: invite.role },
        });

        setProfile({
          id: currentUser.id,
          email: userEmail,
          name: userName,
          department: null,
          phone: null,
        });
        setProfileLoading(false);
        return;
      }

        setProfile(profileData as Profile);
        
        // If user has no organization, they can create one (first admin)
        if (!profileData.organization_id) {
          // Don't auto-create, let user do it manually
        } else if (currentUser) {
          await acceptInvitation(currentUser.id, currentUser.email ?? "");
        }
        
        setProfileLoading(false);
      } catch (error) {
        // AbortError는 무시 (컴포넌트 언마운트 시 발생)
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
          return;
        }
        
        // 컴포넌트가 언마운트된 경우 에러 표시하지 않음
        if (!isMounted) {
          return;
        }
        
        console.error("Session sync error:", error);
        setMessage(error instanceof Error ? error.message : "세션 동기화 중 오류가 발생했습니다.");
        setProfileLoading(false);
      }
    };

    syncSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      syncSession();
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const origin = getOrigin();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("로그인 링크를 이메일로 보냈습니다. 이메일을 확인해주세요.");
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  const handleKakaoSignIn = async () => {
    setMessage(null);
    setLoading(true);

    try {
      const origin = getOrigin();
      console.log("Starting Kakao login, origin:", origin);
      
      // OAuth URL 생성
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${origin}/auth/callback?next=/`,
        },
      });

      if (error) {
        console.error("Kakao login error:", error);
        setMessage(`로그인 오류: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data?.url) {
        console.log("Redirecting to Kakao:", data.url);
        // iframe 대신 직접 리다이렉트 (카카오톡 로그인은 iframe에서 작동하지 않음)
        window.location.href = data.url;
      } else {
        console.error("No OAuth URL returned");
        setMessage("로그인 URL을 생성할 수 없습니다.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Kakao login exception:", error);
      setMessage(error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const acceptInvitation = async (userId: string, email: string) => {
    if (!email) return;

    const { data: invite } = await supabase
      .from("organization_invites")
      .select("id,organization_id,role,accepted_at,created_at")
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (!invite?.organization_id) {
      return;
    }

    if (isInviteExpired(invite.created_at)) {
      await supabase
        .from("organization_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", invite.id);
      setMessage("초대가 만료되었습니다.");
      return;
    }

    await supabase
      .from("profiles")
      .update({
        organization_id: invite.organization_id,
        role: invite.role ?? "user",
      })
      .eq("id", userId);

    await supabase
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    await supabase.from("audit_logs").insert({
      organization_id: invite.organization_id,
      actor_id: userId,
      action: "invite_accepted",
      target_type: "organization_invite",
      target_id: invite.id,
      metadata: { email, role: invite.role },
    });
  };

  const handleProfileUpdate = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setMessage(null);

    if (!status.userId || !profile) {
      setMessage("로그인 후 프로필 정보를 수정할 수 있습니다.");
      return;
    }

    // Ensure event.currentTarget is a form element
    if (!(event.currentTarget instanceof HTMLFormElement)) {
      console.error("Invalid form element:", event.currentTarget);
      setMessage("폼 제출 중 오류가 발생했습니다.");
      return;
    }

    setProfileLoading(true);
    const formData = new FormData(event.currentTarget);
    const nextProfile = {
      name: formData.get("name")?.toString() || null,
      department: formData.get("department")?.toString() || null,
      phone: formData.get("phone")?.toString() || null,
    };

    // 변경사항이 있는지 확인
    const hasChanges = 
      nextProfile.name !== profile.name ||
      nextProfile.department !== profile.department ||
      nextProfile.phone !== profile.phone;

    if (!hasChanges) {
      setMessage("변경된 내용이 없습니다.");
      setProfileLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update(nextProfile)
      .eq("id", status.userId);

    if (error) {
      setMessage(error.message);
    } else {
      setProfile({ ...profile, ...nextProfile });
      setMessage("프로필이 저장되었습니다.");
    }

    setProfileLoading(false);
  };

  // 프로필이 완전히 저장되어 있는지 확인 (모든 필수 필드가 있으면 저장 버튼 숨김)
  const isProfileComplete = profile && 
    profile.name && 
    profile.department && 
    profile.phone;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleKakaoSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 h-12 rounded-lg bg-[#FEE500] px-6 text-sm font-semibold text-black transition-all duration-200 hover:bg-[#FDD835] hover:shadow-md active:bg-[#FBC02D] active:shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#FEE500] disabled:hover:shadow-none"
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
          카카오톡으로 로그인
        </button>
      </div>

        {status.userId && profile && (
          <form onSubmit={handleProfileUpdate} className="mt-6 space-y-3">
          <div className="text-sm font-medium">프로필</div>
          <label className="flex flex-col gap-2">
            <span className="form-label">담당자 이름</span>
            <input
              name="name"
              className="form-input"
              defaultValue={profile.name ?? ""}
              placeholder="예: 김철수"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">소속 부서</span>
            <input
              name="department"
              className="form-input"
              defaultValue={profile.department ?? ""}
              placeholder="예: 유년부"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">연락처</span>
            <input
              name="phone"
              className="form-input"
              defaultValue={profile.phone ?? ""}
              placeholder="010-0000-0000"
            />
          </label>
          {/* 프로필이 완전히 저장되어 있으면 저장 버튼 숨김 */}
          {!isProfileComplete && (
            <button
              type="submit"
              disabled={profileLoading}
              className="btn-primary w-full"
            >
              프로필 저장
            </button>
          )}
          {isProfileComplete && (
            <p className="text-xs text-neutral-500 text-center">
              프로필이 저장되어 있습니다. 정보를 수정하면 저장 버튼이 표시됩니다.
            </p>
          )}
          </form>
        )}

      {message && (
        <p className="mt-3 text-sm text-neutral-600" role="status">
          {message}
        </p>
      )}

    </div>
  );
}

const INVITE_EXPIRES_DAYS = 7;

const isInviteExpired = (value: string) => {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }
  createdAt.setDate(createdAt.getDate() + INVITE_EXPIRES_DAYS);
  return createdAt.getTime() < Date.now();
};
