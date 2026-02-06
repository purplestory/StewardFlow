"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * 사용자 계정을 완전히 삭제합니다 (auth.users와 profiles 모두 삭제)
 * @param userId 삭제할 사용자 ID
 * @returns 성공 여부와 에러 메시지
 */
export async function deleteUserAccount(userId: string) {
  try {
    // 환경 변수 확인 (함수 내부에서만 접근)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl) {
      return {
        success: false,
        error: "서버 설정 오류: NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다.",
      };
    }

    if (!serviceRoleKey) {
      return {
        success: false,
        error: "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다. Vercel 환경 변수 설정을 확인하세요.",
      };
    }

    // 서버 사이드에서만 사용할 수 있는 Supabase 클라이언트 생성
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. 먼저 profiles 삭제 (RLS 정책 때문에 먼저 삭제)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("Profile deletion error:", profileError);
      return {
        success: false,
        error: `프로필 삭제 실패: ${profileError.message}`,
      };
    }

    // 2. auth.users 삭제 (서비스 롤 키가 필요)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth user deletion error:", authError);
      return {
        success: false,
        error: `인증 사용자 삭제 실패: ${authError.message}`,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error: any) {
    console.error("Unexpected error in deleteUserAccount:", error);
    return {
      success: false,
      error: `예상치 못한 오류: ${error.message || "알 수 없는 오류"}`,
    };
  }
}
