"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Notice from "@/components/common/Notice";
import type { Asset } from "@/types/database";
import AssetCard from "@/components/assets/AssetCard";
import AssetForm from "@/components/assets/AssetForm";
import { useAssets, useUserProfile, useApprovalPolicies } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";

const categoryOptions = [
  { value: "", label: "전체" },
  { value: "sound", label: "음향" },
  { value: "video", label: "영상" },
  { value: "kitchen", label: "조리" },
  { value: "furniture", label: "가구" },
  { value: "etc", label: "기타" },
];

const statusOptions: Array<{ value: Asset["status"] | ""; label: string }> = [
  { value: "", label: "전체" },
  { value: "available", label: "대여 가능" },
  { value: "rented", label: "대여 중" },
  { value: "repair", label: "수리 중" },
  { value: "lost", label: "분실" },
  { value: "retired", label: "불용품" },
];

const listViewOptions = [
  { value: "grid", label: "그리드" },
  { value: "list", label: "리스트" },
] as const;

type ListViewMode = (typeof listViewOptions)[number]["value"];

const statusLabel: Record<Asset["status"], string> = {
  available: "대여 가능",
  rented: "대여 중",
  repair: "수리 중",
  lost: "분실",
  retired: "불용품",
};

const categoryLabel: Record<NonNullable<Asset["category"]>, string> = {
  sound: "음향",
  video: "영상",
  kitchen: "조리",
  furniture: "가구",
  etc: "기타",
};

export default function AssetsListClient() {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Asset["status"] | "">("");
  const [viewMode, setViewMode] = useState<ListViewMode>("grid");

  // React Query를 사용한 데이터 페칭
  const { data: assets = [], isLoading: assetsLoading, error: assetsError } = useAssets();
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  const { data: policyData } = useApprovalPolicies(userProfile?.orgId ?? null);

  // Policy labels 계산
  const policyLabels = useMemo(() => {
    if (!policyData || !assets.length) return {};

    const labelMap: Record<string, string> = {};
    const roleLabel: Record<string, string> = {
      admin: "관리자",
      manager: "부서 관리자",
      user: "일반 사용자",
    };

    assets.forEach((asset) => {
      const department =
        asset.owner_scope === "organization"
          ? null
          : asset.owner_department;
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
      labelMap[asset.id] = roleLabel[requiredRole] ?? "부서 관리자";
    });

    return labelMap;
  }, [policyData, assets]);

  const loading = assetsLoading || profileLoading;
  const hasOrganization = Boolean(userProfile?.orgId);
  const isManager = userProfile?.isManager ?? false;
  const message = assetsError ? assetsError.message : null;

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesQuery =
        normalized.length === 0 ||
        asset.name.toLowerCase().includes(normalized) ||
        asset.owner_department.toLowerCase().includes(normalized) ||
        (asset.tags ?? []).some((tag) =>
          tag.toLowerCase().includes(normalized)
        );
      const matchesCategory =
        !category || asset.category === (category as Asset["category"]);
      
      // 상태 필터링
      // status가 "available"일 때는 실제 대여 가능한 자산만 표시 (loanable !== false && mobility !== "fixed")
      let matchesStatus = true;
      if (status === "available") {
        const isActuallyLoanable = 
          asset.status === "available" && 
          asset.loanable !== false && 
          asset.mobility !== "fixed";
        matchesStatus = isActuallyLoanable;
      } else if (status) {
        matchesStatus = asset.status === status;
      }
      
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [assets, query, category, status]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setStatus("");
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="물품"
        description="부서별 물품을 검색하고 대여를 신청할 수 있습니다."
        actions={
          isManager && hasOrganization === true ? (
            <button
              type="button"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="btn-primary whitespace-nowrap"
            >
              {showRegisterForm ? "목록 보기" : "물품 등록"}
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_auto]">
            <input
              className="form-input"
              placeholder="자산명, 부서, 태그로 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="form-select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

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
        <SectionCard title="물품 등록">
          <AssetForm />
        </SectionCard>
      )}

      {loading || hasOrganization === null ? (
        <Notice className="p-10">
          자산 목록을 불러오는 중입니다.
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
      ) : filteredAssets.length === 0 ? (
        <Notice className="p-10">
          <p>조건에 맞는 자산이 없습니다.</p>
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
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  requiredRoleLabel={policyLabels[asset.id]}
                />
              ))}
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className="space-y-3">
              {filteredAssets.map((asset) => {
                const detailUrl = `/assets/${asset.short_id ?? asset.id}`;
                const firstImage =
                  asset.image_urls && asset.image_urls.length > 0
                    ? asset.image_urls[0]
                    : asset.image_url;

                return (
                  <div key={asset.id} className="surface-card p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
                      <Link
                        href={detailUrl}
                        className="group block md:w-56 md:shrink-0"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                          {firstImage ? (
                            <Image
                              src={firstImage}
                              alt={asset.name}
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
                      </Link>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={detailUrl}
                            className="line-clamp-1 text-lg font-semibold text-neutral-900 hover:text-slate-800"
                          >
                            {asset.name}
                          </Link>
                          <ResourceStatusBadge
                            status={asset.status}
                            label={statusLabel[asset.status]}
                          />
                        </div>

                        <div className="space-y-1 text-sm text-neutral-600">
                          <p>
                            {asset.model_name ? `모델 ${asset.model_name}` : "모델 미등록"}
                          </p>
                          <p>
                            {asset.category
                              ? `카테고리 ${categoryLabel[asset.category] ?? asset.category}`
                              : "카테고리 미등록"}
                          </p>
                          <p>
                            {asset.owner_scope === "organization"
                              ? "기관 공용"
                              : asset.owner_department || "소유 부서 미등록"}
                            {" · "}
                            {asset.location || "보관 위치 미등록"}
                          </p>
                        </div>

                        <Link
                          href={detailUrl}
                          className="btn-secondary mt-3 h-9 w-full max-w-32 px-3 text-sm font-semibold"
                        >
                          상세 보기
                        </Link>
                      </div>
                    </div>
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
