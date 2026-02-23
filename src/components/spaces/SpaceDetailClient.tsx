"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import type { Space } from "@/types/database";
import SpaceReservationSection from "@/components/spaces/SpaceReservationSection";
import ImageSlider from "@/components/common/ImageSlider";
import {
  useSpace,
  useSpaceReservations,
  useSpaceApprovalPolicies,
} from "@/hooks/useSpaces";
import { useUserRole } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import ResourceInfoGrid, {
  type ResourceInfoItem,
} from "@/components/ui/ResourceDetailInfo";

const statusLabel: Record<Space["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "사용 불가",
  lost: "사용 불가",
};

function formatReservationPolicy(space: Space) {
  const minLabel = space.min_reservation_minutes
    ? `최소 ${space.min_reservation_minutes}분`
    : "최소 제한 없음";
  const maxLabel =
    space.max_reservation_minutes && space.max_reservation_minutes > 0
      ? `최대 ${space.max_reservation_minutes}분`
      : "최대 제한 없음";
  const bufferLabel =
    space.reservation_buffer_minutes > 0
      ? `버퍼 ${space.reservation_buffer_minutes}분`
      : "버퍼 없음";

  return `${minLabel} · ${maxLabel} · ${bufferLabel}`;
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

export default function SpaceDetailClient() {
  const params = useParams();
  const id = params.id as string;

  const { data: space, isLoading: spaceLoading, error: spaceError } = useSpace(id);
  const { data: reservations = [] } = useSpaceReservations(space?.id ?? null);
  const { data: userRoleData } = useUserRole();
  const { data: policyData } = useSpaceApprovalPolicies(space?.organization_id ?? null);

  const requiredRole = useMemo(() => {
    if (!policyData || !space) return "manager" as const;

    const department = space.owner_scope === "organization" ? null : space.owner_department;
    const exactPolicy = policyData.find((policy) => policy.department === department);
    const fallbackPolicy = policyData.find((policy) => policy.department === null);

    return (
      (exactPolicy?.required_role ?? fallbackPolicy?.required_role ?? "manager") as
        | "admin"
        | "manager"
        | "user"
    );
  }, [policyData, space]);

  const userRole = userRoleData?.role ?? null;
  const userDepartment = userRoleData?.department ?? null;

  if (spaceLoading) {
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

  const canEdit =
    userRole === "admin" ||
    (userRole === "manager" &&
      (space.owner_scope === "organization" || space.owner_department === userDepartment));

  const editHref = canEdit ? `/spaces/${space.short_id || space.id}/edit` : null;

  const infoItems: ResourceInfoItem[] = [
    {
      label: "소유 부서",
      value:
        space.owner_scope === "organization"
          ? "기관 공용"
          : space.owner_department || "미등록",
    },
    {
      label: "위치",
      value: space.location || "미등록",
    },
    {
      label: "수용 인원",
      value: space.capacity ?? "미등록",
    },
    {
      label: "비고",
      value: space.note || "미등록",
      multiline: true,
    },
    {
      label: "예약 정책",
      value: formatReservationPolicy(space),
    },
  ];

  return (
    <section className="space-y-6">
      <PageHero
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{space.name}</span>
            <ResourceStatusBadge
              status={space.status as "available" | "rented" | "repair" | "lost"}
              label={statusLabel[space.status]}
            />
          </div>
        }
        description={`위치: ${space.location || "미등록"} · 수용 인원: ${
          space.capacity ? `${space.capacity}명` : "미등록"
        }`}
        actions={
          editHref ? (
            <Link
              href={editHref}
              className="btn-secondary h-9 gap-1.5 px-3 text-sm"
              title="수정"
              aria-label="수정"
            >
              <EditIcon />
              <span>수정</span>
            </Link>
          ) : undefined
        }
      />

      <SectionCard bodyClassName="p-5 md:p-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full md:w-1/2">
            <ImageSlider
              images={
                space.image_urls && space.image_urls.length > 0
                  ? space.image_urls
                  : space.image_url
                    ? [space.image_url]
                    : []
              }
              alt={space.name}
            />
          </div>

          <div className="w-full space-y-4 md:w-1/2">
            <ResourceInfoGrid items={infoItems} />
          </div>
        </div>
      </SectionCard>

      <SpaceReservationSection
        spaceId={space.id}
        reservations={reservations}
        spaceStatus={space.status}
        requiredRole={requiredRole}
        minReservationMinutes={space.min_reservation_minutes}
        maxReservationMinutes={space.max_reservation_minutes}
        reservationBufferMinutes={space.reservation_buffer_minutes ?? 0}
      />
    </section>
  );
}
