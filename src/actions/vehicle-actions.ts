"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isUUID } from "@/lib/short-id";
import type { Vehicle } from "@/types/database";

export async function listVehicles(): Promise<Vehicle[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Vehicle[];
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  try {
    if (!id) {
      console.log("getVehicleById: id is empty");
      return null;
    }

    const supabase = await createSupabaseServerClient();

    // Check if id is UUID or short_id
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
      console.error("Error fetching vehicle by id:", error);
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
      return null;
    }

    return (data ?? null) as Vehicle | null;
  } catch (error) {
    console.error("getVehicleById error:", error);
    return null;
  }
}
