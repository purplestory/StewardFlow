"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NotificationBadge from "@/components/notifications/NotificationBadge";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "manager" | "user";

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

export default function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLocalStorageSession, setHasLocalStorageSession] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>("user");
  const [hasOrganization, setHasOrganization] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [features, setFeatures] = useState<OrganizationFeatures | null>(null);
  const [menuLabels, setMenuLabels] = useState<OrganizationMenuLabels | null>(null);
  const [menuOrder, setMenuOrder] = useState<
    Array<{ key: string; enabled: boolean }>
  >([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check localStorage for session on client side only (after mount)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const keys = Object.keys(localStorage);
      const hasSupabaseSession = keys.some(key => 
        key.includes('supabase.auth.token') || 
        (key.includes('sb-') && key.includes('-auth-token'))
      );
      setHasLocalStorageSession(hasSupabaseSession);
    } catch {
      setHasLocalStorageSession(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setRole("user");
          setHasOrganization(false);
          setLoading(false);
          return;
        }
        
        const user = sessionData.session?.user ?? null;

        if (!isMounted) return;
        setUserId(user?.id ?? null);

        if (!user) {
          setRole("user");
          setHasOrganization(false);
          setOrganizationId(null);
          setFeatures(null);
          setMenuLabels(null);
          setMenuOrder([]);
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
          console.error("Profile fetch error:", profileError);
          setRole("user");
          setHasOrganization(false);
          setLoading(false);
          return;
        }
        
        setRole((profileData?.role as Role) ?? "user");
        const orgId = profileData?.organization_id ?? null;
        setHasOrganization(Boolean(orgId));
        setOrganizationId(orgId);
        setUserName(profileData?.name ?? null);
        setUserDepartment(profileData?.department ?? null);

        // Load organization features, menu labels, and menu order
        if (orgId) {
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .select("features,menu_labels,menu_order")
            .eq("id", orgId)
            .maybeSingle();

          if (!isMounted) return;
          
          if (orgError) {
            console.error("Organization fetch error:", orgError);
            setLoading(false);
            return;
          }

          if (orgData && isMounted) {
          let loadedFeatures: OrganizationFeatures;
          if (orgData.features) {
            loadedFeatures = {
              equipment: orgData.features.equipment ?? true,
              spaces: orgData.features.spaces ?? true,
              vehicles: orgData.features.vehicles ?? false,
            };
            setFeatures(loadedFeatures);
          } else {
            // Default features if not set
            loadedFeatures = {
              equipment: true,
              spaces: true,
              vehicles: false,
            };
            setFeatures(loadedFeatures);
          }
          if (orgData.menu_labels) {
            // '장비'를 '물품'으로 변환 (기존 데이터 호환)
            const equipmentLabel = orgData.menu_labels.equipment ?? "물품";
            setMenuLabels({
              equipment: equipmentLabel === "장비" ? "물품" : equipmentLabel,
              spaces: orgData.menu_labels.spaces ?? "공간",
              vehicles: orgData.menu_labels.vehicles ?? "차량",
            });
          } else {
            // Default labels if not set
            setMenuLabels({
              equipment: "물품",
              spaces: "공간",
              vehicles: "차량",
            });
          }
          if (orgData.menu_order && Array.isArray(orgData.menu_order)) {
            // 메인 화면과 동일한 순서로 정렬: 물품, 공간, 차량
            const orderMap = new Map(orgData.menu_order.map((item: any) => [item.key, item]));
            const defaultOrder = ["equipment", "spaces", "vehicles"];
            
            // 순서대로 정렬된 배열 생성
            const sortedOrder = defaultOrder.map(key => {
              const existing = orderMap.get(key);
              if (existing) {
                // 기존 설정 유지하되 enabled 상태는 features에 맞게 업데이트
                if (key === "vehicles") {
                  return { ...existing, enabled: loadedFeatures?.vehicles === true };
                }
                return existing;
              } else {
                // 없는 항목은 기본값으로 추가
                return {
                  key,
                  enabled: key === "vehicles" 
                    ? loadedFeatures?.vehicles === true 
                    : key === "equipment"
                    ? loadedFeatures?.equipment !== false
                    : loadedFeatures?.spaces !== false
                };
              }
            });
            
            setMenuOrder(sortedOrder);
          } else {
            // Default order if not set
            // 메인 화면과 동일한 순서: 물품, 공간, 차량
            setMenuOrder([
              { key: "equipment", enabled: true },
              { key: "spaces", enabled: true },
              { key: "vehicles", enabled: loadedFeatures?.vehicles === true },
            ]);
          }
        } else if (isMounted) {
          // No org data found, set defaults
          setFeatures({
            equipment: true,
            spaces: true,
            vehicles: false,
          });
          setMenuLabels({
            equipment: "물품",
            spaces: "공간",
            vehicles: "차량",
          });
          // 메인 화면과 동일한 순서: 물품, 공간, 차량
          setMenuOrder([
            { key: "equipment", enabled: true },
            { key: "spaces", enabled: true },
            { key: "vehicles", enabled: false },
          ]);
        }
      } else if (isMounted) {
        // No organization, clear features
        setFeatures(null);
        setMenuLabels(null);
        setMenuOrder([]);
      }

        setLoading(false);
      } catch (error) {
        if (!isMounted) return;
        
        // AbortError는 무시 (컴포넌트 언마운트 시 발생)
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        console.error("Header loadProfile error:", error);
        setRole("user");
        setHasOrganization(false);
        setLoading(false);
      }
    };

    loadProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    // Listen for organization settings updates
    const handleSettingsUpdate = () => {
      loadProfile();
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
  // During loading, if we found a session in localStorage, show authenticated menu
  // This prevents flash of login menu when user is actually logged in
  const isAuthed = loading 
    ? (hasLocalStorageSession === true || Boolean(userId))
    : Boolean(userId);

  // Main navigation items (always visible) - ordered by menu_order
  const mainNavItems = useMemo(() => {
    // Don't show menu items until data is loaded
    if (!features || !menuLabels) {
      return [];
    }

    const items: Array<{ href: string; label: string }> = [];

    // Use menu_order if available, otherwise fall back to default order
    // 메인 화면과 동일한 순서: 물품, 공간, 차량
    const orderToUse = menuOrder.length > 0 ? menuOrder : [
      { key: "equipment", enabled: features.equipment !== false },
      { key: "spaces", enabled: features.spaces !== false },
      { key: "vehicles", enabled: features.vehicles === true },
    ];

    orderToUse.forEach((item) => {
      const key = item.key as "equipment" | "spaces" | "vehicles";
      
      // Check both menuOrder.enabled and features
      const isFeatureEnabled = 
        key === "equipment" ? features.equipment !== false :
        key === "spaces" ? features.spaces !== false :
        features.vehicles === true;
      
      // Only show if both menuOrder says enabled AND feature is enabled
      // For vehicles, both features.vehicles must be true AND menuOrder.enabled must be true
      if (key === "vehicles") {
        // Vehicles must have feature enabled AND menuOrder enabled
        if (features.vehicles !== true || !item.enabled) return;
      } else {
        if (!item.enabled || !isFeatureEnabled) return;
      }

      const href =
        key === "equipment"
          ? "/assets"
          : key === "spaces"
          ? "/spaces"
          : "/vehicles";
      const label =
        menuLabels[key] ||
        (key === "equipment" ? "물품" : key === "spaces" ? "공간" : "차량");

      items.push({ href, label });
    });

    return items;
  }, [features, menuLabels, menuOrder]);

  // Management menu items (for managers/admins)
  const managementItems = useMemo(() => {
    if (!isManager || !features || !menuLabels) return [];

    const items: Array<{ href: string; label: string }> = [];

    // 자원 관리 메뉴 (등록 기능 포함)
    const hasAnyFeature = 
      features.equipment !== false || 
      features.spaces !== false || 
      features.vehicles === true;
    
    if (hasAnyFeature) {
      items.push({ href: "/manage", label: "자원 관리" });
    }

    items.push({ href: "/settings/users", label: "사용자 관리" });
    items.push({ href: "/settings/menu", label: "메뉴 설정" });
    items.push({ href: "/settings/audit", label: "감사 로그" });
    
    if (hasOrganization || isManager) {
      items.push({ href: "/settings/org", label: "시스템 설정" });
    }

    return items;
  }, [isManager, features, menuLabels, hasOrganization]);

  // User menu items
  const userItems = useMemo(() => {
    if (!isAuthed) return [];

    return [
      { href: "/notifications", label: "알림" },
      { href: "/my", label: "마이페이지" },
      { href: "/manage", label: "관리페이지" },
    ];
  }, [isAuthed]);

  // 사용자 메뉴명 생성: '이름(부서)' 형식
  const userMenuLabel = useMemo(() => {
    if (userName && userDepartment) {
      return `${userName}(${userDepartment})`;
    } else if (userName) {
      return userName;
    } else if (userDepartment) {
      return userDepartment;
    }
    return "내 정보";
  }, [userDepartment, userName]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // 로그아웃 후 홈으로 리다이렉트 (인포그래픽 페이지 표시)
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const toggleDropdown = (menu: string) => {
    setDropdownOpen(dropdownOpen === menu ? null : menu);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setDropdownOpen(null);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 md:gap-3 text-xl md:text-2xl font-semibold hover:opacity-80 transition-opacity">
          <img
            src="/icon.svg"
            alt="StewardFlow"
            className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0"
          />
          <span>Steward Flow</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-wrap items-center gap-4 text-sm text-neutral-600">
          {/* Main navigation items */}
          {mainNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-black">
              {item.label}
            </Link>
          ))}

          {/* User dropdown */}
          {!loading && userItems.length > 0 && (
            <div className="relative dropdown-menu">
              <button
                type="button"
                onClick={() => toggleDropdown('user')}
                className="hover:text-black flex items-center gap-1"
              >
                {userMenuLabel}
                <span className="text-xs">▼</span>
              </button>
              {dropdownOpen === 'user' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                  {userItems.map((item, index) => (
                    <Link
                      key={`${item.href}-${index}`}
                      href={item.href}
                      className="block px-4 py-2 hover:bg-neutral-50"
                      onClick={() => setDropdownOpen(null)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {/* 로그아웃 버튼 - 드롭다운 맨 아래에 구분선과 함께 배치 */}
                  <div className="border-t border-neutral-200 my-1"></div>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(null);
                      handleSignOut();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-50 text-neutral-600"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Login button (if not authenticated) */}
          {!loading && !isAuthed && (
            <Link href="/login" className="hover:text-black">
              로그인
            </Link>
          )}

          {/* Notification badge (로그인된 경우) */}
          {((!loading && isAuthed) || (loading && hasLocalStorageSession === true)) && (
            <NotificationBadge />
          )}
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          {/* Notification badge (로그인된 경우) */}
          {((!loading && isAuthed) || (loading && hasLocalStorageSession === true)) && (
            <NotificationBadge />
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-neutral-600 hover:text-black"
            aria-label="메뉴 열기"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white">
          <nav className="px-4 py-3 space-y-2">
            {/* Main navigation items */}
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block py-2 text-sm text-neutral-600 hover:text-black"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {/* User menu items */}
            {!loading && userItems.length > 0 && (
              <>
                <div className="border-t border-neutral-200 my-2"></div>
                {userItems.map((item, index) => (
                  <Link
                    key={`${item.href}-${index}`}
                    href={item.href}
                    className="block py-2 text-sm text-neutral-600 hover:text-black"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-neutral-200 my-2"></div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="block w-full text-left py-2 text-sm text-neutral-600 hover:text-black"
                >
                  로그아웃
                </button>
              </>
            )}

            {/* Login button (if not authenticated) */}
            {!loading && !isAuthed && (
              <Link
                href="/login"
                className="block py-2 text-sm text-neutral-600 hover:text-black"
                onClick={() => setMobileMenuOpen(false)}
              >
                로그인
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
