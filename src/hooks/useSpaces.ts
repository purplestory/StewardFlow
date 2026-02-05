import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Space } from "@/types/database";
import { useUserProfile } from "@/hooks/useAssets";

export function useSpaces() {
  return useQuery({
    queryKey: ["spaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Space[];
    },
    staleTime: 1000 * 60 * 2, // 2분간 fresh 상태 유지
  });
}

export function useSpace(id: string | null) {
  return useQuery({
    queryKey: ["space", id],
    queryFn: async () => {
      if (!id) return null;

      const isUuid = isUUID(id);
      
      let query = supabase
        .from("spaces")
        .select("*");
      
      if (isUuid) {
        query = query.eq("id", id);
      } else {
        query = query.eq("short_id", id);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) {
        // If short_id lookup failed and it's not a UUID, try UUID as fallback
        if (!isUuid) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("spaces")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          
          if (!fallbackError && fallbackData) {
            return fallbackData as Space;
          }
        }
        throw error;
      }

      return (data ?? null) as Space | null;
    },
    enabled: !!id, // id가 있을 때만 실행
    staleTime: 1000 * 60 * 2, // 2분간 fresh 상태 유지
  });
}

export function useSpaceReservations(spaceId: string | null) {
  return useQuery({
    queryKey: ["spaceReservations", spaceId],
    queryFn: async () => {
      if (!spaceId) return [];

      const { listReservationsBySpace } = await import("@/actions/booking-actions");
      return await listReservationsBySpace(spaceId);
    },
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 1, // 1분간 fresh 상태 유지
  });
}

export function useSpaceApprovalPolicies(orgId: string | null) {
  return useQuery({
    queryKey: ["approvalPolicies", orgId, "space"],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from("approval_policies")
        .select("scope,department,required_role")
        .eq("organization_id", orgId)
        .eq("scope", "space");

      if (error) throw error;
      return data;
    },
    enabled: !!orgId, // orgId가 있을 때만 실행
    staleTime: 1000 * 60 * 10, // 10분간 fresh 상태 유지
  });
}
