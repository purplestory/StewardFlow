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

const MENU_KEYS = ["equipment", "spaces", "vehicles", "books"] as const;
type MenuKey = (typeof MENU_KEYS)[number];
const MAIN_MENU_DEFAULT_ORDER: MenuKey[] = ["books", "equipment", "spaces", "vehicles"];

function isMenuKey(value: string): value is (typeof MENU_KEYS)[number] {
  return MENU_KEYS.includes(value as (typeof MENU_KEYS)[number]);
}

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
  { key: "books", enabled: features.books === true },
  { key: "equipment", enabled: features.equipment !== false },
  { key: "spaces", enabled: features.spaces !== false },
  { key: "vehicles", enabled: features.vehicles === true },
];

const getFeatureEnabled = (features: OrganizationFeatures, key: MenuKey) => {
  if (key === "equipment") return features.equipment !== false;
  if (key === "spaces") return features.spaces !== false;
  if (key === "vehicles") return features.vehicles === true;
  return features.books === true;
};

const getMenuHref = (key: MenuKey) => {
  if (key === "equipment") return "/assets";
  if (key === "spaces") return "/spaces";
  if (key === "vehicles") return "/vehicles";
  return "/books";
};

const getDefaultMenuLabel = (key: MenuKey) => {
  if (key === "equipment") return "물품";
  if (key === "spaces") return "공간";
  if (key === "vehicles") return "차량";
  return "도서";
};

const normalizeMenuOrder = (
  rawOrder: MenuOrderItem[] | null | undefined,
  features: OrganizationFeatures
): MenuOrderItem[] => {
  if (!rawOrder || rawOrder.length === 0) {
    return buildDefaultMenuOrder(features);
  }

  const validSource = rawOrder.filter(
    (item): item is { key: (typeof MENU_KEYS)[number]; enabled: boolean } =>
      typeof item?.key === "string" && isMenuKey(item.key)
  );

  const persistedEnabled = new Map<(typeof MENU_KEYS)[number], boolean>();
  const orderedKeys: (typeof MENU_KEYS)[number][] = [];
  const seen = new Set<(typeof MENU_KEYS)[number]>();

  validSource.forEach((item) => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    orderedKeys.push(item.key);
    persistedEnabled.set(item.key, Boolean(item.enabled));
  });

  MAIN_MENU_DEFAULT_ORDER.forEach((key) => {
    if (!seen.has(key)) orderedKeys.push(key);
  });

  return orderedKeys.map((key) => {
    const featureEnabled = getFeatureEnabled(features, key);
    return {
      key,
      enabled: (persistedEnabled.get(key) ?? featureEnabled) && featureEnabled,
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

    if (features) {
      const orderToUse =
        menuOrder.length > 0 ? menuOrder : buildDefaultMenuOrder(features);
      orderToUse.forEach((item) => {
        const key = item.key;
        if (!isMenuKey(key)) return;
        if (!item.enabled || !getFeatureEnabled(features, key)) return;

        const label = menuLabels?.[key] ?? getDefaultMenuLabel(key);
        items.push({ href: getMenuHref(key), label });
      });
    }

    return items;
  }, [features, hasOrganization, menuLabels, menuOrder]);

  const userItems = useMemo(() => {
    if (!isAuthed || !hasOrganization) return [] as NavItem[];

    const items: NavItem[] = [
      { href: "/notifications", label: "알림" },
      { href: "/my", label: "마이페이지" },
      { href: "/feedback", label: "피드백" },
    ];

    if (isManager) {
      items.push({ href: "/assets/manage", label: "관리페이지" });
    }

    return items;
  }, [hasOrganization, isAuthed, isManager]);

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
