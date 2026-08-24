"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { generateShortId } from "@/lib/short-id";

const DEFAULT_INVITE_EXPIRES_DAYS = 7;
const INVITE_ROLES = ["admin", "manager", "user"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InviteRole = (typeof INVITE_ROLES)[number];

const isInviteRole = (role: string): role is InviteRole =>
  INVITE_ROLES.some((allowedRole) => allowedRole === role);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
    if (
      typeof organizationId !== "string" ||
      !UUID_PATTERN.test(organizationId) ||
      typeof role !== "string" ||
      !isInviteRole(role) ||
      (email !== null && typeof email !== "string") ||
      (department !== undefined && department !== null && typeof department !== "string") ||
      (name !== undefined && name !== null && typeof name !== "string")
    ) {
      return { ok: false, message: "올바르지 않은 초대 정보입니다." };
    }

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
    
    if (process.env.NODE_ENV === "development") {
      console.log("generateInviteToken: User authenticated:", user.id);
    }

    // 사용자 프로필 확인
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role, department")
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

    if (profile.role === "manager" && role === "admin") {
      return { ok: false, message: "부서 관리자는 관리자 역할로 초대할 수 없습니다." };
    }

    const normalizedEmail = email?.trim() ? normalizeEmail(email) : null;
    const normalizedDepartment = department?.trim() || null;
    const normalizedName = name?.trim() || null;

    if (normalizedEmail && normalizedEmail.length > 254) {
      return { ok: false, message: "이메일 주소가 너무 깁니다." };
    }

    if (
      profile.role === "manager" &&
      (!profile.department || normalizedDepartment !== profile.department)
    ) {
      return {
        ok: false,
        message: "부서 관리자는 자신의 담당 부서로만 초대할 수 있습니다.",
      };
    }

    if (normalizedDepartment) {
      const { data: targetDepartment, error: targetDepartmentError } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", normalizedDepartment)
        .maybeSingle();

      if (targetDepartmentError || !targetDepartment) {
        if (targetDepartmentError) {
          console.error("Invite department lookup failed:", targetDepartmentError);
        }
        return { ok: false, message: "초대할 부서를 확인할 수 없습니다." };
      }
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
        email: normalizedEmail,
        role,
        department: normalizedDepartment,
        name: normalizedName,
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
          email: normalizedEmail,
          role,
          department: normalizedDepartment,
          name: normalizedName,
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

    const { error: auditError } = await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: user.id,
      action: "invite_created",
      target_type: "invite",
      target_id: invite.id,
      metadata: {
        email: normalizedEmail,
        role,
        department: normalizedDepartment,
        name: normalizedName,
      },
    });

    if (auditError) {
      console.error("Invite creation audit log failed:", auditError);
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
        message: "현재 초대 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    let allInvites: {
      id: string;
      organization_id: string;
      email: string | null;
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
      // Keep the public DTO compatible with existing callers while accurately
      // representing the nullable database column in the row type above.
      email: allInvites.email ?? "",
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

    const authenticatedEmail = authenticatedUser.email?.trim();
    if (!authenticatedEmail) {
      return {
        success: false,
        error: "인증 계정의 이메일을 확인할 수 없습니다.",
      };
    }

    // 1. 초대 정보 확인
    const inviteResult = await getInviteByToken(cleanToken);
    if (!inviteResult.ok || !inviteResult.invite) {
      return { success: false, error: inviteResult.message ?? "유효하지 않은 초대입니다." };
    }

    const invite = inviteResult.invite;
    const inviteEmail = invite.email.trim();
    if (
      inviteEmail &&
      normalizeEmail(inviteEmail) !== normalizeEmail(authenticatedEmail)
    ) {
      return {
        success: false,
        error: "이 초대는 현재 로그인한 계정의 이메일과 일치하지 않습니다.",
      };
    }

    if (!isInviteRole(invite.role)) {
      return {
        success: false,
        error: "초대에 허용되지 않은 권한이 지정되어 있습니다.",
      };
    }

    if (!supabaseAdmin) {
      return {
        success: false,
        error: "현재 초대 가입을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.",
      };
    }

    // 2. 기존 프로필 조회 (권한 결정을 위해 필요)
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id,role,organization_id,department")
      .eq("id", authenticatedUser.id)
      .maybeSingle();

    if (existingProfileError) {
      return {
        success: false,
        error: `기존 프로필 확인 실패: ${existingProfileError.message}`,
      };
    }

    if (existingProfile?.organization_id) {
      return {
        success: false,
        error: "이미 소속 기관이 있는 계정은 초대 토큰으로 기관이나 권한을 변경할 수 없습니다.",
      };
    }

    // Claim the invite before granting profile membership. The guarded update
    // makes concurrent/replayed acceptance fail without changing privileges.
    const acceptedAt = new Date().toISOString();
    let claimInviteQuery = supabaseAdmin
      .from("organization_invites")
      .update({ accepted_at: acceptedAt })
      .eq("token", cleanToken)
      .eq("id", invite.id)
      .eq("organization_id", invite.organization_id)
      .eq("role", invite.role)
      .is("accepted_at", null)
      .is("revoked_at", null);

    claimInviteQuery =
      invite.department === null
        ? claimInviteQuery.is("department", null)
        : claimInviteQuery.eq("department", invite.department);

    if (invite.expires_at) {
      claimInviteQuery = claimInviteQuery.gt("expires_at", acceptedAt);
    }

    const { data: acceptedInvite, error: acceptError } = await claimInviteQuery
      .select("id")
      .maybeSingle();

    if (acceptError) {
      return { success: false, error: `초대 수락 처리 실패: ${acceptError.message}` };
    }

    if (!acceptedInvite) {
      return {
        success: false,
        error: "초대가 이미 사용되었거나 취소되었습니다. 새로운 초대를 요청해주세요.",
      };
    }

    const releaseClaimedInvite = async () => {
      const { error: releaseError } = await supabaseAdmin
        .from("organization_invites")
        .update({ accepted_at: null })
        .eq("token", cleanToken)
        .eq("id", invite.id)
        .eq("accepted_at", acceptedAt)
        .is("revoked_at", null);

      if (releaseError) {
        console.error("Failed to release claimed invite:", releaseError);
      }
    };

    const profileValues = {
      email: authenticatedEmail,
      organization_id: invite.organization_id,
      role: invite.role,
      name: profileData.name || invite.name || null,
      department: invite.department,
      phone: profileData.phone || null,
    };

    // A conditional update prevents two concurrently accepted invites from
    // moving the same previously-unassigned profile between organizations.
    const profileMutation = existingProfile
      ? await supabaseAdmin
          .from("profiles")
          .update(profileValues)
          .eq("id", authenticatedUser.id)
          .is("organization_id", null)
          .select("id")
          .maybeSingle()
      : await supabaseAdmin
          .from("profiles")
          .insert({ id: authenticatedUser.id, ...profileValues })
          .select("id")
          .maybeSingle();

    if (profileMutation.error) {
      await releaseClaimedInvite();
      return {
        success: false,
        error: `프로필 업데이트 실패: ${profileMutation.error.message}`,
      };
    }

    if (!profileMutation.data) {
      await releaseClaimedInvite();
      return {
        success: false,
        error: "다른 초대가 먼저 처리되어 현재 계정의 소속을 변경할 수 없습니다.",
      };
    }

    // 5. 감사 로그
    await supabaseAdmin.from("audit_logs").insert({
      organization_id: invite.organization_id,
      actor_id: authenticatedUser.id,
      action: "invite_accepted",
      target_type: "organization_invite",
      target_id: invite.id,
      metadata: { email: authenticatedEmail, role: invite.role },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
