"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import VehicleForm from "@/components/vehicles/VehicleForm";
import type { Vehicle } from "@/types/database";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import {
  Select,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const statusLabel: Record<Vehicle["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "수리 중",
  lost: "분실",
};

const statusFilterOptions: Array<{ value: Vehicle["status"] | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "사용 불가" },
];

export default function VehicleAdminPanel() {
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(
    searchParams.get("mode") === "register"
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Vehicle["status"] | "all">(
    "all"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage(null);

    // Get user's organization_id
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    
    if (!user) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileData?.organization_id) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("id,short_id,name,status,owner_department,owner_scope")
      .eq("organization_id", profileData.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setVehicles([]);
    } else {
      setVehicles((data ?? []) as Vehicle[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const filteredVehicles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      if (statusFilter !== "all" && vehicle.status !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const ownerLabel =
        vehicle.owner_scope === "organization"
          ? "기관 공용"
          : vehicle.owner_department;
      return (
        vehicle.name.toLowerCase().includes(normalized) ||
        ownerLabel.toLowerCase().includes(normalized)
      );
    });
  }, [vehicles, query, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVehicles.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredVehicles.map((vehicle) => vehicle.id)));
  };

  const bulkUpdateStatus = async (status: Vehicle["status"]) => {
    if (selectedIds.size === 0) {
      setMessage("선택된 항목이 없습니다.");
      return;
    }

    setUpdating(true);
    setMessage(null);

    const { error } = await supabase
      .from("vehicles")
      .update({ status })
      .in("id", Array.from(selectedIds));

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    setVehicles((prev) =>
      prev.map((vehicle) =>
        selectedIds.has(vehicle.id) ? { ...vehicle, status } : vehicle
      )
    );
    setSelectedIds(new Set());
    setUpdating(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.organization_id) {
        await supabase.from("audit_logs").insert({
          organization_id: profileData.organization_id,
          actor_id: user.id,
          action: "vehicle_status_bulk_update",
          target_type: "vehicle",
          metadata: {
            status,
            count: selectedIds.size,
          },
        });
      }
    }
  };

  return (
    <section className="surface-card">
      <div className="space-y-4 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">차량 관리</h2>
          <p className="mt-1 text-sm text-neutral-600">
            차량 상태를 일괄 변경하거나 검색할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRegisterForm((prev) => !prev)}
          className="btn-primary whitespace-nowrap"
        >
          {showRegisterForm ? "목록 보기" : "차량 등록"}
        </button>
      </div>

      {showRegisterForm ? (
        <VehicleForm
          onSuccess={async () => {
            setShowRegisterForm(false);
            setMessage(null);
            await load();
          }}
        />
      ) : (
        <>

      <div className="module-toolbar space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="module-kpi">총 {vehicles.length}건</span>
            <button
              type="button"
              onClick={load}
              className="btn-outline"
            >
              새로고침
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="form-input text-sm md:w-72"
              placeholder="차량명/소유 부서 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <StatusFilterPills
          options={statusFilterOptions}
          value={statusFilter}
          onChange={(next) => setStatusFilter(next as Vehicle["status"] | "all")}
        />
      </div>

      {/* 일괄 변경 - 선택된 항목이 있을 때만 표시 */}
      {selectedIds.size > 0 && (
        <div className="mt-3 list-row-muted flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-600 font-medium">
            선택된 항목({selectedIds.size}건):
          </span>
          <Select
            value=""
            onValueChange={(next) => {
              const status = next as Vehicle["status"];
              if (status) {
                bulkUpdateStatus(status);
              }
            }}
            disabled={updating}
          >
            <SelectTrigger className="form-select h-9 text-xs">
              <SelectItem value="">일괄 상태 변경...</SelectItem>
              <SelectItem value="available">→ 사용 가능</SelectItem>
              <SelectItem value="rented">→ 예약 중</SelectItem>
              <SelectItem value="repair">→ 사용 불가</SelectItem>
            </SelectTrigger>
          </Select>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="btn-ghost text-xs"
          >
            선택 해제
          </button>
        </div>
      )}

      {message && (
        <Notice variant="error" className="p-3 text-xs">
          {message}
        </Notice>
      )}

      {loading ? (
        <Notice>차량 목록을 불러오는 중입니다.</Notice>
      ) : filteredVehicles.length === 0 ? (
        <Notice>
          <p>조건에 맞는 차량이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="btn-ghost mt-3"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        <div className="space-y-2">
          <div className="list-row-muted flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={
                selectedIds.size > 0 &&
                selectedIds.size === filteredVehicles.length
              }
              onChange={toggleSelectAll}
            />
            <span>전체 선택</span>
          </div>
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="list-row justify-between text-sm"
            >
              <label className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(vehicle.id)}
                  onChange={() => toggleSelect(vehicle.id)}
                  className="flex-shrink-0"
                />
                <span className="truncate">{vehicle.name}</span>
                <ResourceStatusBadge
                  status={vehicle.status as "available" | "rented" | "repair" | "lost"}
                  label={statusLabel[vehicle.status]}
                  className="shrink-0"
                />
              </label>
              <div className="flex items-center gap-2">
                <Link
                  href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
                  className="icon-button"
                  title="수정"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
      </div>
    </section>
  );
}
