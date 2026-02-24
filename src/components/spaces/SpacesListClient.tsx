"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Notice from "@/components/common/Notice";
import type { Space } from "@/types/database";
import SpaceCard from "@/components/spaces/SpaceCard";
import SpaceForm from "@/components/spaces/SpaceForm";
import { useSpaces, useSpaceApprovalPolicies } from "@/hooks/useSpaces";
import { useUserProfile } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";

const statusOptions: Array<{ value: Space["status"] | ""; label: string }> = [
  { value: "", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "수리 중" },
];

const listViewOptions = [
  { value: "grid", label: "그리드" },
  { value: "list", label: "리스트" },
] as const;

type ListViewMode = (typeof listViewOptions)[number]["value"];

const statusLabel: Record<Space["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "수리 중",
  lost: "사용 불가",
};

export default function SpacesListClient() {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Space["status"] | "">("");
  const [viewMode, setViewMode] = useState<ListViewMode>("grid");

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
  const hasOrganization = Boolean(userProfile?.orgId);
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

  const clearFilters = () => {
    setQuery("");
    setStatus("");
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="공간"
        description="회의실, 교육실, 체육관 등 공간 예약을 신청할 수 있습니다."
        actions={
          isManager && hasOrganization === true ? (
            <button
              type="button"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="btn-primary whitespace-nowrap"
            >
              {showRegisterForm ? "목록 보기" : "공간 등록"}
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="form-input min-w-0 flex-1 basis-52"
              placeholder="공간명 또는 부서를 검색하세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="flex shrink-0 items-center gap-1">
              {listViewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  className={
                    option.value === viewMode
                      ? "inline-flex h-10 items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-3 text-sm font-semibold text-white"
                      : "inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <StatusFilterPills
            options={statusOptions}
            value={status}
            onChange={(next) => {
              if (next === "") {
                clearFilters();
                return;
              }
              setStatus(next);
            }}
          />
        </div>
      </PageHero>

      {showRegisterForm && isManager && hasOrganization === true && (
        <SectionCard title="공간 등록">
          <SpaceForm />
        </SectionCard>
      )}

      {loading ? (
        <Notice className="p-10">
          공간 목록을 불러오는 중입니다.
        </Notice>
      ) : !hasOrganization ? (
        <Notice variant="warning" className="p-10">
          기관 설정이 필요합니다.{" "}
          <Link href="/settings/org" className="underline">
            기관 설정
          </Link>
          으로 이동해 생성/참여를 완료해주세요.
        </Notice>
      ) : message ? (
        <Notice variant="error" className="p-10">
          {message}
        </Notice>
      ) : filteredSpaces.length === 0 ? (
        <Notice className="p-10">
          <p>조건에 맞는 공간이 없습니다.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="btn-ghost mt-3"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  requiredRoleLabel={policyLabels[space.id]}
                />
              ))}
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className="space-y-3">
              {filteredSpaces.map((space) => {
                const detailUrl = `/spaces/${space.short_id ?? space.id}`;
                const firstImage =
                  space.image_urls && space.image_urls.length > 0
                    ? space.image_urls[0]
                    : space.image_url;
                return (
                  <Link
                    key={space.id}
                    href={detailUrl}
                    className="surface-card group block p-3 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:p-4"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-24 shrink-0 sm:w-36 md:w-44">
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 sm:aspect-[4/3]">
                          {firstImage ? (
                            <Image
                              src={firstImage}
                              alt={space.name}
                              fill
                              sizes="(max-width: 768px) 100vw, 224px"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                              이미지 없음
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="line-clamp-1 text-base font-semibold text-neutral-900 transition-colors group-hover:text-slate-800 sm:text-lg">
                            {space.name}
                          </h3>
                          <ResourceStatusBadge
                            status={space.status}
                            label={statusLabel[space.status]}
                          />
                        </div>

                        <div className="space-y-1 text-sm text-neutral-600">
                          <p>
                            {space.location ? `위치 ${space.location}` : "위치 미등록"}
                          </p>
                          <p>
                            {space.capacity ? `수용 ${space.capacity}명` : "수용 인원 미등록"}
                          </p>
                          <p>
                            {space.owner_scope === "organization"
                              ? "기관 공용"
                              : space.owner_department || "소유 부서 미등록"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
