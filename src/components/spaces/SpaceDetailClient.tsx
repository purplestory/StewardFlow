"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import type { Space } from "@/types/database";
import SpaceReservationSection from "@/components/spaces/SpaceReservationSection";
import ImageSlider from "@/components/common/ImageSlider";
import { useSpace, useSpaceReservations, useSpaceApprovalPolicies } from "@/hooks/useSpaces";
import { useUserRole } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

const statusLabel: Record<Space["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "사용 불가",
  lost: "사용 불가",
};

export default function SpaceDetailClient() {
  const params = useParams();
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
        <SectionCard>
          <p className="text-center text-neutral-500">로딩 중...</p>
        </SectionCard>
      </section>
    );
  }

  if (spaceError || !space) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <PageHero
        title="공간 상세"
        description="공간 정보와 예약 현황을 확인할 수 있습니다."
      />

      <SectionCard bodyClassName="p-6">
        <div className="flex flex-col gap-6 md:flex-row">
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
            {/* 상태 뱃지 - 제목 위에 표시 */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                  space.status === "available"
                    ? "bg-emerald-500 text-white"
                    : space.status === "rented"
                    ? "bg-blue-500 text-white"
                    : space.status === "repair"
                    ? "bg-amber-500 text-white"
                    : space.status === "lost"
                    ? "bg-rose-500 text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {statusLabel[space.status]}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h1 className="break-words text-2xl font-bold text-neutral-900">{space.name}</h1>
                </div>
                {(() => {
                  if (userRole === "admin") {
                    return (
                      <Link
                        href={`/spaces/${space.short_id || space.id}/edit`}
                        className="icon-button"
                        title="수정"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </Link>
                  );
                }
                  if (userRole === "manager") {
                    const canEdit =
                      space.owner_scope === "organization" ||
                      (space.owner_scope === "department" &&
                        space.owner_department === userDepartment);
                    if (canEdit) {
                      return (
                        <Link
                          href={`/spaces/${space.short_id || space.id}/edit`}
                          className="icon-button"
                          title="수정"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                            />
                          </svg>
                        </Link>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                  소유 부서
                </span>
                <span className="text-sm text-neutral-600">
                  {space.owner_scope === "organization" ? "기관 공용" : space.owner_department}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                  위치
                </span>
                <span className="text-sm text-neutral-600">
                  {space.location || "미등록"}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                  수용 인원
                </span>
                <span className="text-sm text-neutral-600">
                  {space.capacity ?? "미등록"}
                </span>
              </div>

              {space.note ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-neutral-700">비고</span>
                  <div className="w-full break-words whitespace-pre-wrap text-sm text-neutral-600">
                    {space.note}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      <SpaceReservationSection
        spaceId={space.id}
        reservations={reservations}
        spaceStatus={space.status}
        requiredRole={requiredRole}
      />
    </section>
  );
}
