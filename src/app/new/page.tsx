"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AssetForm from "@/components/assets/AssetForm";
import SpaceForm from "@/components/spaces/SpaceForm";
import VehicleForm from "@/components/vehicles/VehicleForm";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
};

type OrganizationMenuLabels = {
  equipment?: string;
  spaces?: string;
  vehicles?: string;
};

export default function NewItemPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get("category");
  
  const [category, setCategory] = useState<"equipment" | "spaces" | "vehicles" | null>(
    categoryParam === "equipment" || categoryParam === "spaces" || categoryParam === "vehicles"
      ? categoryParam
      : null
  );
  const [features, setFeatures] = useState<OrganizationFeatures>({
    equipment: true,
    spaces: true,
    vehicles: false,
  });
  const [menuLabels, setMenuLabels] = useState<OrganizationMenuLabels>({
    equipment: "물품",
    spaces: "공간",
    vehicles: "차량",
  });
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      
      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      const orgId = profileData?.organization_id ?? null;
      setOrganizationId(orgId);

      if (orgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("features,menu_labels")
          .eq("id", orgId)
          .maybeSingle();

        if (orgData) {
          if (orgData.features) {
            setFeatures({
              equipment: orgData.features.equipment ?? true,
              spaces: orgData.features.spaces ?? true,
              vehicles: orgData.features.vehicles ?? false,
            });
          }
          if (orgData.menu_labels) {
            setMenuLabels({
              equipment: orgData.menu_labels.equipment ?? "물품",
              spaces: orgData.menu_labels.spaces ?? "공간",
              vehicles: orgData.menu_labels.vehicles ?? "차량",
            });
          }
        }
      }

      setLoading(false);
    };

    loadSettings();
  }, []);

  // URL 파라미터가 변경되면 카테고리 업데이트
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat === "equipment" || cat === "spaces" || cat === "vehicles") {
      setCategory(cat);
    }
  }, [searchParams]);

  const handleCategorySelect = (selectedCategory: "equipment" | "spaces" | "vehicles") => {
    setCategory(selectedCategory);
    router.push(`/new?category=${selectedCategory}`);
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <Notice>설정을 불러오는 중입니다...</Notice>
      </section>
    );
  }

  if (!organizationId) {
    return (
      <section className="space-y-6">
        <Notice variant="warning" className="text-left">
          기관 설정이 필요합니다. 기관 설정에서 생성해주세요.
        </Notice>
      </section>
    );
  }

  // 카테고리 선택 화면
  if (!category) {
    const availableCategories: Array<{
      key: "equipment" | "spaces" | "vehicles";
      label: string;
      description: string;
    }> = [];

    if (features.equipment !== false) {
      availableCategories.push({
        key: "equipment",
        label: menuLabels.equipment || "물품",
        description: "음향, 영상, 조리도구 등의 물품을 등록합니다.",
      });
    }

    if (features.spaces !== false) {
      availableCategories.push({
        key: "spaces",
        label: menuLabels.spaces || "공간",
        description: "회의실, 교육실, 체육관 등의 공간을 등록합니다.",
      });
    }

    if (features.vehicles === true) {
      availableCategories.push({
        key: "vehicles",
        label: menuLabels.vehicles || "차량",
        description: "승용차, 승합차 등의 차량을 등록합니다.",
      });
    }

    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">등록</h1>
          <p className="mt-2 text-sm text-neutral-600">
            등록할 항목의 카테고리를 선택해주세요.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableCategories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategorySelect(cat.key)}
              className="rounded-xl border border-neutral-200 bg-white p-6 text-left hover:border-black hover:shadow-md transition-all"
            >
              <h3 className="text-lg font-semibold mb-2">{cat.label}</h3>
              <p className="text-sm text-neutral-600">{cat.description}</p>
            </button>
          ))}
        </div>

      </section>
    );
  }

  // 카테고리별 폼 표시
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setCategory(null);
            router.push("/new");
          }}
          className="text-lg text-neutral-500 hover:text-black"
        >
          &lt;
        </button>
        <div>
          <h1 className="text-2xl font-semibold">
            {category === "equipment" && (menuLabels.equipment || "물품")}
            {category === "spaces" && (menuLabels.spaces || "공간")}
            {category === "vehicles" && (menuLabels.vehicles || "차량")} 등록
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {category === "equipment" && "모바일에서 사진을 촬영해 바로 등록할 수 있도록 설계합니다."}
            {category === "spaces" && "회의실/교육실/체육관 등의 공간을 등록합니다."}
            {category === "vehicles" && "승용차, 승합차 등의 차량을 등록합니다."}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        {category === "equipment" && <AssetForm />}
        {category === "spaces" && <SpaceForm />}
        {category === "vehicles" && <VehicleForm />}
      </div>
    </section>
  );
}
