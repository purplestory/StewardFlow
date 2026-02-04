"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Server-side Supabase client that uses cookies for session
const getSupabaseServer = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase client credentials not configured");
  }
  
  const cookieStore = await cookies();
  
  // Get the session cookie
  const accessToken = cookieStore.get('sb-access-token')?.value;
  const refreshToken = cookieStore.get('sb-refresh-token')?.value;
  
  // Create client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  
  // If we have tokens, set the session
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
  
  return supabase;
};

export async function createOrganization(name: string): Promise<{
  ok: boolean;
  organizationId?: string;
  message?: string;
}> {
  try {
    // Use server-side Supabase with cookie-based session
    const supabase = await getSupabaseServer();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        ok: false,
        message: "인증되지 않은 사용자입니다. 로그인해주세요.",
      };
    }
    
    // Try to insert using client-side Supabase (respects RLS)
    // If this fails, we know it's an RLS issue
    const { data: orgData, error: insertError } = await supabase
      .from("organizations")
      .insert({ name })
      .select("id,name")
      .single();
    
    if (insertError) {
      console.error("Organization insert error:", insertError);
      return {
        ok: false,
        message: insertError.message || "기관 생성에 실패했습니다.",
      };
    }
    
    if (!orgData) {
      return {
        ok: false,
        message: "기관 생성에 실패했습니다.",
      };
    }
    
    // Update user's profile with organization_id
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        organization_id: orgData.id,
        role: "admin",
      })
      .eq("id", user.id);
    
    if (profileError) {
      console.error("Profile update error:", profileError);
      // Organization was created, but profile update failed
      // This is not critical, user can retry
      return {
        ok: true,
        organizationId: orgData.id,
        message: "기관은 생성되었지만 프로필 업데이트에 실패했습니다. 새로고침해주세요.",
      };
    }
    
    return {
      ok: true,
      organizationId: orgData.id,
    };
  } catch (error) {
    console.error("Create organization error:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
