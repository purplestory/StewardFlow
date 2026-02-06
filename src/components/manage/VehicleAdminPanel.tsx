"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import type { Vehicle } from "@/types/database";

const statusOptions: Array<{ value: Vehicle["status"] | "all"; label: string }> =
  [
    { value: "all", label: "전체 상태" },
    { value: "available", label: "사용 가능" },
    { value: "rented", label: "예약 중" },
    { value: "repair", label: "수리 중" },
    { value: "lost", label: "분실" },
  ];

const statusLabel: Record<Vehicle["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "수리 중",
  lost: "분실",
};

export default function VehicleAdminPanel() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
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
    load();
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">차량 관리</h2>
          <p className="text-sm text-neutral-600">
            차량 상태를 일괄 변경하거나 검색할 수 있습니다.
          </p>
        </div>
        <Link
          href="/new?category=vehicles"
          className="btn-primary whitespace-nowrap"
        >
          차량 등록
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>총 {vehicles.length}건</span>
          <button
            type="button"
            onClick={load}
            className="btn-ghost"
          >
            새로고침
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="form-input h-[38px] text-xs"
            placeholder="차량명/소유 부서 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {/* 상태 필터 버튼 */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "all"
                ? "bg-black text-white shadow-sm"
                : "bg-white text-neutral-700 border border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("available")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "available"
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-white text-neutral-700 border border-neutral-300 hover:border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            사용 가능
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rented")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "rented"
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-white text-neutral-700 border border-neutral-300 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            예약 중
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("repair")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "repair"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white text-neutral-700 border border-neutral-300 hover:border-amber-200 hover:bg-amber-50"
            }`}
          >
            사용 불가
          </button>
        </div>
      </div>

      {/* 일괄 변경 - 선택된 항목이 있을 때만 표시 */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs border-t border-neutral-200 pt-3 mt-3">
          <span className="text-neutral-600 font-medium">
            선택된 항목({selectedIds.size}건):
          </span>
          <select
            className="form-select h-8 text-xs"
            value=""
            onChange={(event) => {
              const status = event.target.value as Vehicle["status"];
              if (status) {
                bulkUpdateStatus(status);
                event.target.value = ""; // 선택 초기화
              }
            }}
            disabled={updating}
          >
            <option value="">일괄 상태 변경...</option>
            <option value="available">→ 사용 가능</option>
            <option value="rented">→ 예약 중</option>
            <option value="repair">→ 사용 불가</option>
          </select>
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
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
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
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            >
              <label className="flex items-center gap-2 flex-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(vehicle.id)}
                  onChange={() => toggleSelect(vehicle.id)}
                />
                <span>{vehicle.name}</span>
                <span className="text-neutral-400">
                  ({vehicle.owner_scope === "organization"
                    ? "기관 공용"
                    : vehicle.owner_department})
                </span>
              </label>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">{statusLabel[vehicle.status]}</span>
                    <Link
                      href={`/vehicles/${vehicle.short_id || vehicle.id}/edit`}
                      className="btn-ghost"
                    >
                      수정
                    </Link>
                  </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
