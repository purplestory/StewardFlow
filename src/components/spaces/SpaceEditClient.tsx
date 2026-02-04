"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Space } from "@/types/database";
import SpaceEditForm from "./SpaceEditForm";
import OrganizationGate from "@/components/settings/OrganizationGate";

export default function SpaceEditClient() {
  const params = useParams();
  const id = params.id as string;
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSpace = async () => {
      if (!id || typeof id !== "string") {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        // Check if id is UUID or short_id
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
          console.error("Error fetching space:", error);
          // If short_id lookup failed and it's not a UUID, try UUID as fallback
          if (!isUuid) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("spaces")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            
            if (!fallbackError && fallbackData) {
              if (isMounted) {
                setSpace(fallbackData as Space);
                setLoading(false);
              }
              return;
            }
          }
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        if (!data) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSpace(data as Space);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading space:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSpace();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
      </section>
    );
  }

  if (!space) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">공간 수정</h1>
      <p className="text-sm text-neutral-600">
        등록된 공간의 정보를 수정할 수 있습니다.
      </p>
      <OrganizationGate>
        <SpaceEditForm space={space} />
      </OrganizationGate>
    </section>
  );
}
