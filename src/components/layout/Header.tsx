"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import NotificationBadge from "@/components/notifications/NotificationBadge";
import { supabase } from "@/lib/supabase";
import LogoIcon from "@/components/common/LogoIcon";
import { useHeaderSession } from "@/components/layout/useHeaderSession";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    hasLocalStorageSession,
    hasOrganization,
    loading,
    isAuthed,
    mainNavItems,
    userItems,
    userMenuLabel,
  } = useHeaderSession();
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const toggleDropdown = (menu: string) => {
    setDropdownOpen(dropdownOpen === menu ? null : menu);
  };

  const isManageWorkspacePath =
    pathname.startsWith("/assets/manage") ||
    pathname.startsWith("/spaces/manage") ||
    pathname.startsWith("/vehicles/manage") ||
    pathname.startsWith("/books/manage") ||
    pathname.startsWith("/settings/");

  const isNavItemActive = (href: string) => {
    const isServiceTopNavItem =
      href === "/assets" || href === "/spaces" || href === "/vehicles" || href === "/books";

    return (
      !(isManageWorkspacePath && isServiceTopNavItem) &&
      (pathname === href || pathname.startsWith(`${href}/`))
    );
  };

  const navLinkClass = (href: string) => {
    if (isNavItemActive(href)) {
      return "inline-flex h-10 min-w-0 items-center rounded-lg bg-brand-primary px-3.5 text-sm font-semibold text-white shadow-sm";
    }
    return "inline-flex h-10 min-w-0 items-center rounded-lg px-3.5 text-sm font-medium text-neutral-600 hover:bg-slate-100 hover:text-slate-950";
  };

  const mobileNavLinkClass = (href: string) => {
    return isNavItemActive(href)
      ? "block break-words rounded-lg bg-blue-50 px-3 py-2.5 text-sm font-semibold text-brand-primary"
      : "block break-words rounded-lg px-3 py-2.5 text-sm text-neutral-600 hover:bg-slate-50 hover:text-slate-950";
  };

  useEffect(() => {
    if (!dropdownOpen && !mobileMenuOpen) return;

    const handleClickOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (dropdownOpen && !userMenuButtonRef.current?.parentElement?.contains(event.target)) {
        setDropdownOpen(null);
      }
      if (!headerRef.current?.contains(event.target)) setMobileMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (dropdownOpen) userMenuButtonRef.current?.focus();
      else mobileMenuButtonRef.current?.focus();
      setDropdownOpen(null);
      setMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen, mobileMenuOpen]);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-[0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-85"
        >
          <LogoIcon className="h-9 w-9 shrink-0 md:h-10 md:w-10" />
          <div className="min-w-0">
            <p className="text-xl font-bold text-slate-950 md:text-[22px]">
              StewardFlow
            </p>
            <p className="hidden text-[11px] text-slate-500 md:block">
              교회 자원관리 시스템
            </p>
          </div>
        </Link>

        <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="주 메뉴">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(item.href)}
              aria-current={isNavItemActive(item.href) ? "page" : undefined}
              title={item.label}
            >
              <span className="max-w-[100px] truncate">{item.label}</span>
            </Link>
          ))}

          {!loading && isAuthed && (
            <div className="ml-1 flex shrink-0 items-center gap-2">
              {hasOrganization && userItems.length > 0 ? (
                <div className="relative" onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(null);
                }}>
                  <button
                    ref={userMenuButtonRef}
                    type="button"
                    onClick={() => toggleDropdown("user")}
                    className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                    aria-expanded={dropdownOpen === "user"}
                    aria-controls="user-navigation"
                  >
                    <span className="max-w-[180px] truncate">{userMenuLabel}</span>
                  </button>
                  {dropdownOpen === "user" && (
                    <nav id="user-navigation" aria-label="내 메뉴" className="absolute right-0 top-full z-50 mt-2 min-w-[190px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      {userItems.map((item, index) => (
                        <Link
                          key={`${item.href}-${index}`}
                          href={item.href}
                          className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-slate-50 hover:text-slate-900"
                          onClick={() => setDropdownOpen(null)}
                          aria-current={isNavItemActive(item.href) ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(null);
                          void handleSignOut();
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        로그아웃
                      </button>
                    </nav>
                  )}
                </div>
              ) : (
                <>
                  {!hasOrganization ? (
                    <Link href="/settings/org" className="btn-outline h-10">
                      기관 생성
                    </Link>
                  ) : null}
                  <span className="inline-flex h-10 max-w-[180px] items-center truncate rounded-lg border border-slate-200 bg-white px-3 text-sm text-neutral-700">
                    {userMenuLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="btn-ghost"
                  >
                    로그아웃
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && !isAuthed && (
            <Link
              href="/login"
              className="btn-ghost"
            >
              로그인
            </Link>
          )}

          {((!loading && isAuthed) || (loading && hasLocalStorageSession === true)) && (
            <NotificationBadge />
          )}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          {((!loading && isAuthed) || (loading && hasLocalStorageSession === true)) && (
            <NotificationBadge />
          )}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="header-icon-button"
            aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            title={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-slate-200 bg-white shadow-lg lg:hidden">
          <nav className="mx-auto w-full max-w-6xl px-4 py-3" aria-label="모바일 주 메뉴">
            <div className="space-y-1">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={mobileNavLinkClass(item.href)}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isNavItemActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}

            {!loading && isAuthed && userItems.length > 0 && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <p className="px-3 pt-1 text-[11px] font-semibold text-slate-400">
                  내 메뉴
                </p>
                {userItems.map((item, index) => (
                  <Link
                    key={`${item.href}-${index}`}
                    href={item.href}
                    className={mobileNavLinkClass(item.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isNavItemActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            )}

            {!loading && isAuthed && (
              <>
                <div className="my-1 border-t border-slate-100" />
                {!hasOrganization ? (
                  <Link
                    href="/settings/org"
                    className={mobileNavLinkClass("/settings/org")}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    기관 생성
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleSignOut();
                  }}
                  className="block w-full pl-3 pr-2 py-2.5 text-left text-sm text-neutral-600 hover:text-slate-900"
                >
                  로그아웃
                </button>
              </>
            )}

            {!loading && !isAuthed && (
              <Link
                href="/login"
                className="block pl-3 pr-2 py-2.5 text-sm text-neutral-600 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                로그인
              </Link>
            )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
