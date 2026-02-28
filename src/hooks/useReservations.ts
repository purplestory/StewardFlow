import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type ReservationStatus = "pending" | "approved" | "returned" | "rejected";
export type ReservationResourceType = "asset" | "space" | "vehicle";

export type UserReservationItem = {
  id: string;
  status: ReservationStatus;
  start_date: string;
  end_date: string;
  note: string | null;
  resource_type: ReservationResourceType;
  resource_name: string;
  created_at: string;
};

type AssetReservationQueryRow = {
  id: string;
  status: ReservationStatus;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  assets: { name: string } | Array<{ name: string }> | null;
};

type SpaceReservationQueryRow = {
  id: string;
  status: ReservationStatus;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  spaces: { name: string } | Array<{ name: string }> | null;
};

type VehicleReservationQueryRow = {
  id: string;
  status: ReservationStatus;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  vehicles: { name: string } | Array<{ name: string }> | null;
};

export function useUserReservations() {
  return useQuery({
    queryKey: ["userReservations"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) return [];

      const [assetResult, spaceResult, vehicleResult] = await Promise.all([
        supabase
          .from("reservations")
          .select("id,status,start_date,end_date,note,created_at,assets(name)")
          .eq("borrower_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("space_reservations")
          .select("id,status,start_date,end_date,note,created_at,spaces(name)")
          .eq("borrower_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("vehicle_reservations")
          .select("id,status,start_date,end_date,note,created_at,vehicles(name)")
          .eq("borrower_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (assetResult.error) throw assetResult.error;
      if (spaceResult.error) throw spaceResult.error;
      if (vehicleResult.error) throw vehicleResult.error;

      const assets = ((assetResult.data ?? []) as AssetReservationQueryRow[]).map((row) => {
        const asset = Array.isArray(row.assets) ? row.assets[0] : row.assets;
        return {
          id: row.id,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          note: row.note,
          created_at: row.created_at,
          resource_type: "asset" as const,
          resource_name: asset?.name?.trim() || "물품",
        };
      });

      const spaces = ((spaceResult.data ?? []) as SpaceReservationQueryRow[]).map((row) => {
        const space = Array.isArray(row.spaces) ? row.spaces[0] : row.spaces;
        return {
          id: row.id,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          note: row.note,
          created_at: row.created_at,
          resource_type: "space" as const,
          resource_name: space?.name?.trim() || "공간",
        };
      });

      const vehicles = ((vehicleResult.data ?? []) as VehicleReservationQueryRow[]).map((row) => {
        const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
        return {
          id: row.id,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
          note: row.note,
          created_at: row.created_at,
          resource_type: "vehicle" as const,
          resource_name: vehicle?.name?.trim() || "차량",
        };
      });

      return [...assets, ...spaces, ...vehicles].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) as UserReservationItem[];
    },
    staleTime: 1000 * 60 * 1, // 1분간 fresh 상태 유지
  });
}
