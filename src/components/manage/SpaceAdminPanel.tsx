"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import type { Space } from "@/types/database";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import {
  Select,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const statusFilterOptions: Array<{ value: Space["status"] | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "사용 불가" },
];

export default function SpaceAdminPanel() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Space["status"] | "all">(
    "all"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("spaces")
      .select("id,short_id,name,status,owner_department,owner_scope")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setSpaces([]);
    } else {
      setSpaces((data ?? []) as Space[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const filteredSpaces = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return spaces.filter((space) => {
      if (statusFilter !== "all" && space.status !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const ownerLabel =
        space.owner_scope === "organization"
          ? "기관 공용"
          : space.owner_department;
      return (
        space.name.toLowerCase().includes(normalized) ||
        ownerLabel.toLowerCase().includes(normalized)
      );
    });
  }, [spaces, query, statusFilter]);

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
    if (selectedIds.size === filteredSpaces.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredSpaces.map((space) => space.id)));
  };

  const bulkUpdateStatus = async (status: Space["status"]) => {
    if (selectedIds.size === 0) {
      setMessage("선택된 항목이 없습니다.");
      return;
    }

    setUpdating(true);
    setMessage(null);

    const { error } = await supabase
      .from("spaces")
      .update({ status })
      .in("id", Array.from(selectedIds));

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    setSpaces((prev) =>
      prev.map((space) =>
        selectedIds.has(space.id) ? { ...space, status } : space
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
          action: "space_status_bulk_update",
          target_type: "space",
          metadata: {
            status,
            count: selectedIds.size,
          },
        });
      }
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">공간 관리</h2>
          <p className="text-sm text-neutral-600">
            공간 상태를 일괄 변경하거나 검색할 수 있습니다.
          </p>
        </div>
        <Link
          href="/new?category=spaces"
          className="btn-primary whitespace-nowrap"
        >
          공간 등록
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>총 {spaces.length}건</span>
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
            className="form-input text-sm md:w-72"
            placeholder="공간명/소유 부서 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <StatusFilterPills
        options={statusFilterOptions}
        value={statusFilter}
        onChange={(next) => setStatusFilter(next as Space["status"] | "all")}
      />

      {/* 일괄 변경 - 선택된 항목이 있을 때만 표시 */}
      {selectedIds.size > 0 && (
        <div className="mt-3 list-row-muted flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-600 font-medium">
            선택된 항목({selectedIds.size}건):
          </span>
          <Select
            value=""
            onValueChange={(next) => {
              const status = next as Space["status"];
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
        <Notice>공간 목록을 불러오는 중입니다.</Notice>
      ) : filteredSpaces.length === 0 ? (
        <Notice>
          <p>조건에 맞는 공간이 없습니다.</p>
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
                selectedIds.size === filteredSpaces.length
              }
              onChange={toggleSelectAll}
            />
            <span>전체 선택</span>
          </div>
          {filteredSpaces.map((space) => (
            <div
              key={space.id}
              className="list-row justify-between text-sm"
            >
              <label className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(space.id)}
                  onChange={() => toggleSelect(space.id)}
                  className="flex-shrink-0"
                />
                <span className="truncate">{space.name}</span>
                <ResourceStatusBadge
                  status={space.status as "available" | "rented" | "repair" | "lost"}
                  label={
                    space.status === "available"
                      ? "사용 가능"
                      : space.status === "rented"
                      ? "예약 중"
                      : "사용 불가"
                  }
                  className="shrink-0"
                />
              </label>
              <div className="flex items-center gap-2">
                <Link
                  href={`/spaces/${space.short_id || space.id}/edit`}
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
