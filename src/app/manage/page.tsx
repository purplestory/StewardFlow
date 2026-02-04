"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ManagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"admin" | "manager" | "user">("user");
  const [hasOrganization, setHasOrganization] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setRole((profileData.role as "admin" | "manager" | "user") ?? "user");
        setHasOrganization(!!profileData.organization_id);
      }

      setLoading(false);
    };

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-500">로딩 중...</p>
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">관리자 또는 부서 관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">관리페이지</h1>
        <p className="mt-2 text-sm text-neutral-600">
          자원, 사용자, 메뉴, 시스템 설정을 관리할 수 있습니다
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 자원 관리 */}
        <Link
          href="/assets/manage"
          className="rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">자원 관리</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            물품, 공간, 차량 등 자원을 등록하고 관리합니다
          </p>
        </Link>

        {/* 사용자 관리 */}
        <Link
          href="/settings/users"
          className="rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">사용자 관리</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            사용자 초대, 역할 및 승인 정책을 관리합니다
          </p>
        </Link>

        {/* 메뉴 관리 */}
        <Link
          href="/settings/menu"
          className="rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">메뉴 관리</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            메뉴 라벨, 카테고리, 기능 설정을 관리합니다
          </p>
        </Link>

        {/* 시스템 설정 */}
        <Link
          href="/settings/org"
          className="rounded-xl border border-neutral-200 bg-white p-6 text-center space-y-4 cursor-pointer hover:border-neutral-300 hover:shadow-md transition-all"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">시스템 설정</h3>
          <p className="text-sm text-neutral-600" style={{ wordBreak: "keep-all" }}>
            기관 정보, 부서, 기능 설정을 관리합니다
          </p>
        </Link>
      </div>
    </div>
  );
}
