import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateShortId } from "@/lib/short-id";

const INVITE_ROLES = ["admin", "manager", "user"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, message: "올바르지 않은 요청입니다." },
        { status: 400 }
      );
    }

    const { organizationId, email, role, department, name } = body;

    if (
      typeof organizationId !== "string" ||
      !UUID_PATTERN.test(organizationId) ||
      typeof role !== "string" ||
      !INVITE_ROLES.some((allowedRole) => allowedRole === role) ||
      (email != null && typeof email !== "string") ||
      (department != null && typeof department !== "string") ||
      (name != null && typeof name !== "string")
    ) {
      return NextResponse.json(
        { ok: false, message: "올바르지 않은 초대 정보입니다." },
        { status: 400 }
      );
    }

    // Create Supabase client with cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie setting errors in API routes
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("API /invite/generate: No user found", {
        userError: userError?.message,
      });
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // Check user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role, department")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { ok: false, message: `프로필 조회 실패: ${profileError.message}` },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { ok: false, message: "프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Verify organization_id
    if (profile.organization_id !== organizationId) {
      return NextResponse.json(
        { ok: false, message: "기관 정보가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    // Check permissions (manager or admin)
    if (profile.role !== "admin" && profile.role !== "manager") {
      return NextResponse.json(
        { ok: false, message: "초대는 관리자 또는 부서 관리자만 가능합니다." },
        { status: 403 }
      );
    }

    if (profile.role === "manager" && role === "admin") {
      return NextResponse.json(
        { ok: false, message: "부서 관리자는 관리자 역할로 초대할 수 없습니다." },
        { status: 403 }
      );
    }

    const normalizedEmail = email?.trim().toLowerCase() || null;
    const normalizedDepartment = department?.trim() || null;
    const normalizedName = name?.trim() || null;

    if (normalizedEmail && normalizedEmail.length > 254) {
      return NextResponse.json(
        { ok: false, message: "이메일 주소가 너무 깁니다." },
        { status: 400 }
      );
    }

    if (
      profile.role === "manager" &&
      (!profile.department || normalizedDepartment !== profile.department)
    ) {
      return NextResponse.json(
        { ok: false, message: "부서 관리자는 자신의 담당 부서로만 초대할 수 있습니다." },
        { status: 403 }
      );
    }

    if (normalizedDepartment) {
      const { data: targetDepartment, error: targetDepartmentError } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("name", normalizedDepartment)
        .maybeSingle();

      if (targetDepartmentError || !targetDepartment) {
        return NextResponse.json(
          { ok: false, message: "초대할 부서를 확인할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    // Generate token
    const token = generateShortId(10);
    let inviteExpiresDays = 7;

    try {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("invite_expires_days")
        .eq("id", organizationId)
        .maybeSingle();
      const numeric = Number(orgData?.invite_expires_days ?? 7);
      if (Number.isFinite(numeric)) {
        inviteExpiresDays = Math.min(30, Math.max(1, Math.floor(numeric)));
      }
    } catch {
      inviteExpiresDays = 7;
    }
    const expiresAt = new Date(
      Date.now() + inviteExpiresDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // Create invite
    let invite: { id: string } | null = null;
    let inviteError: { message?: string; code?: string } | null = null;

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
    inviteError = withExpiresAt.error;

    if (
      inviteError &&
      (inviteError.code === "42703" || inviteError.message?.includes("expires_at"))
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
      inviteError = withoutExpiresAt.error;
    }

    if (inviteError) {
      return NextResponse.json(
        { ok: false, message: inviteError.message },
        { status: 500 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        { ok: false, message: "초대 생성에 실패했습니다." },
        { status: 500 }
      );
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
      console.error("Invite generation audit log failed:", auditError);
    }

    return NextResponse.json({
      ok: true,
      token,
    });
  } catch (error) {
    console.error("Error generating invite token:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
