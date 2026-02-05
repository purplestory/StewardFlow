import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Asset } from "@/types/database";

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Asset[];
    },
    staleTime: 1000 * 60 * 2, // 2분간 fresh 상태 유지
  });
}

export function useUserProfile() {
  return useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) return null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      return {
        user,
        profile: profileData,
        orgId: profileData?.organization_id ?? null,
        isManager:
          profileData?.role === "admin" || profileData?.role === "manager",
      };
    },
    staleTime: 1000 * 60 * 5, // 5분간 fresh 상태 유지
  });
}

export function useApprovalPolicies(orgId: string | null) {
  return useQuery({
    queryKey: ["approvalPolicies", orgId, "asset"],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from("approval_policies")
        .select("scope,department,required_role")
        .eq("organization_id", orgId)
        .eq("scope", "asset");

      if (error) throw error;
      return data;
    },
    enabled: !!orgId, // orgId가 있을 때만 실행
    staleTime: 1000 * 60 * 10, // 10분간 fresh 상태 유지
  });
}
