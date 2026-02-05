import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Vehicle } from "@/types/database";
import { useUserProfile } from "@/hooks/useAssets";

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Vehicles query error:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      console.log("Vehicles loaded:", {
        count: data?.length ?? 0,
        vehicles: data?.map(v => ({ id: v.id, name: v.name, organization_id: v.organization_id })),
      });
      
      return (data ?? []) as Vehicle[];
    },
    staleTime: 1000 * 60 * 2, // 2분간 fresh 상태 유지
  });
}

export function useVehicle(id: string | null) {
  return useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      if (!id) return null;

      const isUuid = isUUID(id);
      
      let query = supabase
        .from("vehicles")
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
            .from("vehicles")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          
          if (!fallbackError && fallbackData) {
            return fallbackData as Vehicle;
          }
        }
        throw error;
      }

      return (data ?? null) as Vehicle | null;
    },
    enabled: !!id, // id가 있을 때만 실행
    staleTime: 1000 * 60 * 2, // 2분간 fresh 상태 유지
  });
}

export function useVehicleReservations(vehicleId: string | null) {
  return useQuery({
    queryKey: ["vehicleReservations", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];

      const { listReservationsByVehicle } = await import("@/actions/booking-actions");
      return await listReservationsByVehicle(vehicleId);
    },
    enabled: !!vehicleId,
    staleTime: 1000 * 60 * 1, // 1분간 fresh 상태 유지
  });
}

export function useVehicleApprovalPolicies(orgId: string | null) {
  return useQuery({
    queryKey: ["approvalPolicies", orgId, "vehicle"],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from("approval_policies")
        .select("scope,department,required_role")
        .eq("organization_id", orgId)
        .eq("scope", "vehicle");

      if (error) throw error;
      return data;
    },
    enabled: !!orgId, // orgId가 있을 때만 실행
    staleTime: 1000 * 60 * 10, // 10분간 fresh 상태 유지
  });
}
