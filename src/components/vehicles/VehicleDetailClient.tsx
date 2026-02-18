"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import type { Vehicle } from "@/types/database";
import VehicleReservationSection from "@/components/vehicles/VehicleReservationSection";
import ImageSlider from "@/components/common/ImageSlider";
import { useVehicle, useVehicleReservations, useVehicleApprovalPolicies } from "@/hooks/useVehicles";
import { useUserRole } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";

export default function VehicleDetailClient() {
  const params = useParams();
  const id = params.id as string;

  // React Query를 사용한 데이터 페칭
  const { data: vehicle, isLoading: vehicleLoading, error: vehicleError } = useVehicle(id);
  const { data: reservations = [] } = useVehicleReservations(vehicle?.id ?? null);
  const { data: userRoleData } = useUserRole();
  const { data: policyData } = useVehicleApprovalPolicies(vehicle?.organization_id ?? null);

  // Required role 계산
  const requiredRole = useMemo(() => {
    if (!policyData || !vehicle) return "manager" as const;

    const department =
      vehicle.owner_scope === "organization" ? null : vehicle.owner_department;
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
  }, [policyData, vehicle]);

  const loading = vehicleLoading;
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

  if (vehicleError || !vehicle) {
    notFound();
  }

  const vehicleStatusLabel: Record<Vehicle["status"], string> = {
    available: "사용 가능",
    rented: "예약 중",
    repair: "사용 불가",
    lost: "사용 불가",
  };

  return (
    <section className="space-y-6">
      <PageHero
        title="차량 상세"
        description="차량 정보와 예약 현황을 확인할 수 있습니다."
      />

      <SectionCard bodyClassName="p-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full md:w-1/2">
            <ImageSlider
              images={
                (vehicle.image_urls && vehicle.image_urls.length > 0)
                  ? vehicle.image_urls
                  : vehicle.image_url
                  ? [vehicle.image_url]
                  : []
              }
              alt={vehicle.name}
            />
          </div>

          <div className="w-full space-y-4 md:w-1/2">
            <div className="flex items-center gap-2">
              <ResourceStatusBadge
                status={vehicle.status as "available" | "rented" | "repair" | "lost"}
                label={vehicleStatusLabel[vehicle.status]}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h1 className="break-words text-2xl font-bold text-neutral-900">{vehicle.name}</h1>
                </div>
                {(() => {
                  if (userRole === "admin") {
                    return (
                      <Link
                        href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
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
                      vehicle.owner_scope === "organization" ||
                      (vehicle.owner_scope === "department" &&
                        vehicle.owner_department === userDepartment);
                    if (canEdit) {
                      return (
                        <Link
                          href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
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
                  {vehicle.owner_scope === "organization" ? "기관 공용" : vehicle.owner_department}
                </span>
              </div>

              {vehicle.license_plate ? (
                <div className="flex items-start gap-3">
                  <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                    번호판
                  </span>
                  <span className="text-sm text-neutral-600">
                    {vehicle.license_plate}
                  </span>
                </div>
              ) : null}

              {vehicle.vehicle_type ? (
                <div className="flex items-start gap-3">
                  <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                    차종
                  </span>
                  <span className="text-sm text-neutral-600">
                    {vehicle.vehicle_type}
                  </span>
                </div>
              ) : null}

              {vehicle.fuel_type ? (
                <div className="flex items-start gap-3">
                  <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                    연료 타입
                  </span>
                  <span className="text-sm text-neutral-600">
                    {vehicle.fuel_type}
                  </span>
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                  주차 장소
                </span>
                <span className="text-sm text-neutral-600">
                  {vehicle.location || "미등록"}
                </span>
              </div>

              {vehicle.capacity ? (
                <div className="flex items-start gap-3">
                  <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                    탑승 인원
                  </span>
                  <span className="text-sm text-neutral-600">
                    {vehicle.capacity}명
                  </span>
                </div>
              ) : null}

              {vehicle.current_odometer !== null ? (
                <div className="flex items-start gap-3">
                  <span className="min-w-[100px] text-sm font-semibold text-neutral-700">
                    현재 주행거리
                  </span>
                  <span className="text-sm text-neutral-600">
                    {vehicle.current_odometer.toLocaleString()} km
                  </span>
                </div>
              ) : null}

              {vehicle.note ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-neutral-700">비고</span>
                  <div className="w-full break-words whitespace-pre-wrap text-sm text-neutral-600">
                    {vehicle.note}
                  </div>
                </div>
              ) : null}
            </div>
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
