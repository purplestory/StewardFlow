"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  const navLinkClass = (href: string) => {
    const isServiceTopNavItem = href === "/assets" || href === "/spaces" || href === "/vehicles" || href === "/books";
    const isActive =
      !(isManageWorkspacePath && isServiceTopNavItem) &&
      (pathname === href || pathname.startsWith(`${href}/`));
    if (isActive) {
      return "inline-flex h-10 items-center rounded-xl bg-slate-900 px-3.5 text-sm font-medium text-white shadow-sm";
    }
    return "inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-medium text-neutral-600 hover:bg-slate-50 hover:text-slate-900";
  };

  const mobileNavLinkClass = (href: string) => {
    const isServiceTopNavItem = href === "/assets" || href === "/spaces" || href === "/vehicles" || href === "/books";
    const isActive =
      !(isManageWorkspacePath && isServiceTopNavItem) &&
      (pathname === href || pathname.startsWith(`${href}/`));
    return isActive
      ? "block border-l-2 border-slate-900 pl-3 pr-2 py-2.5 text-sm font-semibold text-slate-900"
      : "block pl-3 pr-2 py-2.5 text-sm text-neutral-600 hover:text-slate-900";
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-menu")) {
        setDropdownOpen(null);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-2.5 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-85"
        >
          <LogoIcon className="h-10 w-10 shrink-0 md:h-11 md:w-11" />
          <div>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              StewardFlow
            </p>
            <p className="hidden text-[11px] text-slate-500 md:block">
              교회 자원관리 시스템
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {mainNavItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
              {item.label}
            </Link>
          ))}

          {!loading && isAuthed && (
            <div className="ml-1 flex items-center gap-2">
              {hasOrganization && userItems.length > 0 ? (
                <div className="relative dropdown-menu">
                  <button
                    type="button"
                    onClick={() => toggleDropdown("user")}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:border-slate-300 hover:text-slate-900"
                  >
                    <span className="max-w-[180px] truncate">{userMenuLabel}</span>
                  </button>
                  {dropdownOpen === "user" && (
                    <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                      {userItems.map((item, index) => (
                        <Link
                          key={`${item.href}-${index}`}
                          href={item.href}
                          className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-slate-50 hover:text-slate-900"
                          onClick={() => setDropdownOpen(null)}
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
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {!hasOrganization ? (
                    <Link href="/settings/org" className="btn-outline h-10">
                      기관 생성
                    </Link>
                  ) : null}
                  <span className="inline-flex h-10 max-w-[180px] items-center truncate rounded-xl border border-slate-200 bg-white px-3 text-sm text-neutral-700">
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

        <div className="flex items-center gap-2 md:hidden">
          {((!loading && isAuthed) || (loading && hasLocalStorageSession === true)) && (
            <NotificationBadge />
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="header-icon-button"
            aria-label="메뉴 열기"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <nav className="mx-auto w-full max-w-6xl px-4 py-3">
            <div className="space-y-1">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={mobileNavLinkClass(item.href)}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {!loading && isAuthed && userItems.length > 0 && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <p className="px-3 pt-1 text-[11px] font-semibold tracking-wide text-slate-400">
                  내 메뉴
                </p>
                {userItems.map((item, index) => (
                  <Link
                    key={`${item.href}-${index}`}
                    href={item.href}
                    className={mobileNavLinkClass(item.href)}
                    onClick={() => setMobileMenuOpen(false)}
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
