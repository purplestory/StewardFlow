"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import type { Asset } from "@/types/database";
import ImageSlider from "@/components/common/ImageSlider";
import type { AssetReservationSummary } from "@/actions/booking-actions";
import { listApprovalPoliciesByOrg } from "@/actions/approval-actions";
import AssetReservationSection from "@/components/assets/AssetReservationSection";
import AssetAdminActions from "@/components/assets/AssetAdminActions";
import AssetTransferRequest from "@/components/assets/AssetTransferRequest";
import AssetTransferRequestsPanel from "@/components/assets/AssetTransferRequestsPanel";
import { useAsset, useAssetReservations, useUserRole, useUserProfile, useApprovalPolicies } from "@/hooks/useAssets";

const statusLabel: Record<AssetReservationSummary["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};
const assetStatusLabel: Record<
  "available" | "rented" | "repair" | "lost" | "retired",
  string
> = {
  available: "대여 가능",
  rented: "대여 중",
  repair: "수리 중",
  lost: "분실",
  retired: "불용품",
};
const mobilityLabel: Record<"fixed" | "movable", string> = {
  fixed: "고정",
  movable: "이동",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AssetDetailClient() {
  const params = useParams();
  const id = params.id as string;

  // React Query를 사용한 데이터 페칭
  const { data: asset, isLoading: assetLoading, error: assetError } = useAsset(id);
  const { data: reservations = [] } = useAssetReservations(asset?.id ?? null);
  const { data: userRoleData } = useUserRole();
  const { data: userProfile } = useUserProfile();
  const { data: policyData } = useApprovalPolicies(asset?.organization_id ?? null);

  // Required role 계산
  const requiredRole = useMemo(() => {
    if (!policyData || !asset) return "manager" as const;

    const department =
      asset.owner_scope === "organization" ? null : asset.owner_department;
    const exactPolicy = policyData.find(
      (policy) => policy.department === department
    );
    const fallbackPolicy = policyData.find(
      (policy) => policy.department === null
    );
    return (
      (exactPolicy?.required_role ??
        fallbackPolicy?.required_role ??
        "manager") as "admin" | "manager" | "user"
    );
  }, [policyData, asset]);

  const loading = assetLoading;
  const userRole = userRoleData?.role ?? null;
  const userDepartment = userRoleData?.department ?? null;

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
      </section>
    );
  }

  if (assetError || !asset) {
    notFound();
  }

  const usableUntilLabel = asset.usable_until
    ? formatDate(asset.usable_until)
    : "미등록";
  const loanableLabel = asset.loanable === false ? "대여 불가" : "대여 가능";
  const purchaseDateLabel = asset.purchase_date
    ? formatDate(asset.purchase_date)
    : "미등록";
  const purchasePriceLabel = asset.purchase_price
    ? `${asset.purchase_price.toLocaleString("ko-KR")}원`
    : "미등록";
  const usefulLifeLabel = asset.useful_life_years
    ? `${asset.useful_life_years}년`
    : "미등록";
  const lastUsedLabel = asset.last_used_at
    ? formatDateTime(asset.last_used_at)
    : "미등록";
  const tags = asset.tags ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 md:flex-row">
        {/* 이미지 섹션 - 모바일에서는 위에, 데스크톱에서는 왼쪽 */}
        <div className="w-full md:w-1/2">
          <ImageSlider
            images={
              (asset.image_urls && asset.image_urls.length > 0)
                ? asset.image_urls
                : asset.image_url
                ? [asset.image_url]
                : []
            }
            alt={asset.name}
          />
        </div>
        
        {/* 텍스트 정보 섹션 - 모바일에서는 아래에, 데스크톱에서는 오른쪽 */}
        <div className="w-full space-y-4 md:w-1/2">
          {/* 상태 뱃지 - 제목 위에 표시 */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                asset.status === "available"
                  ? // 대여 불가 설정이거나 고정 설치된 경우는 다른 색상으로 표시
                    (asset.loanable === false || asset.mobility === "fixed")
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-500 text-white"
                  : asset.status === "rented"
                  ? "bg-blue-500 text-white"
                  : asset.status === "repair"
                  ? "bg-amber-500 text-white"
                  : asset.status === "lost"
                  ? "bg-rose-500 text-white"
                  : asset.status === "retired"
                  ? "bg-neutral-600 text-white"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {asset.status === "available" && 
               (asset.loanable === false || asset.mobility === "fixed")
                ? "대여 불가"
                : assetStatusLabel[asset.status]}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-neutral-900 break-words">{asset.name}</h1>
              {asset.model_name && (
                <p className="text-sm text-neutral-500 mt-1">{asset.model_name}</p>
              )}
            </div>
            {(() => {
              // Admin은 항상 수정 가능
              if (userRole === "admin") {
                return (
                  <Link
                    href={`/assets/${asset.short_id || asset.id}/edit`}
                    className="btn-secondary w-full md:w-auto"
                  >
                    수정
                  </Link>
                );
              }
              // Manager는 자신의 부서 소유이거나 기관 공용인 경우 수정 가능
              if (userRole === "manager") {
                const canEdit = 
                  asset.owner_scope === "organization" ||
                  (asset.owner_scope === "department" && asset.owner_department === userDepartment);
                if (canEdit) {
                  return (
                    <Link
                      href={`/assets/${asset.short_id || asset.id}/edit`}
                      className="btn-secondary w-full md:w-auto"
                    >
                      수정
                    </Link>
                  );
                }
              }
              return null;
            })()}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                소유 부서
              </span>
              <span className="text-sm text-neutral-600">
                {asset.owner_scope === "organization" ? "기관 공용" : asset.owner_department}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                설치(보관) 장소
              </span>
              <span className="text-sm text-neutral-600">
                {asset.location || "미등록"}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                수량
              </span>
              <span className="text-sm text-neutral-600">{asset.quantity}</span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                설치 형태
              </span>
              <span className="text-sm text-neutral-600">
                {asset.mobility
                  ? mobilityLabel[asset.mobility]
                  : mobilityLabel.movable}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                사용 기한
              </span>
              <span className="text-sm text-neutral-600">{usableUntilLabel}</span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                구입일
              </span>
              <span className="text-sm text-neutral-600">{purchaseDateLabel}</span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                구입 금액
              </span>
              <span className="text-sm text-neutral-600">{purchasePriceLabel}</span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                사용 수명
              </span>
              <span className="text-sm text-neutral-600">{usefulLifeLabel}</span>
            </div>
            
            {asset.last_used_at && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  최종 사용
                </span>
                <span className="text-sm text-neutral-600">{lastUsedLabel}</span>
              </div>
            )}
          </div>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <AssetReservationSection
        assetId={asset.id}
        reservations={reservations}
        assetStatus={asset.status}
        requiredRole={requiredRole}
      />

      <AssetAdminActions
        assetId={asset.id}
        assetStatus={asset.status}
        ownerScope={asset.owner_scope}
        ownerDepartment={asset.owner_department}
      />

      <AssetTransferRequest
        assetId={asset.id}
        organizationId={asset.organization_id}
        assetStatus={asset.status}
        ownerDepartment={asset.owner_department}
        assetName={asset.name}
      />

      <AssetTransferRequestsPanel
        assetId={asset.id}
        assetName={asset.name}
        ownerDepartment={asset.owner_department}
        ownerScope={asset.owner_scope}
      />
    </section>
  );
}

const resolveRequiredRole = (
  policies: Array<{ department: string | null; required_role: string }>,
  ownerScope: "organization" | "department",
  department: string
) => {
  const targetDepartment = ownerScope === "organization" ? null : department;
  const exactPolicy = policies.find(
    (policy) => policy.department === targetDepartment
  );
  const fallbackPolicy = policies.find((policy) => policy.department === null);
  return (exactPolicy?.required_role ??
    fallbackPolicy?.required_role ??
    "manager") as "admin" | "manager" | "user";
};
