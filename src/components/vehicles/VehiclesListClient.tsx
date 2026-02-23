"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Notice from "@/components/common/Notice";
import type { Vehicle } from "@/types/database";
import VehicleCard from "@/components/vehicles/VehicleCard";
import VehicleForm from "@/components/vehicles/VehicleForm";
import { useVehicles, useVehicleApprovalPolicies } from "@/hooks/useVehicles";
import { useUserProfile } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";

const statusOptions: Array<{ value: Vehicle["status"] | ""; label: string }> = [
  { value: "", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "수리 중" },
];

const listViewOptions = [
  { value: "grid", label: "그리드" },
  { value: "list", label: "리스트" },
] as const;

type ListViewMode = (typeof listViewOptions)[number]["value"];

const statusLabel: Record<Vehicle["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "수리 중",
  lost: "사용 불가",
};

export default function VehiclesListClient() {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Vehicle["status"] | "">("");
  const [viewMode, setViewMode] = useState<ListViewMode>("grid");

  // React Query를 사용한 데이터 페칭
  const { data: vehicles = [], isLoading: vehiclesLoading, error: vehiclesError } = useVehicles();
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  const { data: policyData } = useVehicleApprovalPolicies(userProfile?.orgId ?? null);

  // Policy labels 계산
  const policyLabels = useMemo(() => {
    if (!policyData || !vehicles.length) return {};

    const labelMap: Record<string, string> = {};
    const roleLabel: Record<string, string> = {
      admin: "관리자",
      manager: "부서 관리자",
      user: "일반 사용자",
    };

    vehicles.forEach((vehicle) => {
      const department =
        vehicle.owner_scope === "organization"
          ? null
          : vehicle.owner_department;
      const exactPolicy = policyData.find(
        (policy) => policy.department === department
      );
      const fallbackPolicy = policyData.find(
        (policy) => policy.department === null
      );
      const requiredRole =
        exactPolicy?.required_role ??
        fallbackPolicy?.required_role ??
        "manager";
      labelMap[vehicle.id] = roleLabel[requiredRole] ?? "부서 관리자";
    });
    return labelMap;
  }, [vehicles, policyData]);

  const loading = vehiclesLoading || profileLoading;
  const hasOrganization = Boolean(userProfile?.orgId);
  const isManager = userProfile?.isManager ?? false;
  const message = vehiclesError ? vehiclesError.message : null;

  const filteredVehicles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesQuery =
        normalized.length === 0 ||
        vehicle.name.toLowerCase().includes(normalized) ||
        vehicle.owner_department.toLowerCase().includes(normalized) ||
        (vehicle.license_plate && vehicle.license_plate.toLowerCase().includes(normalized));
      const matchesStatus = !status || vehicle.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [vehicles, query, status]);

  const clearFilters = () => {
    setQuery("");
    setStatus("");
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="차량"
        description="교회 차량 예약을 신청할 수 있습니다."
        actions={
          isManager && hasOrganization === true ? (
            <button
              type="button"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="btn-primary whitespace-nowrap"
            >
              {showRegisterForm ? "목록 보기" : "차량 등록"}
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="form-input"
              placeholder="차량명, 번호판 또는 부서를 검색하세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white p-1">
              {listViewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  className={
                    option.value === viewMode
                      ? "inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                      : "inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <StatusFilterPills
            options={statusOptions}
            value={status}
            onChange={(next) => {
              if (next === "") {
                clearFilters();
                return;
              }
              setStatus(next);
            }}
          />
        </div>
      </PageHero>

      {showRegisterForm && isManager && hasOrganization === true && (
        <SectionCard title="차량 등록">
          <VehicleForm />
        </SectionCard>
      )}

      {loading ? (
        <Notice className="p-10">
          차량 목록을 불러오는 중입니다.
        </Notice>
      ) : !hasOrganization ? (
        <Notice variant="warning" className="p-10">
          기관 설정이 필요합니다.{" "}
          <Link href="/settings/org" className="underline">
            기관 설정
          </Link>
          으로 이동해 생성/참여를 완료해주세요.
        </Notice>
      ) : message ? (
        <Notice variant="error" className="p-10">
          {message}
        </Notice>
      ) : filteredVehicles.length === 0 ? (
        <Notice className="p-10">
          <p>조건에 맞는 차량이 없습니다.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="btn-ghost mt-3"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  requiredRoleLabel={policyLabels[vehicle.id]}
                />
              ))}
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className="space-y-3">
              {filteredVehicles.map((vehicle) => {
                const detailUrl = `/vehicles/${vehicle.short_id ?? vehicle.id}`;
                const firstImage =
                  vehicle.image_urls && vehicle.image_urls.length > 0
                    ? vehicle.image_urls[0]
                    : vehicle.image_url;

                return (
                  <div key={vehicle.id} className="surface-card p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
                      <Link
                        href={detailUrl}
                        className="group block md:w-56 md:shrink-0"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                          {firstImage ? (
                            <Image
                              src={firstImage}
                              alt={vehicle.name}
                              fill
                              sizes="(max-width: 768px) 100vw, 224px"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                              이미지 없음
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={detailUrl}
                            className="line-clamp-1 text-lg font-semibold text-neutral-900 hover:text-slate-800"
                          >
                            {vehicle.name}
                          </Link>
                          <ResourceStatusBadge
                            status={vehicle.status}
                            label={statusLabel[vehicle.status]}
                          />
                        </div>

                        <div className="space-y-1 text-sm text-neutral-600">
                          <p>{vehicle.vehicle_type ? `차종 ${vehicle.vehicle_type}` : "차종 미등록"}</p>
                          <p>
                            {vehicle.license_plate
                              ? `번호판 ${vehicle.license_plate}`
                              : "번호판 미등록"}
                          </p>
                          <p>
                            {vehicle.owner_scope === "organization"
                              ? "기관 공용"
                              : vehicle.owner_department || "소유 부서 미등록"}
                            {" · "}
                            {vehicle.location || "주차 위치 미등록"}
                          </p>
                        </div>

                        <Link
                          href={detailUrl}
                          className="btn-secondary mt-3 h-9 w-full max-w-32 px-3 text-sm font-semibold"
                        >
                          상세 보기
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
