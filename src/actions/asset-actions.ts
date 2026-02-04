"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isUUID } from "@/lib/short-id";
import type { Asset } from "@/types/database";

export async function createAsset() {
  throw new Error("Not implemented");
}

export async function listAssets(): Promise<Asset[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Asset[];
}

export async function deleteAsset(id: string, permanent: boolean = false, reason?: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Try getSession first, then getUser as fallback
    let user = null;
    let userError = null;
    
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      // If getSession fails, try getUser
      const getUserResult = await supabase.auth.getUser();
      user = getUserResult.data.user;
      userError = getUserResult.error;
    } else {
      user = sessionData.session.user;
    }
    
    if (userError) {
      console.error("deleteAsset: Auth error:", {
        sessionError: sessionError?.message,
        userError: userError?.message,
        hasSession: !!sessionData.session,
      });
      throw new Error(`인증 오류: ${userError.message || sessionError?.message || "세션을 가져올 수 없습니다"}`);
    }
    
    if (!user) {
      console.error("deleteAsset: No user found", {
        hasSession: !!sessionData.session,
        sessionError: sessionError?.message,
      });
      throw new Error("인증이 필요합니다. 로그인 후 다시 시도해주세요.");
    }
    
    console.log("deleteAsset: User authenticated:", user.id);
  
  // Get user role
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role, organization_id, department")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    throw new Error("사용자 정보를 가져올 수 없습니다.");
  }

  // Get asset to check ownership
  const isUuid = isUUID(id);
  let assetQuery = supabase.from("assets").select("id, organization_id, owner_scope, owner_department").eq("deleted_at", null);
  
  if (isUuid) {
    assetQuery = assetQuery.eq("id", id);
  } else {
    assetQuery = assetQuery.eq("short_id", id);
  }
  
  const { data: assetData, error: assetError } = await assetQuery.maybeSingle();
  
  if (assetError || !assetData) {
    throw new Error("물품을 찾을 수 없습니다.");
  }

  // Check permissions
  const isAdmin = profileData.role === "admin";
  const isManager = profileData.role === "manager" || isAdmin;
  const isOwner = assetData.owner_scope === "organization" 
    ? assetData.organization_id === profileData.organization_id
    : assetData.owner_department === profileData.department;

  if (!isManager && !isOwner) {
    throw new Error("삭제 권한이 없습니다.");
  }

  // Permanent delete only for admins
  if (permanent) {
    if (!isAdmin) {
      throw new Error("영구 삭제는 최고 관리자만 가능합니다.");
    }
    const { error: deleteError } = await supabase
      .from("assets")
      .delete()
      .eq("id", assetData.id);
    
    if (deleteError) {
      throw new Error(`삭제 실패: ${deleteError.message}`);
    }
  } else {
    // Soft delete
    const { error: updateError } = await supabase
      .from("assets")
      .update({ 
        deleted_at: new Date().toISOString(),
        deletion_reason: reason || null
      })
      .eq("id", assetData.id);
    
    if (updateError) {
      throw new Error(`삭제 실패: ${updateError.message}`);
    }
  }
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      console.error("deleteAsset: Error:", error.message, error.stack);
      throw error;
    }
    throw new Error(`삭제 실패: ${String(error)}`);
  }
}

export async function listUnusedAssets(): Promise<Asset[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .not("deleted_at", "is", null)
    .eq("deletion_reason", "불용품")
    .in("status", ["available", "retired"])
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Asset[];
}

export async function listDeletedAssets(): Promise<Asset[]> {
  const supabase = await createSupabaseServerClient();
  
  // Check session using getUser() which is more reliable in server actions
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("인증이 필요합니다.");
  }
  
  // Get user role - only admins can see deleted assets
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData || profileData.role !== "admin") {
    throw new Error("최고 관리자만 삭제된 자원을 볼 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Asset[];
}

export async function restoreAsset(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  
  // Check session using getUser() which is more reliable in server actions
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("인증이 필요합니다.");
  }
  
  // Get user role - only admins can restore
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData || profileData.role !== "admin") {
    throw new Error("최고 관리자만 자원을 복원할 수 있습니다.");
  }

  const isUuid = isUUID(id);
  let assetQuery = supabase.from("assets").select("id").not("deleted_at", "is", null);
  
  if (isUuid) {
    assetQuery = assetQuery.eq("id", id);
  } else {
    assetQuery = assetQuery.eq("short_id", id);
  }
  
  const { data: assetData, error: assetError } = await assetQuery.maybeSingle();
  
  if (assetError || !assetData) {
    throw new Error("삭제된 자원을 찾을 수 없습니다.");
  }

  const { error: updateError } = await supabase
    .from("assets")
    .update({ deleted_at: null })
    .eq("id", assetData.id);
  
  if (updateError) {
    throw new Error(`복원 실패: ${updateError.message}`);
  }
}

export async function getAssetById(id: string): Promise<Asset | null> {
  try {
    if (!id) {
      console.log("getAssetById: id is empty");
      return null;
    }

    const supabase = await createSupabaseServerClient();

    // Check session using getUser() which is more reliable in server actions
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log(`getAssetById: user check - hasUser: ${!!user}, userId: ${user?.id}, userError: ${userError?.message || 'none'}`);

    // Check if id is UUID or short_id
    const isUuid = isUUID(id);
    console.log(`getAssetById: id=${id}, isUuid=${isUuid}`);
    
    let query = supabase
      .from("assets")
      .select("*");
    
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      // Try short_id first, if not found, try as UUID (for backward compatibility)
      query = query.eq("short_id", id);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching asset by id:", {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // If short_id lookup failed and it's not a UUID, try UUID as fallback
      if (!isUuid) {
        console.log("Trying UUID fallback for:", id);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("assets")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        
        if (!fallbackError && fallbackData) {
          console.log("Found asset via UUID fallback");
          return fallbackData as Asset;
        }
        if (fallbackError) {
          console.error("UUID fallback error:", fallbackError);
        }
      }
      console.log("getAssetById: no asset found due to error");
      return null;
    }

    if (data) {
      console.log(`getAssetById: found asset ${data.name} (id: ${data.id}, short_id: ${data.short_id}, org_id: ${data.organization_id})`);
    } else {
      console.log("getAssetById: no data returned (query succeeded but no rows)");
      // Check if this is an RLS issue by trying to count
      const { count, error: countError } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true });
      console.log("Total assets count:", count, "countError:", countError);
    }

    return (data ?? null) as Asset | null;
  } catch (error) {
    console.error("getAssetById error:", error);
    return null;
  }
}
