"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import type { Asset } from "@/types/database";
import AssetCard from "@/components/assets/AssetCard";
import AssetForm from "@/components/assets/AssetForm";
import { useAssets, useUserProfile, useApprovalPolicies } from "@/hooks/useAssets";

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

export default function AssetsListClient() {
  const queryClient = useQueryClient();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Asset["status"] | "">("");

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">물품</h1>
            <p className="mt-2 text-sm text-neutral-600">
              부서별 물품을 검색하고 대여를 신청할 수 있습니다.
            </p>
          </div>
          {isManager && hasOrganization === true && (
            <button
              type="button"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {showRegisterForm ? "목록 보기" : "물품 등록"}
            </button>
          )}
        </div>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
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
                    setCategory("");
                    setStatus("");
                  } else {
                    setStatus(option.value as Asset["status"] | "");
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
                      : option.value === "retired"
                      ? "bg-neutral-600 text-white"
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
          <h2 className="mb-4 text-lg font-semibold">물품 등록</h2>
          <AssetForm />
        </div>
      )}

      {loading || hasOrganization === null ? (
        <Notice className="rounded-xl bg-white p-10">
          자산 목록을 불러오는 중입니다.
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
      ) : filteredAssets.length === 0 ? (
        <Notice className="rounded-xl bg-white p-10">
          <p>조건에 맞는 자산이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("");
              setStatus("");
            }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              requiredRoleLabel={policyLabels[asset.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
