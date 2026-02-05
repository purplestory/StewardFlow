import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type ReservationRow = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  note: string | null;
  assets: { name: string } | null;
};

export function useUserReservations() {
  return useQuery({
    queryKey: ["userReservations"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) return [];

      const { data, error } = await supabase
        .from("reservations")
        .select("id,status,start_date,end_date,note,assets(name)")
        .eq("borrower_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalizedData = (data ?? []).map((row: any) => {
        const asset = Array.isArray(row.assets) ? row.assets[0] : row.assets;
        return {
          ...row,
          assets: asset || null,
        };
      });

      return normalizedData as ReservationRow[];
    },
    staleTime: 1000 * 60 * 1, // 1분간 fresh 상태 유지
  });
}
