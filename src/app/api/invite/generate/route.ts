import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateShortId } from "@/lib/short-id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, email, role, department, name } = body;

    if (!organizationId || !role) {
      return NextResponse.json(
        { ok: false, message: "필수 정보가 누락되었습니다." },
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

    // Check session - try getUser() first as it's more reliable in API routes
    let user = null;
    const { data: { user: userData }, error: userError } = await supabase.auth.getUser();
    
    if (!userError && userData) {
      user = userData;
    } else {
      // Fallback to getSession()
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && sessionData.session?.user) {
        user = sessionData.session.user;
      }
    }

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
      .select("organization_id, role")
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

    // Generate token
    const token = generateShortId(10);

    // Create invite
    const { data: invite, error: inviteError } = await supabase
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
