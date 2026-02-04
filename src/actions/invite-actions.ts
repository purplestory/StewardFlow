"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateShortId } from "@/lib/short-id";

export async function generateInviteToken(
  organizationId: string,
  email: string | null,
  role: "admin" | "manager" | "user",
  department?: string | null,
  name?: string | null
): Promise<{ ok: boolean; token?: string; message?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    
    // getSession()을 사용하여 세션 확인
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // 디버깅: 쿠키 확인
    if (process.env.NODE_ENV === "development") {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const authCookies = cookieStore.getAll().filter(c => c.name.includes('supabase') || c.name.includes('auth'));
      console.log("generateInviteToken: Auth cookies count:", authCookies.length);
    }
    
    if (sessionError) {
      console.error("generateInviteToken: Session error:", sessionError);
      return { ok: false, message: `인증 오류: ${sessionError.message}` };
    }
    
    if (!sessionData.session) {
      console.error("generateInviteToken: No session found");
      return { ok: false, message: "로그인이 필요합니다. 페이지를 새로고침하고 다시 시도해주세요." };
    }
    
    const user = sessionData.session.user;
    if (!user) {
      console.error("generateInviteToken: No user in session");
      return { ok: false, message: "로그인이 필요합니다." };
    }
    
    console.log("generateInviteToken: User authenticated:", user.id);

    // 사용자 프로필 확인
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return { ok: false, message: `프로필 조회 실패: ${profileError.message}` };
    }

    if (!profile) {
      return { ok: false, message: "프로필을 찾을 수 없습니다." };
    }

    // organization_id 확인
    if (profile.organization_id !== organizationId) {
      return { ok: false, message: "기관 정보가 일치하지 않습니다." };
    }

    // 권한 확인 (manager 또는 admin)
    if (profile.role !== "admin" && profile.role !== "manager") {
      return { ok: false, message: "초대는 관리자 또는 부서 관리자만 가능합니다." };
    }

    // Generate short, URL-safe token (10 characters for good security and readability)
    // nanoid generates URL-safe tokens that are easy to share via SMS/KakaoTalk
    const token = generateShortId(10);

    const { data: invite, error } = await supabase
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        email: email || null,
        role,
        department: department || null,
        name: name || null,
        token,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!invite) {
      return { ok: false, message: "초대 생성에 실패했습니다." };
    }

    return { ok: true, token };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

export async function getInviteByToken(
  token: string
): Promise<{
  ok: boolean;
  invite?: {
    id: string;
    organization_id: string;
    email: string;
    role: string;
    department: string | null;
    name: string | null;
    created_at: string;
  };
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: invite, error } = await supabase
      .from("organization_invites")
      .select("id,organization_id,email,role,department,name,created_at")
      .eq("token", token)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!invite) {
      return { ok: false, message: "유효하지 않거나 만료된 초대 링크입니다." };
    }

    // Check if invite is expired (7 days)
    const createdAt = new Date(invite.created_at);
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (expiresAt.getTime() < Date.now()) {
      return { ok: false, message: "초대 링크가 만료되었습니다." };
    }

    return { ok: true, invite };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
