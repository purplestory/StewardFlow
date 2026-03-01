"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
  books?: boolean;
};

type OrganizationMenuLabels = {
  equipment?: string;
  spaces?: string;
  vehicles?: string;
  books?: string;
};

type CategoryTab = {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
};

let cachedFeatures: OrganizationFeatures | null = null;
let cachedMenuLabels: OrganizationMenuLabels | null = null;

function normalizeManageTabLabel(rawLabel: string | undefined, fallback: string) {
  const base = (rawLabel || fallback).trim();
  if (base.endsWith("예약")) {
    return base.slice(0, -2).trim() || fallback;
  }
  return base;
}

export default function CategoryTabs() {
  const pathname = usePathname();
  const [features, setFeatures] = useState<OrganizationFeatures | null>(cachedFeatures);
  const [menuLabels, setMenuLabels] = useState<OrganizationMenuLabels | null>(cachedMenuLabels);

  useEffect(() => {
    const loadOrganizationData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
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
          const nextFeatures: OrganizationFeatures = {
            equipment: orgData.features?.equipment ?? true,
            spaces: orgData.features?.spaces ?? true,
            vehicles: orgData.features?.vehicles ?? false,
            books: orgData.features?.books ?? false,
          };
          const nextMenuLabels: OrganizationMenuLabels = {
            equipment: orgData.menu_labels?.equipment ?? "물품",
            spaces: orgData.menu_labels?.spaces ?? "공간",
            vehicles: orgData.menu_labels?.vehicles ?? "차량",
            books: orgData.menu_labels?.books ?? "도서",
          };
          cachedFeatures = nextFeatures;
          cachedMenuLabels = nextMenuLabels;
          setFeatures(nextFeatures);
          setMenuLabels(nextMenuLabels);
        }
      }
    };

    loadOrganizationData();
  }, []);

  if (!features || !menuLabels) {
    return null;
  }

  const tabs: CategoryTab[] = [
    {
      key: "assets",
      label: normalizeManageTabLabel(menuLabels.equipment, "물품"),
      href: "/assets/manage",
      enabled: features.equipment !== false,
    },
    {
      key: "spaces",
      label: normalizeManageTabLabel(menuLabels.spaces, "공간"),
      href: "/spaces/manage",
      enabled: features.spaces !== false,
    },
    {
      key: "vehicles",
      label: normalizeManageTabLabel(menuLabels.vehicles, "차량"),
      href: "/vehicles/manage",
      enabled: features.vehicles === true,
    },
    {
      key: "books",
      label: menuLabels.books || "도서",
      href: "/books/manage",
      enabled: features.books === true,
    },
  ].filter((tab) => tab.enabled);

  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div className="tab-shell tab-shell-secondary">
      <div className="tab-scroll">
        <nav className="tab-nav" aria-label="카테고리 탭">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`tab-chip tab-chip-secondary ${isActive ? "tab-chip-secondary-active" : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
