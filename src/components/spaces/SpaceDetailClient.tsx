"use client";

import { useMemo } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import type { Space } from "@/types/database";
import type { SpaceReservationSummary } from "@/actions/booking-actions";
import SpaceReservationSection from "@/components/spaces/SpaceReservationSection";
import ImageSlider from "@/components/common/ImageSlider";
import { useSpace, useSpaceReservations, useSpaceApprovalPolicies } from "@/hooks/useSpaces";
import { useUserRole } from "@/hooks/useAssets";

const statusLabel: Record<SpaceReservationSummary["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

export default function SpaceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // React Query를 사용한 데이터 페칭
  const { data: space, isLoading: spaceLoading, error: spaceError } = useSpace(id);
  const { data: reservations = [] } = useSpaceReservations(space?.id ?? null);
  const { data: userRoleData } = useUserRole();
  const { data: policyData } = useSpaceApprovalPolicies(space?.organization_id ?? null);

  // Required role 계산
  const requiredRole = useMemo(() => {
    if (!policyData || !space) return "manager" as const;

    const department =
      space.owner_scope === "organization" ? null : space.owner_department;
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
  }, [policyData, space]);

  const loading = spaceLoading;
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

  if (spaceError || !space) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 md:flex-row">
        {/* 이미지 섹션 - 모바일에서는 위에, 데스크톱에서는 왼쪽 */}
        <div className="w-full md:w-1/2">
          <ImageSlider
            images={
              (space.image_urls && space.image_urls.length > 0)
                ? space.image_urls
                : space.image_url
                ? [space.image_url]
                : []
            }
            alt={space.name}
          />
        </div>
        
        {/* 텍스트 정보 섹션 - 모바일에서는 아래에, 데스크톱에서는 오른쪽 */}
        <div className="w-full space-y-4 md:w-1/2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-neutral-900">{space.name}</h1>
            {(() => {
              // Admin은 항상 수정 가능
              if (userRole === "admin") {
                return (
                  <Link
                    href={`/spaces/${space.short_id || space.id}/edit`}
                    className="btn-secondary"
                  >
                    수정
                  </Link>
                );
              }
              // Manager는 자신의 부서 소유이거나 기관 공용인 경우 수정 가능
              if (userRole === "manager") {
                const canEdit = 
                  space.owner_scope === "organization" ||
                  (space.owner_scope === "department" && space.owner_department === userDepartment);
                if (canEdit) {
                  return (
                    <Link
                      href={`/spaces/${space.short_id || space.id}/edit`}
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
                {space.owner_scope === "organization" ? "기관 공용" : space.owner_department}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                위치
              </span>
              <span className="text-sm text-neutral-600">
                {space.location || "미등록"}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                상태
              </span>
              <span className="text-sm text-neutral-600">
                {space.status === "available" ? "사용 가능" : 
                 space.status === "rented" ? "예약 중" :
                 space.status === "repair" ? "사용 불가" : "사용 불가"}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                수용 인원
              </span>
              <span className="text-sm text-neutral-600">
                {space.capacity ?? "미등록"}
              </span>
            </div>
            
            {space.note && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  비고
                </span>
                <span className="text-sm text-neutral-600 whitespace-pre-wrap">
                  {space.note}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <SpaceReservationSection
        spaceId={space.id}
        reservations={reservations}
        spaceStatus={space.status}
        requiredRole={requiredRole}
      />
    </section>
  );
}
