"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  phone: string | null;
  role: string | null;
};

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      // Wait a bit for session to be fully established after OAuth callback
      await new Promise((resolve) => setTimeout(resolve, 300));

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!isMounted) return;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id,email,name,department,phone,role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch error:", error);
        if (isMounted) {
          setMessage(`프로필 조회 오류: ${error.message}`);
          setLoading(false);
        }
        return;
      }

      if (profileData) {
        if (isMounted) {
          setProfile(profileData as Profile);
          setLoading(false);
        }
        return;
      }

      // Profile doesn't exist, try to create it
      const userEmail = user.email || user.user_metadata?.email || "";
      const userName = user.user_metadata?.name || user.user_metadata?.full_name || null;

      console.log("Creating profile for user:", user.id, { email: userEmail, name: userName });

      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: userEmail,
          name: userName,
        })
        .select("id,email,name,department,phone,role")
        .single();

      if (insertError) {
        console.error("Profile insert error:", insertError);
        if (isMounted) {
          setMessage(`프로필 생성 오류: ${insertError.message}. 새로고침해주세요.`);
          // Try to fetch again after a delay (maybe AuthCard created it)
          setTimeout(async () => {
            if (!isMounted) return;
            const { data: retryData } = await supabase
              .from("profiles")
              .select("id,email,name,department,phone,role")
              .eq("id", user.id)
              .maybeSingle();
            if (isMounted && retryData) {
              setProfile(retryData as Profile);
              setLoading(false);
            } else if (isMounted) {
              setLoading(false);
            }
          }, 2000);
        }
      } else if (newProfile && isMounted) {
        setProfile(newProfile as Profile);
        setLoading(false);
      } else if (isMounted) {
        setLoading(false);
      }
    };

    loadProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        loadProfile();
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user || !profile) {
      setMessage("로그인 후 프로필 정보를 수정할 수 있습니다.");
      setSaving(false);
      return;
    }

    // Get form element - try multiple methods
    const formElement = 
      (event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null) ||
      (event.target instanceof HTMLFormElement ? event.target : null) ||
      (event.target instanceof HTMLElement ? (event.target as HTMLElement).closest('form') : null);
    
    if (!(formElement instanceof HTMLFormElement)) {
      console.error("Could not find form element:", { 
        currentTarget: event.currentTarget, 
        target: event.target,
        targetType: event.target?.constructor?.name 
      });
      setMessage("폼 제출 중 오류가 발생했습니다.");
      setSaving(false);
      return;
    }

    const formData = new FormData(formElement);
    const updates = {
      name: formData.get("name")?.toString() || null,
      department: formData.get("department")?.toString() || null,
      phone: formData.get("phone")?.toString() || null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setProfile({ ...profile, ...updates });
      setMessage("프로필이 저장되었습니다.");
    }

    setSaving(false);
  };

  if (loading) {
    return <p className="text-sm text-neutral-500">프로필 정보를 불러오는 중...</p>;
  }

  if (!profile) {
    return (
      <p className="text-sm text-neutral-500">
        로그인 후 프로필 정보를 확인할 수 있습니다.
      </p>
    );
  }

  const roleLabel: Record<string, string> = {
    admin: "관리자",
    manager: "부서 관리자",
    user: "일반 사용자",
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="form-label">이메일</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="form-input bg-neutral-50 text-neutral-600"
          />
          <p className="text-xs text-neutral-500">이메일은 변경할 수 없습니다.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="form-label">역할</label>
          <input
            type="text"
            value={roleLabel[profile.role || "user"] || profile.role || "일반 사용자"}
            disabled
            className="form-input bg-neutral-50 text-neutral-600"
          />
          <p className="text-xs text-neutral-500">역할은 관리자가 변경할 수 있습니다.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="form-label">
            이름
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={profile.name || ""}
            className="form-input"
            placeholder="예: 김철수"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="department" className="form-label">
            소속 부서
          </label>
          <input
            id="department"
            name="department"
            type="text"
            defaultValue={profile.department || ""}
            className="form-input"
            placeholder="예: 유년부"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="phone" className="form-label">
            연락처
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone || ""}
            className="form-input"
            placeholder="010-0000-0000"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full"
        >
          {saving ? "저장 중..." : "프로필 저장"}
        </button>
      </div>

      {message && (
        <p className="text-sm text-neutral-600" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
