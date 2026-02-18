"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NotificationBadge from "@/components/notifications/NotificationBadge";
import { supabase } from "@/lib/supabase";
import LogoIcon from "@/components/common/LogoIcon";
import {
  useHeaderSession,
} from "@/components/layout/useHeaderSession";

export default function Header() {
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
        <Link href="/" className="flex items-center gap-1 text-xl md:text-2xl font-semibold hover:opacity-80 transition-opacity">
          <LogoIcon className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0" />
          <span>StewardFlow</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-wrap items-center gap-4 text-sm text-neutral-600">
          {/* Main navigation items */}
          {mainNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-black">
              {item.label}
            </Link>
          ))}

          {/* User menu */}
          {!loading && isAuthed && (
            <div className="flex items-center gap-3">
              {/* 가입 승인된 멤버: 드롭다운 메뉴 안에 로그아웃 포함 */}
              {hasOrganization && userItems.length > 0 ? (
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
              ) : (
                /* 가입 신청 대기 중인 사용자: 사용자 이름과 로그아웃 버튼만 표시 */
                <>
                  <span className="text-sm text-neutral-600">{userMenuLabel}</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="hover:text-black text-sm text-neutral-600"
                  >
                    로그아웃
                  </button>
                </>
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
            {!loading && isAuthed && (
              <>
                {userItems.length > 0 && (
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
                  </>
                )}
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
