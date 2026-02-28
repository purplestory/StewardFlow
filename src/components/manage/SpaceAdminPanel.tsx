"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import SpaceForm from "@/components/spaces/SpaceForm";
import type { Space } from "@/types/database";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import ManageFilterToolbar from "@/components/manage/ManageFilterToolbar";
import ManageBulkStatusBar from "@/components/manage/ManageBulkStatusBar";
import ManageResourceList from "@/components/manage/ManageResourceList";

const statusFilterOptions: Array<{ value: Space["status"] | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "available", label: "사용 가능" },
  { value: "rented", label: "예약 중" },
  { value: "repair", label: "사용 불가" },
];

export default function SpaceAdminPanel() {
  const searchParams = useSearchParams();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(
    searchParams.get("mode") === "register"
  );
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
    <section className="surface-card">
      <div className="space-y-4 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">공간 관리</h2>
          <p className="mt-1 text-sm text-neutral-600">
            공간 상태를 일괄 변경하거나 검색할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRegisterForm((prev) => !prev)}
          className="btn-primary whitespace-nowrap"
        >
          {showRegisterForm ? "목록 보기" : "공간 등록"}
        </button>
      </div>

      {showRegisterForm ? (
        <SpaceForm
          onSuccess={async () => {
            setShowRegisterForm(false);
            setMessage(null);
            await load();
          }}
        />
      ) : (
        <>

      <ManageFilterToolbar
        totalCount={spaces.length}
        onRefresh={load}
        searchPlaceholder="공간명/소유 부서 검색"
        query={query}
        onQueryChange={setQuery}
        filterOptions={statusFilterOptions}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
      />

      <ManageBulkStatusBar
        selectedCount={selectedIds.size}
        disabled={updating}
        options={[
          { value: "available", label: "사용 가능" },
          { value: "rented", label: "예약 중" },
          { value: "repair", label: "사용 불가" },
        ]}
        onSelect={bulkUpdateStatus}
        onClear={() => setSelectedIds(new Set())}
      />

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
        <ManageResourceList
          infoLabel="공간 정보"
          allSelected={
            selectedIds.size > 0 && selectedIds.size === filteredSpaces.length
          }
          onToggleAll={toggleSelectAll}
        >
          {filteredSpaces.map((space) => (
            <div
              key={space.id}
              className="list-row text-sm lg:grid lg:grid-cols-[minmax(0,1fr)_8rem] lg:items-center"
            >
              <label className="flex min-w-0 flex-1 items-center gap-2">
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
              <div className="flex items-center gap-2 lg:justify-self-end">
                <Link
                  href={`/spaces/${space.short_id || space.id}/edit`}
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
        </ManageResourceList>
      )}
      </>
      )}
      </div>
    </section>
  );
}
