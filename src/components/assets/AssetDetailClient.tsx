"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import ImageSlider from "@/components/common/ImageSlider";
import AssetReservationSection from "@/components/assets/AssetReservationSection";
import AssetAdminActions from "@/components/assets/AssetAdminActions";
import AssetTransferRequest from "@/components/assets/AssetTransferRequest";
import {
  useAsset,
  useAssetReservations,
  useUserRole,
  useApprovalPolicies,
} from "@/hooks/useAssets";
import Notice from "@/components/common/Notice";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import ResourceInfoGrid, {
  type ResourceInfoItem,
} from "@/components/ui/ResourceDetailInfo";

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

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

export default function AssetDetailClient() {
  const params = useParams();
  const id = (params?.id as string) || null;

  if (!id) {
    notFound();
  }

  const { data: asset, isLoading: assetLoading, error: assetError } = useAsset(id);
  const { data: reservations = [] } = useAssetReservations(asset?.id ?? null);
  const { data: userRoleData } = useUserRole();
  const { data: policyData } = useApprovalPolicies(asset?.organization_id ?? null);

  const requiredRole = useMemo(() => {
    if (!policyData || !asset) return "manager" as const;

    const department = asset.owner_scope === "organization" ? null : asset.owner_department;
    const exactPolicy = policyData.find((policy) => policy.department === department);
    const fallbackPolicy = policyData.find((policy) => policy.department === null);

    return (
      (exactPolicy?.required_role ?? fallbackPolicy?.required_role ?? "manager") as
        | "admin"
        | "manager"
        | "user"
    );
  }, [policyData, asset]);

  const userRole = userRoleData?.role ?? null;
  const userDepartment = userRoleData?.department ?? null;

  if (assetLoading) {
    return (
      <section className="space-y-6">
        <SectionCard>
          <p className="text-center text-neutral-500">로딩 중...</p>
        </SectionCard>
      </section>
    );
  }

  if (assetError) {
    console.error("Asset detail error:", assetError);
    return (
      <section className="space-y-6">
        <Notice variant="error">
          <p className="text-center text-red-600">
            물품 정보를 불러오는 중 오류가 발생했습니다.
            {assetError instanceof Error && ` (${assetError.message})`}
          </p>
        </Notice>
      </section>
    );
  }

  if (!asset) {
    notFound();
  }

  const canEdit =
    userRole === "admin" ||
    (userRole === "manager" &&
      (asset.owner_scope === "organization" || asset.owner_department === userDepartment));

  const editHref = canEdit ? `/assets/${asset.short_id || asset.id}/edit` : null;

  const isUnavailableConfig =
    asset.status === "available" && (asset.loanable === false || asset.mobility === "fixed");

  const statusLabel = isUnavailableConfig ? "대여 불가" : assetStatusLabel[asset.status];
  const statusTone = isUnavailableConfig ? "repair" : asset.status;

  const usableUntilLabel = asset.usable_until ? formatDate(asset.usable_until) : "미등록";
  const purchaseDateLabel = asset.purchase_date ? formatDate(asset.purchase_date) : "미등록";
  const purchasePriceLabel = asset.purchase_price
    ? `${asset.purchase_price.toLocaleString("ko-KR")}원`
    : "미등록";
  const usefulLifeLabel = asset.useful_life_years ? `${asset.useful_life_years}년` : "미등록";
  const lastUsedLabel = asset.last_used_at ? formatDateTime(asset.last_used_at) : "미등록";

  const infoItems: ResourceInfoItem[] = [
    {
      label: "소유 범위",
      value: asset.owner_scope === "organization" ? "기관 공용" : "부서 소유",
    },
    {
      label: "소유 부서",
      value: asset.owner_department || "미등록",
      hidden: asset.owner_scope !== "department",
    },
    {
      label: "설치(보관) 장소",
      value: asset.location || "미등록",
    },
    {
      label: "수량",
      value: asset.quantity,
    },
    {
      label: "설치 형태",
      value: asset.mobility ? mobilityLabel[asset.mobility] : mobilityLabel.movable,
    },
    {
      label: "사용 기한",
      value: usableUntilLabel,
    },
    {
      label: "구입일",
      value: purchaseDateLabel,
    },
    {
      label: "구입 금액",
      value: purchasePriceLabel,
    },
    {
      label: "사용 수명",
      value: usefulLifeLabel,
    },
    {
      label: "최종 사용",
      value: lastUsedLabel,
      hidden: !asset.last_used_at,
    },
  ];

  const tags = asset.tags ?? [];

  return (
    <section className="space-y-6">
      <PageHero
        title={
          <div className="space-y-2">
            <ResourceStatusBadge
              status={statusTone as "available" | "rented" | "repair" | "lost" | "retired"}
              label={statusLabel}
            />
            <span>{asset.name}</span>
          </div>
        }
        description={`보관 위치: ${asset.location || "미등록"} · 소유: ${
          asset.owner_scope === "organization" ? "기관 공용" : asset.owner_department || "미등록"
        }`}
      />

      <SectionCard bodyClassName="p-5 md:p-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full md:w-1/2">
            <ImageSlider
              images={
                asset.image_urls && asset.image_urls.length > 0
                  ? asset.image_urls
                  : asset.image_url
                    ? [asset.image_url]
                    : []
              }
              alt={asset.name}
            />
          </div>

          <div className="w-full space-y-4 md:w-1/2">
            {editHref ? (
              <div className="flex justify-end">
                <Link href={editHref} className="icon-button" title="수정" aria-label="수정">
                  <EditIcon />
                </Link>
              </div>
            ) : null}

            <ResourceInfoGrid items={infoItems} />

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="chip-muted">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

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
    </section>
  );
}
