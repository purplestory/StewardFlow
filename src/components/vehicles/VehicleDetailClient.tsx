"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import type { Vehicle, VehicleReservationSummary } from "@/types/database";
import VehicleReservationSection from "@/components/vehicles/VehicleReservationSection";
import ImageSlider from "@/components/common/ImageSlider";
import { useVehicle, useVehicleReservations, useVehicleApprovalPolicies } from "@/hooks/useVehicles";
import { useUserRole } from "@/hooks/useAssets";

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
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
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
      <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 md:flex-row">
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
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-neutral-900">{vehicle.name}</h1>
            {(() => {
              // Admin은 항상 수정 가능
              if (userRole === "admin") {
                return (
                  <Link
                    href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
                    className="btn-secondary"
                  >
                    수정
                  </Link>
                );
              }
              // Manager는 자신의 부서 소유이거나 기관 공용인 경우 수정 가능
              if (userRole === "manager") {
                const canEdit = 
                  vehicle.owner_scope === "organization" ||
                  (vehicle.owner_scope === "department" && vehicle.owner_department === userDepartment);
                if (canEdit) {
                  return (
                    <Link
                      href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
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
                {vehicle.owner_scope === "organization" ? "기관 공용" : vehicle.owner_department}
              </span>
            </div>
            
            {vehicle.license_plate && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  번호판
                </span>
                <span className="text-sm text-neutral-600">
                  {vehicle.license_plate}
                </span>
              </div>
            )}
            
            {vehicle.vehicle_type && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  차종
                </span>
                <span className="text-sm text-neutral-600">
                  {vehicle.vehicle_type}
                </span>
              </div>
            )}
            
            {vehicle.fuel_type && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  연료 타입
                </span>
                <span className="text-sm text-neutral-600">
                  {vehicle.fuel_type}
                </span>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                주차 장소
              </span>
              <span className="text-sm text-neutral-600">
                {vehicle.location || "미등록"}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                상태
              </span>
              <span className="text-sm text-neutral-600">
                {vehicleStatusLabel[vehicle.status]}
              </span>
            </div>
            
            {vehicle.capacity && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  탑승 인원
                </span>
                <span className="text-sm text-neutral-600">
                  {vehicle.capacity}명
                </span>
              </div>
            )}
            
            {vehicle.current_odometer !== null && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  현재 주행거리
                </span>
                <span className="text-sm text-neutral-600">
                  {vehicle.current_odometer.toLocaleString()} km
                </span>
              </div>
            )}
            
            {vehicle.note && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  비고
                </span>
                <span className="text-sm text-neutral-600 whitespace-pre-wrap">
                  {vehicle.note}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <VehicleReservationSection
        vehicleId={vehicle.id}
        reservations={reservations}
        vehicleStatus={vehicle.status}
        requiredRole={requiredRole}
      />
    </section>
  );
}
