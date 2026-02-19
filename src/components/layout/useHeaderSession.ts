"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Role = "admin" | "manager" | "user";

export type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
  books?: boolean;
};

export type OrganizationMenuLabels = {
  equipment?: string;
  spaces?: string;
  vehicles?: string;
  books?: string;
};

export type MenuOrderItem = {
  key: string;
  enabled: boolean;
};

type OrganizationSettingsRow = {
  features?: OrganizationFeatures | null;
  menu_labels?: OrganizationMenuLabels | null;
  menu_order?: MenuOrderItem[] | null;
};

type NavItem = {
  href: string;
  label: string;
};

const hasLocalStorageSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const keys = Object.keys(localStorage);
    return keys.some(
      (key) =>
        key.includes("supabase.auth.token") ||
        (key.includes("sb-") && key.includes("-auth-token"))
    );
  } catch {
    return false;
  }
};

const normalizeFeatures = (features?: OrganizationFeatures | null): OrganizationFeatures => ({
  equipment: features?.equipment ?? true,
  spaces: features?.spaces ?? true,
  vehicles: features?.vehicles ?? false,
  books: features?.books ?? false,
});

const normalizeMenuLabels = (
  labels?: OrganizationMenuLabels | null
): OrganizationMenuLabels => {
  const equipmentLabel = labels?.equipment ?? "물품";
  return {
    equipment: equipmentLabel === "장비" ? "물품" : equipmentLabel,
    spaces: labels?.spaces ?? "공간",
    vehicles: labels?.vehicles ?? "차량",
    books: labels?.books ?? "도서",
  };
};

const buildDefaultMenuOrder = (features: OrganizationFeatures): MenuOrderItem[] => [
  { key: "equipment", enabled: features.equipment !== false },
  { key: "spaces", enabled: features.spaces !== false },
  { key: "vehicles", enabled: features.vehicles === true },
  { key: "books", enabled: features.books === true },
];

const normalizeMenuOrder = (
  rawOrder: MenuOrderItem[] | null | undefined,
  features: OrganizationFeatures
): MenuOrderItem[] => {
  if (!rawOrder || rawOrder.length === 0) {
    return buildDefaultMenuOrder(features);
  }

  const orderMap = new Map(rawOrder.map((item) => [item.key, item]));
  const defaultOrder = ["equipment", "spaces", "vehicles", "books"];

  return defaultOrder.map((key) => {
    const existing = orderMap.get(key);
    if (existing) {
      if (key === "vehicles" || key === "books") {
        return {
          ...existing,
          enabled: key === "vehicles" ? features.vehicles === true : features.books === true,
        };
      }
      return existing;
    }

    return {
      key,
      enabled:
        key === "vehicles"
          ? features.vehicles === true
          : key === "books"
            ? features.books === true
          : key === "equipment"
            ? features.equipment !== false
            : features.spaces !== false,
    };
  });
};

export function useHeaderSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [localStorageSession] = useState<boolean | null>(() =>
    hasLocalStorageSession()
  );
  const [role, setRole] = useState<Role>("user");
  const [hasOrganization, setHasOrganization] = useState(false);
  const [features, setFeatures] = useState<OrganizationFeatures | null>(null);
  const [menuLabels, setMenuLabels] = useState<OrganizationMenuLabels | null>(null);
  const [menuOrder, setMenuOrder] = useState<MenuOrderItem[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resetToGuest = () => {
      setRole("user");
      setHasOrganization(false);
      setFeatures(null);
      setMenuLabels(null);
      setMenuOrder([]);
      setUserName(null);
      setUserDepartment(null);
    };

    const loadProfile = async () => {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (!isMounted) return;

        if (sessionError) {
          console.error("세션 조회 오류:", sessionError.message);
          resetToGuest();
          setUserId(null);
          setLoading(false);
          return;
        }

        const user = sessionData.session?.user ?? null;
        setUserId(user?.id ?? null);

        if (!user) {
          resetToGuest();
          setLoading(false);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role,organization_id,name,department")
          .eq("id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (profileError) {
          console.error("프로필 조회 오류:", profileError.message);
          resetToGuest();
          setLoading(false);
          return;
        }

        const nextRole = (profileData?.role as Role) ?? "user";
        const organizationId = profileData?.organization_id ?? null;

        setRole(nextRole);
        setHasOrganization(Boolean(organizationId));
        setUserName(profileData?.name ?? null);
        setUserDepartment(profileData?.department ?? null);

        if (!organizationId) {
          setFeatures(null);
          setMenuLabels(null);
          setMenuOrder([]);
          setLoading(false);
          return;
        }

        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("features,menu_labels,menu_order")
          .eq("id", organizationId)
          .maybeSingle<OrganizationSettingsRow>();

        if (!isMounted) return;

        if (orgError) {
          console.error("기관 설정 조회 오류:", orgError.message);
          setFeatures(null);
          setMenuLabels(null);
          setMenuOrder([]);
          setLoading(false);
          return;
        }

        const normalizedFeatures = normalizeFeatures(orgData?.features);
        setFeatures(normalizedFeatures);
        setMenuLabels(normalizeMenuLabels(orgData?.menu_labels));
        setMenuOrder(normalizeMenuOrder(orgData?.menu_order, normalizedFeatures));
        setLoading(false);
      } catch (error) {
        if (!isMounted) return;
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("헤더 초기화 오류:", error);
        setUserId(null);
        resetToGuest();
        setLoading(false);
      }
    };

    void loadProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    const handleSettingsUpdate = () => {
      void loadProfile();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("organizationSettingsUpdated", handleSettingsUpdate);
    }

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("organizationSettingsUpdated", handleSettingsUpdate);
      }
    };
  }, []);

  const isManager = role === "admin" || role === "manager";
  const isAuthed = loading
    ? localStorageSession === true || Boolean(userId)
    : Boolean(userId);

  const mainNavItems = useMemo(() => {
    if (!hasOrganization) {
      return [] as NavItem[];
    }

    const items: NavItem[] = [];

    if (features && menuLabels) {
      const orderToUse =
        menuOrder.length > 0 ? menuOrder : buildDefaultMenuOrder(features);

      orderToUse.forEach((item) => {
        const key = item.key as "equipment" | "spaces" | "vehicles" | "books";
        const isFeatureEnabled =
          key === "equipment"
            ? features.equipment !== false
            : key === "spaces"
              ? features.spaces !== false
              : key === "vehicles"
                ? features.vehicles === true
                : features.books === true;

        if (key === "vehicles" || key === "books") {
          if (!isFeatureEnabled || !item.enabled) return;
        } else if (!item.enabled || !isFeatureEnabled) {
          return;
        }

        const href =
          key === "equipment"
            ? "/assets"
            : key === "spaces"
              ? "/spaces"
              : key === "vehicles"
                ? "/vehicles"
                : "/books";
        const label =
          menuLabels[key] ||
          (key === "equipment"
            ? "물품"
            : key === "spaces"
              ? "공간"
              : key === "vehicles"
                ? "차량"
                : "도서");

        items.push({ href, label });
      });
    }

    items.push({ href: "/feedback", label: "피드백" });
    return items;
  }, [features, hasOrganization, menuLabels, menuOrder]);

  const userItems = useMemo(() => {
    if (!isAuthed || !hasOrganization) return [] as NavItem[];

    const items: NavItem[] = [
      { href: "/notifications", label: "알림" },
      { href: "/my", label: "마이페이지" },
    ];

    if (isManager) {
      items.push({ href: "/assets/manage", label: "관리페이지" });
      if (features?.books === true) {
        items.push({ href: "/books/manage", label: "도서 운영" });
      }
    }

    return items;
  }, [features?.books, hasOrganization, isAuthed, isManager]);

  const userMenuLabel = useMemo(() => {
    if (userName && userDepartment) {
      return `${userName}(${userDepartment})`;
    }
    if (userName) {
      return userName;
    }
    if (userDepartment) {
      return userDepartment;
    }
    return "내 정보";
  }, [userDepartment, userName]);

  return {
    userId,
    hasLocalStorageSession: localStorageSession,
    role,
    hasOrganization,
    features,
    menuLabels,
    menuOrder,
    userName,
    userDepartment,
    loading,
    isManager,
    isAuthed,
    mainNavItems,
    userItems,
    userMenuLabel,
  };
}
