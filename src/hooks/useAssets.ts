import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Asset, Reservation } from "@/types/database";

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Assets query error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

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

export function useAsset(id: string | null) {
  return useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      if (!id) return null;

      const isUuid = isUUID(id);
      
      let query = supabase
        .from("assets")
        .select("*")
        .is("deleted_at", null);
      
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
            .from("assets")
            .select("*")
            .is("deleted_at", null)
            .eq("id", id)
            .maybeSingle();
          
          if (!fallbackError && fallbackData) {
            return fallbackData as Asset;
          }
        }
        throw error;
      }

      return (data ?? null) as Asset | null;
    },
    enabled: !!id, // id가 있을 때만 실행
    staleTime: 1000 * 60 * 2, // 2분간 fresh 상태 유지
  });
}

export function useAssetReservations(assetId: string | null) {
  return useQuery({
    queryKey: ["assetReservations", assetId],
    queryFn: async () => {
      if (!assetId) return [];

      type BorrowerProfile = {
        id: string;
        name: string | null;
        department: string | null;
      };
      type ReservationWithBorrowerRow = {
        id: string;
        status: Reservation["status"];
        start_date: string;
        end_date: string;
        borrower_id: string;
        note: string | null;
        profiles: BorrowerProfile | BorrowerProfile[] | null;
      };

      const { data, error } = await supabase
        .from("reservations")
        .select("id,status,start_date,end_date,borrower_id,note,profiles!borrower_id(id,name,department)")
        .eq("asset_id", assetId)
        .order("start_date", { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as ReservationWithBorrowerRow[]).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          borrower_id: row.borrower_id,
          note: row.note,
          borrower: profile
            ? {
                id: profile.id,
                name: profile.name,
                department: profile.department,
              }
            : null,
        };
      });
    },
    enabled: !!assetId,
    staleTime: 1000 * 60 * 1, // 1분간 fresh 상태 유지
  });
}

export function useUserRole() {
  return useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      
      if (!user) return null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,department")
        .eq("id", user.id)
        .maybeSingle();

      return {
        role: profileData?.role as "admin" | "manager" | "user" | null,
        department: profileData?.department ?? null,
      };
    },
    staleTime: 1000 * 60 * 5, // 5분간 fresh 상태 유지
  });
}
