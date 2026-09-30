"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid, List } from "lucide-react";
import Notice from "@/components/common/Notice";
import type { Asset } from "@/types/database";
import AssetCard from "@/components/assets/AssetCard";
import AssetForm from "@/components/assets/AssetForm";
import {
  useAssets,
  useUserProfile,
  useApprovalPolicies,
  useAssetCategories,
} from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";

const defaultCategoryLabels: Record<string, string> = {
  sound: "음향",
  video: "영상",
  kitchen: "조리",
  furniture: "가구",
  etc: "기타",
};

const listViewOptions = [
  { value: "grid", label: "그리드", icon: LayoutGrid },
  { value: "list", label: "리스트", icon: List },
] as const;

type ListViewMode = (typeof listViewOptions)[number]["value"];

const statusLabel: Record<Asset["status"], string> = {
  available: "대여 가능",
  rented: "대여 중",
  repair: "수리 중",
  lost: "분실",
  retired: "불용품",
};

export default function AssetsListClient() {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [viewMode, setViewMode] = useState<ListViewMode>("grid");

  // React Query를 사용한 데이터 페칭
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  const { data: assetData, isLoading: assetsLoading, error: assetsError } = useAssets(Boolean(userProfile?.orgId));
  const assets = useMemo(() => userProfile?.orgId ? assetData ?? [] : [], [assetData, userProfile?.orgId]);
  const { data: policyData } = useApprovalPolicies(userProfile?.orgId ?? null);
  const { data: orgCategories = [] } = useAssetCategories(userProfile?.orgId ?? null);

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

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    map.set("", "전체");

    for (const option of orgCategories) {
      const value = option.value?.trim();
      if (!value) continue;
      map.set(value, option.label?.trim() || defaultCategoryLabels[value] || value);
    }

    for (const asset of assets) {
      const value = asset.category?.trim();
      if (!value || map.has(value)) continue;
      map.set(value, defaultCategoryLabels[value] || value);
    }

    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [assets, orgCategories]);

  const categoryLabelMap = useMemo(() => {
    return categoryOptions.reduce<Record<string, string>>((acc, option) => {
      if (!option.value) return acc;
      acc[option.value] = option.label;
      return acc;
    }, {});
  }, [categoryOptions]);

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
        !category || (asset.category ?? "") === category;

      return matchesQuery && matchesCategory;
    });
  }, [assets, query, category]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
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
              className="btn-primary w-full whitespace-nowrap sm:w-auto"
              aria-expanded={showRegisterForm}
            >
              {showRegisterForm ? "목록 보기" : "물품 등록"}
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="asset-search" className="sr-only">물품 검색</label>
            <input
              id="asset-search"
              type="search"
              className="form-input min-w-0 shrink-0 sm:flex-1"
              placeholder="자산명, 부서, 태그로 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div
              className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
              role="group"
              aria-label="목록 보기 방식"
            >
              {listViewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  aria-pressed={option.value === viewMode}
                  title={option.label}
                  aria-label={option.label}
                  className={
                    option.value === viewMode
                      ? "inline-flex h-8 flex-1 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm sm:flex-none"
                      : "inline-flex h-8 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium text-slate-600 hover:text-slate-950 sm:flex-none"
                  }
                >
                  <option.icon className="h-4 w-4" aria-hidden />
                  <span className="ml-2 sm:sr-only sm:ml-0">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tab-scroll" aria-label="물품 카테고리 필터">
            <div className="flex w-max items-center gap-2">
              {categoryOptions.map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  aria-pressed={option.value === category}
                  className={`filter-pill ${option.value === category ? "filter-pill-active" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
            <span aria-live="polite">{loading ? "목록 불러오는 중" : `총 ${filteredAssets.length}개`}</span>
            {query || category ? (
              <button type="button" onClick={clearFilters} className="font-semibold text-brand-primary hover:underline">
                필터 초기화
              </button>
            ) : null}
          </div>
        </div>
      </PageHero>

      {showRegisterForm && isManager && hasOrganization === true && (
        <SectionCard title="물품 등록">
          <AssetForm />
        </SectionCard>
      )}

      {loading ? (
        <Notice className="p-10">
          자산 목록을 불러오는 중입니다.
        </Notice>
      ) : !userProfile?.user ? (
        <Notice className="p-6">
          <p>로그인하면 기관의 물품 목록을 확인할 수 있습니다.</p>
          <Link href="/login" className="btn-primary mt-3">로그인</Link>
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
          <p>{query || category ? "조건에 맞는 물품이 없습니다." : "아직 등록된 물품이 없습니다."}</p>
          {query || category ? (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-ghost mt-3"
            >
              필터 초기화
            </button>
          ) : null}
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
                  <Link
                    key={asset.id}
                    href={detailUrl}
                    className="surface-card group block p-3 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:p-4"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-24 shrink-0 sm:w-36 md:w-44">
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 sm:aspect-[4/3]">
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
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="line-clamp-1 text-base font-semibold text-neutral-900 transition-colors group-hover:text-slate-800 sm:text-lg">
                            {asset.name}
                          </h3>
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
                              ? `카테고리 ${categoryLabelMap[asset.category] ?? asset.category}`
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
