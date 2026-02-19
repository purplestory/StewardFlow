"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { generateShortId } from "@/lib/short-id";

const DEFAULT_INVITE_EXPIRES_DAYS = 7;

const PENDING_JOIN_TOKEN_COOKIE = "pending_join_token";
const PENDING_JOIN_MAX_AGE = 60 * 10; // 10분

const normalizeInviteExpiresDays = (value: unknown) => {
  const numeric = Number(value ?? DEFAULT_INVITE_EXPIRES_DAYS);
  if (!Number.isFinite(numeric)) return DEFAULT_INVITE_EXPIRES_DAYS;
  if (numeric < 1) return 1;
  if (numeric > 30) return 30;
  return Math.floor(numeric);
};

const resolveInviteExpiresAt = (
  createdAt: string,
  expiresAt: string | null | undefined,
  fallbackDays: number
) => {
  if (expiresAt) {
    const parsedExpiresAt = new Date(expiresAt);
    if (!Number.isNaN(parsedExpiresAt.getTime())) {
      return parsedExpiresAt;
    }
  }

  const createdAtDate = new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) {
    return null;
  }
  createdAtDate.setDate(
    createdAtDate.getDate() + normalizeInviteExpiresDays(fallbackDays)
  );
  return createdAtDate;
};

async function getOrganizationInviteExpiresDays(
  supabaseClient: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdmin>,
  organizationId: string
) {
  try {
    const { data: organizationData, error: organizationError } = await supabaseClient
      .from("organizations")
      .select("invite_expires_days")
      .eq("id", organizationId)
      .maybeSingle();

    if (organizationError) {
      return DEFAULT_INVITE_EXPIRES_DAYS;
    }
    return normalizeInviteExpiresDays(organizationData?.invite_expires_days);
  } catch {
    return DEFAULT_INVITE_EXPIRES_DAYS;
  }
}

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
    
    // [변경됨] getSession -> getUser (더 안전한 인증 확인)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // 디버깅: 쿠키 확인
    if (process.env.NODE_ENV === "development") {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const authCookies = cookieStore.getAll().filter(c => c.name.includes('supabase') || c.name.includes('auth'));
      console.log("generateInviteToken: Auth cookies count:", authCookies.length);
    }
    
    if (userError || !user) {
      console.error("generateInviteToken: Auth error or no user", userError);
      return { ok: false, message: "로그인이 필요합니다. 페이지를 새로고침하고 다시 시도해주세요." };
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
    const token = generateShortId(10);

    const inviteExpiresDays = await getOrganizationInviteExpiresDays(
      supabase,
      organizationId
    );
    const expiresAt = new Date(
      Date.now() + inviteExpiresDays * 24 * 60 * 60 * 1000
    ).toISOString();

    let invite: { id: string } | null = null;
    let error: { message?: string; code?: string } | null = null;

    const withExpiresAt = await supabase
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        email: email || null,
        role,
        department: department || null,
        name: name || null,
        token,
        expires_at: expiresAt,
      })
      .select("id")
      .maybeSingle();

    invite = withExpiresAt.data;
    error = withExpiresAt.error;

    if (
      error &&
      (error.code === "42703" || error.message?.includes("expires_at"))
    ) {
      const withoutExpiresAt = await supabase
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

      invite = withoutExpiresAt.data;
      error = withoutExpiresAt.error;
    }

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
    expires_at?: string | null;
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

    let allInvites: {
      id: string;
      organization_id: string;
      email: string;
      role: string;
      department: string | null;
      name: string | null;
      created_at: string;
      expires_at: string | null;
      accepted_at: string | null;
      revoked_at: string | null;
    } | null = null;
    let searchError: { message?: string; code?: string } | null = null;

    const withExpiresAt = await supabase
      .from("organization_invites")
      .select("id,organization_id,email,role,department,name,created_at,expires_at,accepted_at,revoked_at")
      .eq("token", cleanToken)
      .maybeSingle();
    allInvites = withExpiresAt.data;
    searchError = withExpiresAt.error;

    if (
      searchError &&
      (searchError.code === "42703" || searchError.message?.includes("expires_at"))
    ) {
      const withoutExpiresAt = await supabase
        .from("organization_invites")
        .select("id,organization_id,email,role,department,name,created_at,accepted_at,revoked_at")
        .eq("token", cleanToken)
        .maybeSingle();
      allInvites = withoutExpiresAt.data
        ? { ...withoutExpiresAt.data, expires_at: null }
        : null;
      searchError = withoutExpiresAt.error;
    }

    if (searchError) {
      console.error("getInviteByToken error:", searchError);
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

    const inviteExpiresDays = await getOrganizationInviteExpiresDays(
      supabase,
      allInvites.organization_id
    );
    const inviteExpiresAt = resolveInviteExpiresAt(
      allInvites.created_at,
      allInvites.expires_at,
      inviteExpiresDays
    );

    if (inviteExpiresAt && inviteExpiresAt.getTime() < Date.now()) {
      return {
        ok: false,
        message: `초대 링크가 만료되었습니다. (유효기간: ${inviteExpiresDays}일) 관리자에게 새로운 초대를 요청하세요.`,
      };
    }

    // organization_id 확인 (필수)
    if (!allInvites.organization_id) {
      return { 
        ok: false, 
        message: "초대 정보에 기관 ID가 없습니다. 관리자에게 문의하세요." 
      };
    }

    // 기관 이름 조회
    let organizationName: string | undefined;
    try {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", allInvites.organization_id)
        .maybeSingle();
      
      if (orgData) {
        organizationName = orgData.name;
      }
    } catch (orgError) {
      console.error("Exception while fetching organization name:", orgError);
    }

    // 초대한 사람 정보 조회
    let inviterInfo: {
      name: string | null;
      department: string | null;
      organization_name: string | null;
    } | undefined;
    
    try {
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
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("name,department,organization_id")
          .eq("id", auditLog.actor_id)
          .maybeSingle();

        if (inviterProfile) {
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
      console.warn("Failed to fetch inviter info:", inviterError);
    }

    const invite = {
      id: allInvites.id,
      organization_id: allInvites.organization_id,
      email: allInvites.email,
      role: allInvites.role,
      department: allInvites.department,
      name: allInvites.name,
      created_at: allInvites.created_at,
      expires_at: allInvites.expires_at ?? null,
    };
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
 * 초대 수락
 */
export async function acceptInviteByToken(
  token: string,
  profileData: {
    email: string;
    name: string | null;
    department: string | null;
    phone: string | null;
    accessToken?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) {
      return { success: false, error: "초대 토큰이 없습니다." };
    }

    const supabaseServer = await createSupabaseServerClient();
    const supabaseAdmin = ensureAdminClient();

    // 1차: 서버 쿠키 기반 인증
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    let authenticatedUser = user;

    // 2차: 쿠키 세션이 없으면 access token으로 보조 인증 (인앱 브라우저 대응)
    if ((!authenticatedUser || userError) && profileData.accessToken && supabaseAdmin) {
      const { data: tokenUserData, error: tokenUserError } = await supabaseAdmin.auth.getUser(
        profileData.accessToken
      );
      if (!tokenUserError && tokenUserData.user) {
        authenticatedUser = tokenUserData.user;
      }
    }

    if (!authenticatedUser) {
      console.error("Auth Error (acceptInvite):", userError);
      return { success: false, error: "로그인이 필요합니다. (인증 세션 확인 실패)" };
    }

    // 1. 초대 정보 확인
    const inviteResult = await getInviteByToken(cleanToken);
    if (!inviteResult.ok || !inviteResult.invite) {
      return { success: false, error: inviteResult.message ?? "유효하지 않은 초대입니다." };
    }

    const invite = inviteResult.invite;
    const finalEmail = profileData.email || authenticatedUser.email || invite.email;
    if (!finalEmail) {
      return { success: false, error: "이메일이 필요합니다." };
    }

    if (!supabaseAdmin) {
      return {
        success: false,
        error: "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.",
      };
    }

    // 2. 기존 프로필 조회 (권한 결정을 위해 필요)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id,role,organization_id")
      .eq("id", authenticatedUser.id)
      .maybeSingle();

    // 기존에 조직이 있다면 기존 role 유지, 없다면 초대의 role 사용
    const finalRole = existingProfile?.organization_id
      ? existingProfile.role
      : invite.role;

    // 3. 프로필 Upsert (중복 에러 방지용)
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authenticatedUser.id,
        email: finalEmail,
        organization_id: invite.organization_id,
        role: finalRole,
        name: profileData.name || invite.name || null,
        department: profileData.department || invite.department || null,
        phone: profileData.phone || null,
      });

    if (upsertError) {
      return { success: false, error: `프로필 업데이트 실패: ${upsertError.message}` };
    }

    // 4. 초대 수락 처리
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
      actor_id: authenticatedUser.id,
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
