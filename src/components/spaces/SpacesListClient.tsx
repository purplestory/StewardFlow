"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import type { Space } from "@/types/database";
import SpaceCard from "@/components/spaces/SpaceCard";
import SpaceForm from "@/components/spaces/SpaceForm";
import { useSpaces, useSpaceApprovalPolicies } from "@/hooks/useSpaces";
import { useUserProfile } from "@/hooks/useAssets";

const statusOptions: Array<{ value: Space["status"] | ""; label: string }> = [
  { value: "", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "수리 중" },
];

export default function SpacesListClient() {
  const queryClient = useQueryClient();

  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Space["status"] | "">("");

  // React Query를 사용한 데이터 페칭
  const { data: spaces = [], isLoading: spacesLoading, error: spacesError } = useSpaces();
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  const { data: policyData } = useSpaceApprovalPolicies(userProfile?.orgId ?? null);

  // Policy labels 계산
  const policyLabels = useMemo(() => {
    if (!policyData || !spaces.length) return {};

    const labelMap: Record<string, string> = {};
    const roleLabel: Record<string, string> = {
      admin: "관리자",
      manager: "부서 관리자",
      user: "일반 사용자",
    };

    spaces.forEach((space) => {
      const department =
        space.owner_scope === "organization"
          ? null
          : space.owner_department;
      const exactPolicy = policyData.find(
        (policy) => policy.department === department
      );
      const fallbackPolicy = policyData.find(
        (policy) => policy.department === null
      );
      const requiredRole =
        exactPolicy?.required_role ??
        fallbackPolicy?.required_role ??
        "manager";
      labelMap[space.id] = roleLabel[requiredRole] ?? "부서 관리자";
    });
    return labelMap;
  }, [spaces, policyData]);

  const loading = spacesLoading || profileLoading;
  const hasOrganization = !!userProfile?.orgId;
  const isManager = userProfile?.isManager ?? false;
  const message = spacesError ? spacesError.message : null;

  const filteredSpaces = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return spaces.filter((space) => {
      const matchesQuery =
        normalized.length === 0 ||
        space.name.toLowerCase().includes(normalized) ||
        space.owner_department.toLowerCase().includes(normalized);
      const matchesStatus = !status || space.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [spaces, query, status]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">공간</h1>
            <p className="mt-2 text-sm text-neutral-600">
              회의실, 교육실, 체육관 등 공간 예약을 신청할 수 있습니다.
            </p>
          </div>
          {isManager && hasOrganization === true && (
            <button
              type="button"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800 whitespace-nowrap"
            >
              {showRegisterForm ? "목록 보기" : "공간 등록"}
            </button>
          )}
        </div>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <input
              className="form-input"
              placeholder="공간명 또는 부서를 검색하세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {/* 상태 필터 버튼 */}
          <div className="flex flex-wrap items-center gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (option.value === "") {
                    // "전체" 버튼 클릭 시 모든 필터 초기화
                    setQuery("");
                    setStatus("");
                  } else {
                    setStatus(option.value as Space["status"] | "");
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  status === option.value
                    ? option.value === ""
                      ? "bg-neutral-900 text-white"
                      : option.value === "available"
                      ? "bg-emerald-500 text-white"
                      : option.value === "rented"
                      ? "bg-blue-500 text-white"
                      : option.value === "repair"
                      ? "bg-amber-500 text-white"
                      : option.value === "lost"
                      ? "bg-rose-500 text-white"
                      : "bg-neutral-100 text-neutral-700"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showRegisterForm && isManager && hasOrganization === true && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">공간 등록</h2>
          <SpaceForm />
        </div>
      )}

      {loading ? (
        <Notice className="rounded-xl bg-white p-10">
          공간 목록을 불러오는 중입니다.
        </Notice>
      ) : !hasOrganization ? (
        <Notice variant="warning" className="rounded-xl p-10">
          기관 설정이 필요합니다.{" "}
          <Link href="/settings/org" className="underline">
            기관 설정
          </Link>
          으로 이동해 생성/참여를 완료해주세요.
        </Notice>
      ) : message ? (
        <Notice variant="error" className="rounded-xl p-10">
          {message}
        </Notice>
      ) : filteredSpaces.length === 0 ? (
        <Notice className="rounded-xl bg-white p-10">
          <p>조건에 맞는 공간이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("");
            }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSpaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              requiredRoleLabel={policyLabels[space.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
