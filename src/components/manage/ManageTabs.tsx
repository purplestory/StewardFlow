"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

type ManageTab = {
  key: string;
  label: string;
  href: string;
};

export default function ManageTabs() {
  const pathname = usePathname();

  const tabs: ManageTab[] = [
    {
      key: "resources",
      label: "자원 관리",
      href: "/assets/manage",
    },
    {
      key: "users",
      label: "사용자 관리",
      href: "/settings/users",
    },
    {
      key: "menu",
      label: "메뉴 관리",
      href: "/settings/menu",
    },
    {
      key: "system",
      label: "기관 및 부서관리",
      href: "/settings/org",
    },
  ];

  // 현재 경로가 어떤 탭에 해당하는지 확인
  const currentTab = tabs.find((tab) => {
    if (tab.key === "resources") {
      return pathname.startsWith("/assets/manage") || 
             pathname.startsWith("/spaces/manage") || 
             pathname.startsWith("/vehicles/manage");
    }
    return pathname.startsWith(tab.href);
  });

  return (
    <div className="mb-6 border-b border-neutral-200">
      <nav className="-mb-px flex space-x-1" aria-label="관리 탭">
        {tabs.map((tab) => {
          let isActive = false;
          if (tab.key === "resources") {
            isActive = pathname.startsWith("/assets/manage") || 
                      pathname.startsWith("/spaces/manage") || 
                      pathname.startsWith("/vehicles/manage");
          } else {
            isActive = pathname.startsWith(tab.href);
          }

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`
                whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors
                ${
                  isActive
                    ? "border-black text-black"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                }
              `}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
