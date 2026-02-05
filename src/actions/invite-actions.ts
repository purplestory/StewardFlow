"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateShortId } from "@/lib/short-id";

// 초대 링크 유효기간 (일)
const INVITE_EXPIRES_DAYS = 7;

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
    organization_name?: string;
    email: string;
    role: string;
    department: string | null;
    name: string | null;
    created_at: string;
    inviter?: {
      name: string | null;
      department: string | null;
      organization_name: string | null;
    };
  };
  message?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 먼저 토큰으로 초대를 찾기 (상태 무관)
    // RLS 정책이 anon 사용자도 허용하도록 설정되어 있어야 함
    const { data: allInvites, error: searchError } = await supabase
      .from("organization_invites")
      .select("id,organization_id,email,role,department,name,created_at,accepted_at,revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (searchError) {
      console.error("getInviteByToken error:", searchError);
      // RLS 정책 오류인 경우 더 명확한 메시지 제공
      if (searchError.code === "42501" || searchError.message?.includes("row-level security")) {
        return { 
          ok: false, 
          message: "초대 링크 확인 중 권한 오류가 발생했습니다. 관리자에게 문의하세요. (RLS 정책 확인 필요)" 
        };
      }
      return { ok: false, message: `초대 링크 확인 중 오류가 발생했습니다: ${searchError.message}` };
    }

    if (!allInvites) {
      return { ok: false, message: "유효하지 않은 초대 링크입니다. 토큰을 확인해주세요." };
    }

    // 이미 수락된 초대인지 확인
    if (allInvites.accepted_at) {
      return { ok: false, message: "이미 사용된 초대 링크입니다. 관리자에게 새로운 초대를 요청하세요." };
    }

    // 취소된 초대인지 확인
    if (allInvites.revoked_at) {
      return { ok: false, message: "취소된 초대 링크입니다. 관리자에게 새로운 초대를 요청하세요." };
    }

    // 만료 확인
    const createdAt = new Date(allInvites.created_at);
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS);

    if (expiresAt.getTime() < Date.now()) {
      return { ok: false, message: `초대 링크가 만료되었습니다. (유효기간: ${INVITE_EXPIRES_DAYS}일) 관리자에게 새로운 초대를 요청하세요.` };
    }

    // organization_id 확인 (필수)
    if (!allInvites.organization_id) {
      return { 
        ok: false, 
        message: "초대 정보에 기관 ID가 없습니다. 관리자에게 문의하세요." 
      };
    }

    // 기관 이름 조회 (서버 액션에서 조회하여 클라이언트에서 RLS 문제 방지)
    let organizationName: string | undefined;
    try {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", allInvites.organization_id)
        .maybeSingle();
      
      if (orgError) {
        console.error("Failed to fetch organization name:", {
          error: orgError,
          code: orgError.code,
          message: orgError.message,
          details: orgError.details,
          hint: orgError.hint,
          organization_id: allInvites.organization_id,
        });
        // 기관 이름 조회 실패해도 초대 정보는 반환 (organization_id는 있음)
      } else if (orgData) {
        organizationName = orgData.name;
      } else {
        console.warn("Organization not found:", allInvites.organization_id);
      }
    } catch (orgError) {
      // 기관 이름 조회 실패해도 초대 정보는 반환
      console.error("Exception while fetching organization name:", orgError);
    }

    // 초대한 사람 정보 조회 (audit_logs에서 찾기)
    let inviterInfo: {
      name: string | null;
      department: string | null;
      organization_name: string | null;
    } | undefined;
    
    try {
      // audit_logs에서 초대를 생성한 사람 찾기
      const { data: auditLog } = await supabase
        .from("audit_logs")
        .select("actor_id")
        .eq("action", "invite_created")
        .eq("target_type", "invite")
        .eq("target_id", allInvites.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (auditLog?.actor_id) {
        // 초대한 사람의 프로필 정보 가져오기
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("name,department,organization_id")
          .eq("id", auditLog.actor_id)
          .maybeSingle();

        if (inviterProfile) {
          // 초대한 사람의 기관 이름 가져오기
          let inviterOrgName: string | null = null;
          if (inviterProfile.organization_id) {
            const { data: inviterOrg } = await supabase
              .from("organizations")
              .select("name")
              .eq("id", inviterProfile.organization_id)
              .maybeSingle();
            inviterOrgName = inviterOrg?.name ?? null;
          }

          inviterInfo = {
            name: inviterProfile.name,
            department: inviterProfile.department,
            organization_name: inviterOrgName,
          };
        }
      }
    } catch (inviterError) {
      // 초대한 사람 정보 조회 실패해도 초대 정보는 반환
      console.warn("Failed to fetch inviter info:", inviterError);
    }

    // 유효한 초대 반환
    const { accepted_at, revoked_at, ...invite } = allInvites;
    return { 
      ok: true, 
      invite: { 
        ...invite, 
        organization_name: organizationName,
        inviter: inviterInfo,
      } 
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
