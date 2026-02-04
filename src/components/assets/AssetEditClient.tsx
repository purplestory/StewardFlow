"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Asset } from "@/types/database";
import AssetEditForm from "./AssetEditForm";
import OrganizationGate from "@/components/settings/OrganizationGate";

export default function AssetEditClient() {
  const params = useParams();
  const id = params.id as string;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAsset = async () => {
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
          .from("assets")
          .select("*");
        
        if (isUuid) {
          query = query.eq("id", id);
        } else {
          query = query.eq("short_id", id);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Error fetching asset:", error);
          // If short_id lookup failed and it's not a UUID, try UUID as fallback
          if (!isUuid) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("assets")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            
            if (!fallbackError && fallbackData) {
              if (isMounted) {
                setAsset(fallbackData as Asset);
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
          setAsset(data as Asset);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading asset:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAsset();

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

  if (!asset) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">물품 수정</h1>
      <p className="text-sm text-neutral-600">
        등록된 물품의 정보를 수정할 수 있습니다.
      </p>
      <OrganizationGate>
        <AssetEditForm asset={asset} />
      </OrganizationGate>
    </section>
  );
}
