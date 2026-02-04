"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Asset } from "@/types/database";
import ImageSlider from "@/components/common/ImageSlider";
import {
  listReservationsByAsset,
  type AssetReservationSummary,
} from "@/actions/booking-actions";
import { listApprovalPoliciesByOrg } from "@/actions/approval-actions";
import AssetReservationSection from "@/components/assets/AssetReservationSection";
import AssetAdminActions from "@/components/assets/AssetAdminActions";
import AssetTransferRequest from "@/components/assets/AssetTransferRequest";
import AssetTransferRequestsPanel from "@/components/assets/AssetTransferRequestsPanel";

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
  const [asset, setAsset] = useState<Asset | null>(null);
  const [reservations, setReservations] = useState<AssetReservationSummary[]>([]);
  const [requiredRole, setRequiredRole] = useState<"admin" | "manager" | "user">("manager");
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAsset = async () => {
      if (!id || typeof id !== "string") {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const supabaseClient = supabase;

        // Check if id is UUID or short_id
        const isUuid = isUUID(id);
        
        let query = supabaseClient
          .from("assets")
          .select("*")
          .is("deleted_at", null);
        
        if (isUuid) {
          query = query.eq("id", id);
        } else {
          query = query.eq("short_id", id);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Error fetching asset:", error);
          // If short_id lookup failed and it's not a UUID, try UUID as fallback
          if (!isUuid) {
            const { data: fallbackData, error: fallbackError } = await supabaseClient
              .from("assets")
              .select("*")
              .is("deleted_at", null)
              .eq("id", id)
              .maybeSingle();
            
            if (!fallbackError && fallbackData) {
              if (isMounted) {
                setAsset(fallbackData as Asset);
                // Load reservations and approval policies
                const res = await listReservationsByAsset(fallbackData.id);
                const policies = await listApprovalPoliciesByOrg(
                  "asset",
                  fallbackData.organization_id
                );
                const role = resolveRequiredRole(
                  policies,
                  fallbackData.owner_scope,
                  fallbackData.owner_department
                );
                setReservations(res);
                setRequiredRole(role);
                
                // Load current user role and department
                const { data: sessionData } = await supabase.auth.getSession();
                const user = sessionData.session?.user;
                if (user) {
                  const { data: profileData } = await supabase
                    .from("profiles")
                    .select("role,department")
                    .eq("id", user.id)
                    .maybeSingle();
                  if (profileData?.role) {
                    setUserRole(profileData.role as "admin" | "manager" | "user");
                    setUserDepartment(profileData.department ?? null);
                  }
                }
                
                setLoading(false);
              }
              return;
            }
          }
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        if (!data) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setAsset(data as Asset);
          // Load reservations and approval policies
          const res = await listReservationsByAsset(data.id);
          const policies = await listApprovalPoliciesByOrg(
            "asset",
            data.organization_id
          );
          const role = resolveRequiredRole(
            policies,
            data.owner_scope,
            data.owner_department
          );
          setReservations(res);
          setRequiredRole(role);
          
          // Load current user role and department
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData.session?.user;
          if (user) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("role,department")
              .eq("id", user.id)
              .maybeSingle();
            if (profileData?.role) {
              setUserRole(profileData.role as "admin" | "manager" | "user");
              setUserDepartment(profileData.department ?? null);
            }
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading asset:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAsset();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
      </section>
    );
  }

  if (!asset) {
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

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-neutral-900">{asset.name}</h1>
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
                    className="btn-secondary"
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
                      className="btn-secondary"
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

      <AssetAdminActions asset={asset} />

      <AssetTransferRequest asset={asset} />

      <AssetTransferRequestsPanel assetId={asset.id} />
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
