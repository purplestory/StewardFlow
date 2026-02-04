"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import type { Vehicle } from "@/types/database";
import VehicleCard from "@/components/vehicles/VehicleCard";
import VehicleForm from "@/components/vehicles/VehicleForm";

const statusOptions: Array<{ value: Vehicle["status"] | ""; label: string }> = [
  { value: "", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "수리 중" },
];

export default function VehiclesListClient() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policyLabels, setPolicyLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [hasOrganization, setHasOrganization] = useState<boolean | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Vehicle["status"] | "">("");
  const isMountedRef = useRef(true);

  const loadVehicles = async () => {
    setLoading(true);
    setMessage(null);

    // Get user's organization_id first
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setVehicles([]);
      setHasOrganization(false);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("organization_id,role")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = profileData?.organization_id ?? null;
    setHasOrganization(Boolean(orgId));
    setIsManager(
      profileData?.role === "admin" || profileData?.role === "manager"
    );

    if (!orgId) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    // Load vehicles with organization_id filter
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (!isMountedRef.current) return;

    if (error) {
      setMessage(error.message);
      setVehicles([]);
    } else {
      setVehicles((data ?? []) as Vehicle[]);
    }

    // Load approval policies
    const { data: policyData } = await supabase
      .from("approval_policies")
      .select("scope,department,required_role")
      .eq("organization_id", orgId)
      .eq("scope", "vehicle");

    if (policyData) {
      const labelMap: Record<string, string> = {};
      const roleLabel: Record<string, string> = {
        admin: "관리자",
        manager: "부서 관리자",
        user: "일반 사용자",
      };

      (data ?? []).forEach((vehicle) => {
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

      setPolicyLabels(labelMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadVehicles();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">차량</h1>
            <p className="mt-2 text-sm text-neutral-600">
              교회 차량 예약을 신청할 수 있습니다.
            </p>
          </div>
          {isManager && hasOrganization === true && (
            <button
              type="button"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {showRegisterForm ? "목록 보기" : "차량 등록"}
            </button>
          )}
        </div>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <input
              className="form-input"
              placeholder="차량명, 번호판 또는 부서를 검색하세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {/* 상태 필터 버튼 */}
          <div className="flex flex-wrap items-center gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (option.value === "") {
                    // "전체" 버튼 클릭 시 모든 필터 초기화
                    setQuery("");
                    setStatus("");
                  } else {
                    setStatus(option.value as Vehicle["status"] | "");
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  status === option.value
                    ? option.value === ""
                      ? "bg-neutral-900 text-white"
                      : option.value === "available"
                      ? "bg-emerald-500 text-white"
                      : option.value === "rented"
                      ? "bg-blue-500 text-white"
                      : option.value === "repair"
                      ? "bg-amber-500 text-white"
                      : option.value === "lost"
                      ? "bg-rose-500 text-white"
                      : "bg-neutral-100 text-neutral-700"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showRegisterForm && isManager && hasOrganization === true && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">차량 등록</h2>
          <VehicleForm />
        </div>
      )}

      {loading || hasOrganization === null ? (
        <Notice className="rounded-xl bg-white p-10">
          차량 목록을 불러오는 중입니다.
        </Notice>
      ) : !hasOrganization ? (
        <Notice variant="warning" className="rounded-xl p-10">
          기관 설정이 필요합니다.{" "}
          <Link href="/settings/org" className="underline">
            기관 설정
          </Link>
          으로 이동해 생성/참여를 완료해주세요.
        </Notice>
      ) : message ? (
        <Notice variant="error" className="rounded-xl p-10">
          {message}
        </Notice>
      ) : filteredVehicles.length === 0 ? (
        <Notice className="rounded-xl bg-white p-10">
          <p>조건에 맞는 차량이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("");
            }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              requiredRoleLabel={policyLabels[vehicle.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
