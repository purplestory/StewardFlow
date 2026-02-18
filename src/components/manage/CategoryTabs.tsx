"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

type CategoryTab = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
};

export default function CategoryTabs() {
  const pathname = usePathname();
  const [features, setFeatures] = useState<OrganizationFeatures | null>(null);
  const [menuLabels, setMenuLabels] = useState<OrganizationMenuLabels | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganizationData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("features,menu_labels")
          .eq("id", profileData.organization_id)
          .maybeSingle();

        if (orgData) {
          setFeatures({
            equipment: orgData.features?.equipment ?? true,
            spaces: orgData.features?.spaces ?? true,
            vehicles: orgData.features?.vehicles ?? false,
          });
          setMenuLabels({
            equipment: orgData.menu_labels?.equipment ?? "물품",
            spaces: orgData.menu_labels?.spaces ?? "공간",
            vehicles: orgData.menu_labels?.vehicles ?? "차량",
          });
        }
      }

      setLoading(false);
    };

    loadOrganizationData();
  }, []);

  if (loading || !features || !menuLabels) {
    return null;
  }

  const tabs: CategoryTab[] = [
    {
      key: "assets",
      label: menuLabels.equipment || "물품",
      href: "/assets/manage",
      enabled: features.equipment !== false,
    },
    {
      key: "spaces",
      label: menuLabels.spaces || "공간",
      href: "/spaces/manage",
      enabled: features.spaces !== false,
    },
    {
      key: "vehicles",
      label: menuLabels.vehicles || "차량",
      href: "/vehicles/manage",
      enabled: features.vehicles === true,
    },
  ].filter((tab) => tab.enabled);

  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div className="tab-shell">
      <nav className="flex min-w-max items-center gap-2 overflow-x-auto pb-1" aria-label="카테고리 탭">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`tab-chip ${isActive ? "tab-chip-active" : ""}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
