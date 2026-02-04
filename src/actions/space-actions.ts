"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isUUID } from "@/lib/short-id";
import type { Space } from "@/types/database";

export async function listSpaces(): Promise<Space[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Space[];
}

export async function getSpaceById(id: string): Promise<Space | null> {
  try {
    if (!id) {
      console.log("getSpaceById: id is empty");
      return null;
    }

    const supabase = await createSupabaseServerClient();

    // Check session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log(`getSpaceById: session check - hasSession: ${!!sessionData.session}, userId: ${sessionData.session?.user?.id}, sessionError: ${sessionError?.message || 'none'}`);

    // Check if id is UUID or short_id
    const isUuid = isUUID(id);
    console.log(`getSpaceById: id=${id}, isUuid=${isUuid}`);
    
    let query = supabase
      .from("spaces")
      .select("*");
    
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      // Try short_id first, if not found, try as UUID (for backward compatibility)
      query = query.eq("short_id", id);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching space by id:", error);
      // If short_id lookup failed and it's not a UUID, try UUID as fallback
      if (!isUuid) {
        console.log("Trying UUID fallback for:", id);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("spaces")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        
        if (!fallbackError && fallbackData) {
          console.log("Found space via UUID fallback");
          return fallbackData as Space;
        }
      }
      console.log("getSpaceById: no space found");
      return null;
    }

    if (data) {
      console.log(`getSpaceById: found space ${data.name} (id: ${data.id}, short_id: ${data.short_id})`);
    } else {
      console.log("getSpaceById: no data returned");
    }

    return (data ?? null) as Space | null;
  } catch (error) {
    console.error("getSpaceById error:", error);
    return null;
  }
}
