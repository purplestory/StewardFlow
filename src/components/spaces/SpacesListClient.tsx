"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  { value: "thumbnail", label: "썸네일" },
  { value: "text", label: "텍스트" },
  { value: "compact", label: "컴팩트" },
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
  const [viewMode, setViewMode] = useState<ListViewMode>("thumbnail");

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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="form-input"
              placeholder="공간명 또는 부서를 검색하세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white p-1">
              {listViewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  className={
                    option.value === viewMode
                      ? "inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                      : "inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
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
          {viewMode === "thumbnail" ? (
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

          {viewMode === "text" ? (
            <div className="space-y-3">
              {filteredSpaces.map((space) => {
                const detailUrl = `/spaces/${space.short_id ?? space.id}`;
                return (
                  <div key={space.id} className="surface-card p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={detailUrl}
                          className="line-clamp-1 text-base font-semibold text-neutral-900 hover:text-slate-800"
                        >
                          {space.name}
                        </Link>
                        <p className="text-sm text-neutral-600">
                          {space.location ? `위치 ${space.location}` : "위치 미등록"}
                          {" · "}
                          {space.capacity ? `수용 ${space.capacity}명` : "수용 인원 미등록"}
                          {" · "}
                          {space.owner_scope === "organization"
                            ? "기관 공용"
                            : space.owner_department || "소유 부서 미등록"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ResourceStatusBadge
                          status={space.status}
                          label={statusLabel[space.status]}
                        />
                        <Link href={detailUrl} className="btn-secondary h-9 px-3 text-sm font-semibold">
                          상세 보기
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {viewMode === "compact" ? (
            <div className="module-list">
              {filteredSpaces.map((space) => {
                const detailUrl = `/spaces/${space.short_id ?? space.id}`;
                return (
                  <div key={space.id} className="list-row px-4 py-3 md:px-5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={detailUrl}
                        className="line-clamp-1 text-sm font-semibold text-neutral-900 hover:text-slate-800"
                      >
                        {space.name}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                        {space.location || "위치 미등록"} ·{" "}
                        {space.owner_scope === "organization"
                          ? "기관 공용"
                          : space.owner_department || "소유 부서 미등록"}
                      </p>
                    </div>
                    <ResourceStatusBadge
                      status={space.status}
                      label={statusLabel[space.status]}
                      className="shrink-0"
                    />
                    <Link href={detailUrl} className="btn-secondary h-8 px-2.5 text-xs font-semibold">
                      보기
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
