"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { generateShortId } from "@/lib/short-id";

// 초대 링크 유효기간 (일)
const INVITE_EXPIRES_DAYS = 7;

const PENDING_JOIN_TOKEN_COOKIE = "pending_join_token";
const PENDING_JOIN_MAX_AGE = 60 * 10; // 10분

/** 카카오 OAuth 리다이렉트 전에 초대 토큰을 httpOnly 쿠키에 저장 (브라우저 컨텍스트 변경 시에도 복원 가능) */
export async function setPendingJoinTokenCookie(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(PENDING_JOIN_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PENDING_JOIN_MAX_AGE,
      path: "/",
    });
    return { ok: true };
  } catch (e) {
    console.error("setPendingJoinTokenCookie:", e);
    return { ok: false, error: e instanceof Error ? e.message : "쿠키 설정 실패" };
  }
}

/** OAuth 콜백/join 페이지에서 저장된 초대 토큰 조회 후 쿠키 삭제 */
export async function getAndClearPendingJoinTokenCookie(): Promise<{ token: string | null; error?: string }> {
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(PENDING_JOIN_TOKEN_COOKIE)?.value ?? null;
    if (value) {
      cookieStore.delete(PENDING_JOIN_TOKEN_COOKIE);
    }
    return { token: value };
  } catch (e) {
    console.error("getAndClearPendingJoinTokenCookie:", e);
    return { token: null, error: e instanceof Error ? e.message : "쿠키 조회 실패" };
  }
}

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

function ensureAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set. Check Vercel environment variables.");
    return null;
  }
  return createSupabaseAdmin();
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
    const cleanToken = String(token || "").trim();
    if (!cleanToken) {
      return { ok: false, message: "초대 토큰이 없습니다." };
    }

    const supabase = ensureAdminClient();
    if (!supabase) {
      return {
        ok: false,
        message: "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.",
      };
    }

    const { data: allInvites, error: searchError } = await supabase
      .from("organization_invites")
      .select("id,organization_id,email,role,department,name,created_at,accepted_at,revoked_at")
      .eq("token", cleanToken)
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

    // 기관 이름 조회 (Admin 클라이언트로 조회하여 RLS 문제 해결)
    let organizationName: string | undefined;
    try {
      console.log("Fetching organization name for ID:", allInvites.organization_id);
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
        console.log("Organization name fetched:", orgData.name);
        organizationName = orgData.name;
      } else {
        console.warn("Organization not found for ID:", allInvites.organization_id);
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
      // audit_logs에서 초대를 생성한 사람 찾기 (Admin 클라이언트로 조회)
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

/**
 * 초대 수락 - Admin 클라이언트 사용하여 RLS 우회
 * organization_invites_update_accept 정책은 email 일치만 허용하므로,
 * 카카오 이메일·초대 시 지정 이메일 불일치·이메일 null 초대 시 실패함.
 */
export async function acceptInviteByToken(
  token: string,
  profileData: {
    email: string;
    name: string | null;
    department: string | null;
    phone: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) {
      return { success: false, error: "초대 토큰이 없습니다." };
    }

    const supabaseServer = await createSupabaseServerClient();
    const { data: sessionData } = await supabaseServer.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 1. 초대 정보 확인
    const inviteResult = await getInviteByToken(cleanToken);
    if (!inviteResult.ok || !inviteResult.invite) {
      return { success: false, error: inviteResult.message ?? "유효하지 않은 초대입니다." };
    }

    const invite = inviteResult.invite;
    const finalEmail = profileData.email || user.email || invite.email;
    if (!finalEmail) {
      return { success: false, error: "이메일이 필요합니다." };
    }

    const supabaseAdmin = ensureAdminClient();
    if (!supabaseAdmin) {
      return {
        success: false,
        error: "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.",
      };
    }

    // 2. 기존 프로필 조회 (권한 결정을 위해 필요)
    // 기존에 조직이 있는 경우 역할을 유지할지, 초대의 역할을 따를지 결정
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id,role,organization_id")
      .eq("id", user.id)
      .maybeSingle();

    // 기존에 조직이 있다면 기존 role 유지, 없다면 초대의 role 사용
    const finalRole = existingProfile?.organization_id
      ? existingProfile.role
      : invite.role;

    // 3. 프로필 Upsert (핵심 수정 부분)
    // Insert와 Update를 분기하지 않고, ID가 같으면 덮어쓰도록 처리하여 에러 방지
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: user.id, // Primary Key (충돌 시 update로 전환됨)
        email: finalEmail,
        organization_id: invite.organization_id,
        role: finalRole,
        name: profileData.name || invite.name || null,
        department: profileData.department || invite.department || null,
        phone: profileData.phone || null,
        updated_at: new Date().toISOString(), // 수정일 갱신
      });

    if (upsertError) {
      return { success: false, error: `프로필 업데이트 실패: ${upsertError.message}` };
    }

    // 4. 초대 수락 처리 (완료)
    const { error: acceptError } = await supabaseAdmin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("token", cleanToken);

    if (acceptError) {
      return { success: false, error: `초대 수락 처리 실패: ${acceptError.message}` };
    }

    // 5. 감사 로그
    await supabaseAdmin.from("audit_logs").insert({
      organization_id: invite.organization_id,
      actor_id: user.id,
      action: "invite_accepted",
      target_type: "organization_invite",
      target_id: invite.id,
      metadata: { email: finalEmail, role: invite.role },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
