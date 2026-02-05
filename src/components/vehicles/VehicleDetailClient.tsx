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
          {/* 상태 뱃지 - 제목 위에 표시 */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                vehicle.status === "available"
                  ? "bg-emerald-500 text-white"
                  : vehicle.status === "rented"
                  ? "bg-blue-500 text-white"
                  : vehicle.status === "repair"
                  ? "bg-amber-500 text-white"
                  : vehicle.status === "lost"
                  ? "bg-rose-500 text-white"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {vehicleStatusLabel[vehicle.status]}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-neutral-900 break-words">{vehicle.name}</h1>
              </div>
              {(() => {
                // Admin은 항상 수정 가능
                if (userRole === "admin") {
                  return (
                    <Link
                      href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
                      className="flex-shrink-0 p-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
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
                // Manager는 자신의 부서 소유이거나 기관 공용인 경우 수정 가능
                if (userRole === "manager") {
                  const canEdit = 
                    vehicle.owner_scope === "organization" ||
                    (vehicle.owner_scope === "department" && vehicle.owner_department === userDepartment);
                  if (canEdit) {
                    return (
                      <Link
                        href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
                        className="flex-shrink-0 p-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
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
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-neutral-700">
                  비고
                </span>
                <div className="text-sm text-neutral-600 whitespace-pre-wrap break-words w-full">
                  {vehicle.note}
                </div>
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
