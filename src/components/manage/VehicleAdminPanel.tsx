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
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        vehicle.status === "available"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : vehicle.status === "rented"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : vehicle.status === "repair"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : vehicle.status === "lost"
                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                          : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                      }`}
                    >
                      {vehicle.status === "available" && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {vehicle.status === "rented" && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      )}
                      {vehicle.status === "repair" && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
                        </svg>
                      )}
                      {vehicle.status === "lost" && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span>{statusLabel[vehicle.status]}</span>
                    </span>
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
