"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import type { Vehicle } from "@/types/database";
import VehicleReservationSection from "@/components/vehicles/VehicleReservationSection";
import ImageSlider from "@/components/common/ImageSlider";
import {
  useVehicle,
  useVehicleReservations,
  useVehicleApprovalPolicies,
} from "@/hooks/useVehicles";
import { useUserRole } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import ResourceInfoGrid, {
  type ResourceInfoItem,
} from "@/components/ui/ResourceDetailInfo";

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

export default function VehicleDetailClient() {
  const params = useParams();
  const id = params.id as string;

  const { data: vehicle, isLoading: vehicleLoading, error: vehicleError } = useVehicle(id);
  const { data: reservations = [] } = useVehicleReservations(vehicle?.id ?? null);
  const { data: userRoleData } = useUserRole();
  const { data: policyData } = useVehicleApprovalPolicies(vehicle?.organization_id ?? null);

  const requiredRole = useMemo(() => {
    if (!policyData || !vehicle) return "manager" as const;

    const department = vehicle.owner_scope === "organization" ? null : vehicle.owner_department;
    const exactPolicy = policyData.find((policy) => policy.department === department);
    const fallbackPolicy = policyData.find((policy) => policy.department === null);

    return (
      (exactPolicy?.required_role ?? fallbackPolicy?.required_role ?? "manager") as
        | "admin"
        | "manager"
        | "user"
    );
  }, [policyData, vehicle]);

  const userRole = userRoleData?.role ?? null;
  const userDepartment = userRoleData?.department ?? null;

  if (vehicleLoading) {
    return (
      <section className="space-y-6">
        <SectionCard>
          <p className="text-center text-neutral-500">로딩 중...</p>
        </SectionCard>
      </section>
    );
  }

  if (vehicleError || !vehicle) {
    notFound();
  }

  const vehicleStatusLabel: Record<Vehicle["status"], string> = {
    available: "사용 가능",
    rented: "예약 중",
    repair: "사용 불가",
    lost: "사용 불가",
  };

  const canEdit =
    userRole === "admin" ||
    (userRole === "manager" &&
      (vehicle.owner_scope === "organization" || vehicle.owner_department === userDepartment));

  const editHref = canEdit ? `/vehicles/${vehicle.short_id || vehicle.id}/edit` : null;

  const infoItems: ResourceInfoItem[] = [
    {
      label: "소유 부서",
      value:
        vehicle.owner_scope === "organization"
          ? "기관 공용"
          : vehicle.owner_department || "미등록",
    },
    {
      label: "번호판",
      value: vehicle.license_plate || "미등록",
    },
    {
      label: "차종",
      value: vehicle.vehicle_type || "미등록",
    },
    {
      label: "연료 타입",
      value: vehicle.fuel_type || "미등록",
    },
    {
      label: "주차 장소",
      value: vehicle.location || "미등록",
    },
    {
      label: "탑승 인원",
      value: vehicle.capacity ? `${vehicle.capacity}명` : "미등록",
    },
    {
      label: "현재 주행거리",
      value:
        vehicle.current_odometer !== null
          ? `${vehicle.current_odometer.toLocaleString()} km`
          : "미등록",
    },
    {
      label: "비고",
      value: vehicle.note || "미등록",
      multiline: true,
    },
  ];

  return (
    <section className="space-y-6">
      <PageHero
        backHref="/vehicles"
        backLabel="차량 목록"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{vehicle.name}</span>
            <ResourceStatusBadge
              status={vehicle.status as "available" | "rented" | "repair" | "lost"}
              label={vehicleStatusLabel[vehicle.status]}
            />
          </div>
        }
        description={`주차 위치: ${vehicle.location || "미등록"} · 번호판: ${
          vehicle.license_plate || "미등록"
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
                vehicle.image_urls && vehicle.image_urls.length > 0
                  ? vehicle.image_urls
                  : vehicle.image_url
                    ? [vehicle.image_url]
                    : []
              }
              alt={vehicle.name}
            />
          </div>

          <div className="w-full space-y-4 md:w-1/2">
            <ResourceInfoGrid items={infoItems} />
          </div>
        </div>
      </SectionCard>

      <VehicleReservationSection
        vehicleId={vehicle.id}
        reservations={reservations}
        vehicleStatus={vehicle.status}
        requiredRole={requiredRole}
      />
    </section>
  );
}
