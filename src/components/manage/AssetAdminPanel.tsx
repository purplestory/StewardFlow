"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import AssetForm from "@/components/assets/AssetForm";
import type { Asset } from "@/types/database";
import { isUUID } from "@/lib/short-id";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";
import ManageFilterToolbar from "@/components/manage/ManageFilterToolbar";
import ManageBulkStatusBar from "@/components/manage/ManageBulkStatusBar";
import ManageResourceList from "@/components/manage/ManageResourceList";
import {
  Select,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusLabel: Record<Asset["status"], string> = {
  available: "대여 가능",
  rented: "대여 중",
  repair: "수리 중",
  lost: "분실",
  retired: "불용품",
};

const statusFilterOptions: Array<{ value: Asset["status"] | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "available", label: "대여 가능" },
  { value: "rented", label: "대여 중" },
  { value: "repair", label: "수리 중" },
  { value: "retired", label: "불용품" },
];

export default function AssetAdminPanel() {
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(
    searchParams.get("mode") === "register"
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Asset["status"] | "all">(
    "all"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionReasonOther, setDeletionReasonOther] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const query = supabase
      .from("assets")
      .select("id,short_id,name,status,owner_department,owner_scope")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    
    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      setAssets([]);
    } else {
      setAssets((data ?? []) as Asset[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (statusFilter !== "all" && asset.status !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const ownerLabel =
        asset.owner_scope === "organization"
          ? "기관 공용"
          : asset.owner_department;
      return (
        asset.name.toLowerCase().includes(normalized) ||
        ownerLabel.toLowerCase().includes(normalized)
      );
    });
  }, [assets, query, statusFilter]);

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
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredAssets.map((asset) => asset.id)));
  };

  const bulkUpdateStatus = async (status: Asset["status"]) => {
    if (selectedIds.size === 0) {
      setMessage("선택된 항목이 없습니다.");
      return;
    }

    setUpdating(true);
    setMessage(null);

    const { error } = await supabase
      .from("assets")
      .update({ status })
      .in("id", Array.from(selectedIds));

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    setAssets((prev) =>
      prev.map((asset) =>
        selectedIds.has(asset.id) ? { ...asset, status } : asset
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
          action: "asset_status_bulk_update",
          target_type: "asset",
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
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">물품 관리</h2>
          <p className="mt-1 text-sm text-neutral-600">
            물품 상태를 일괄 변경하거나 검색할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRegisterForm((prev) => !prev)}
          className="btn-primary whitespace-nowrap"
        >
          {showRegisterForm ? "목록 보기" : "물품 등록"}
        </button>
      </div>

      {showRegisterForm ? (
        <AssetForm
          onSuccess={async () => {
            setShowRegisterForm(false);
            setMessage(null);
            await load();
          }}
        />
      ) : (
        <>

      <ManageFilterToolbar
        totalCount={assets.length}
        onRefresh={load}
        searchPlaceholder="자산명/소유 부서 검색"
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
          { value: "available", label: "대여 가능" },
          { value: "rented", label: "대여 중" },
          { value: "repair", label: "수리 중" },
          { value: "retired", label: "불용품" },
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
        <Notice>물품 목록을 불러오는 중입니다.</Notice>
      ) : filteredAssets.length === 0 ? (
        <Notice>
          <p>조건에 맞는 물품이 없습니다.</p>
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
          infoLabel="물품 정보"
          allSelected={
            selectedIds.size > 0 && selectedIds.size === filteredAssets.length
          }
          onToggleAll={toggleSelectAll}
        >
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="list-row text-sm lg:grid lg:grid-cols-[minmax(0,1fr)_8rem] lg:items-center"
            >
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.id)}
                  onChange={() => toggleSelect(asset.id)}
                  className="flex-shrink-0"
                />
                <span className="truncate">{asset.name}</span>
                <ResourceStatusBadge
                  status={asset.status}
                  label={statusLabel[asset.status]}
                  className="shrink-0"
                />
              </label>
              <div className="flex items-center gap-1 lg:justify-self-end">
                <Link
                  href={`/assets/${asset.short_id || asset.id}/edit`}
                  className="icon-button"
                  title="수정"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDialog(asset.id);
                    setDeletionReason("");
                  }}
                  disabled={deletingId === asset.id || updating}
                  className="icon-button icon-button-danger disabled:opacity-50 disabled:cursor-not-allowed"
                  title="삭제"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </ManageResourceList>
      )}

      <Dialog
        open={Boolean(showDeleteDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteDialog(null);
            setDeletionReason("");
            setDeletionReasonOther("");
          }
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="rounded-t-2xl border-b border-neutral-200 px-6 py-4">
            <DialogTitle>물품 삭제</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm text-rose-700">
                정말 이 물품을 삭제하시겠습니까? 삭제된 물품은 휴지통으로 이동하며, 최고 관리자가 영구 삭제할 수 있습니다.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-900">
                삭제 사유 <span className="text-rose-500">*</span>
              </label>
              <Select
                value={deletionReason}
                onValueChange={(next) => {
                  setDeletionReason(next);
                  if (next !== "기타") {
                    setDeletionReasonOther("");
                  }
                }}
              >
                <SelectTrigger className="w-full form-select" autoFocus>
                  <SelectItem value="">선택하세요</SelectItem>
                  <SelectItem value="불용품">불용품 (사용 가능한 상태)</SelectItem>
                  <SelectItem value="잔존 수명 종료">잔존 수명 종료</SelectItem>
                  <SelectItem value="고장">고장</SelectItem>
                  <SelectItem value="분실">분실</SelectItem>
                  <SelectItem value="신제품 등록">신제품 등록</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectTrigger>
              </Select>
            </div>

            {deletionReason === "기타" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  사유 입력 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={deletionReasonOther}
                  onChange={(e) => setDeletionReasonOther(e.target.value)}
                  placeholder="삭제 사유를 입력하세요"
                  className="w-full form-input"
                  autoFocus
                />
              </div>
            )}

            {message && message.includes("삭제") && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  message.includes("오류") || message.includes("실패")
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          <div className="flex gap-3 rounded-b-2xl border-t border-neutral-200 bg-neutral-50 px-6 py-4">
            <button
              type="button"
              onClick={async () => {
                if (!deletionReason) {
                  setMessage("삭제 사유를 선택해주세요.");
                  return;
                }
                if (deletionReason === "기타" && !deletionReasonOther.trim()) {
                  setMessage("기타 사유를 입력해주세요.");
                  return;
                }
                const asset = filteredAssets.find((a) => a.id === showDeleteDialog);
                if (!asset) return;
                setDeletingId(asset.id);
                try {
                  const { data: sessionData } = await supabase.auth.getSession();
                  if (!sessionData.session) {
                    throw new Error("인증이 필요합니다. 로그인 후 다시 시도해주세요.");
                  }

                  const user = sessionData.session.user;
                  const { data: profileData, error: profileError } = await supabase
                    .from("profiles")
                    .select("role, organization_id, department")
                    .eq("id", user.id)
                    .maybeSingle();

                  if (profileError || !profileData) {
                    throw new Error("사용자 정보를 가져올 수 없습니다.");
                  }

                  const assetId = asset.short_id || asset.id;
                  const isUuid = isUUID(assetId);
                  let assetQuery = supabase
                    .from("assets")
                    .select("id, organization_id, owner_scope, owner_department")
                    .is("deleted_at", null);

                  if (isUuid) {
                    assetQuery = assetQuery.eq("id", assetId);
                  } else {
                    assetQuery = assetQuery.eq("short_id", assetId);
                  }

                  const { data: assetData, error: assetError } = await assetQuery.maybeSingle();
                  if (assetError || !assetData) {
                    throw new Error("물품을 찾을 수 없습니다.");
                  }

                  const isAdmin = profileData.role === "admin";
                  const isManager = profileData.role === "manager" || isAdmin;
                  const isOwner =
                    assetData.owner_scope === "organization"
                      ? assetData.organization_id === profileData.organization_id
                      : assetData.owner_department === profileData.department;

                  if (!isManager && !isOwner) {
                    throw new Error("삭제 권한이 없습니다.");
                  }

                  const finalReason =
                    deletionReason === "기타" ? deletionReasonOther.trim() : deletionReason;
                  const { error: updateError } = await supabase
                    .from("assets")
                    .update({
                      deleted_at: new Date().toISOString(),
                      deletion_reason: finalReason || null,
                    })
                    .eq("id", assetData.id);

                  if (updateError) {
                    throw new Error(`삭제 실패: ${updateError.message}`);
                  }

                  await load();
                  setMessage("물품이 삭제되었습니다.");
                  setShowDeleteDialog(null);
                  setDeletionReason("");
                  setDeletionReasonOther("");
                } catch (error) {
                  setMessage(
                    `삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
                  );
                  setShowDeleteDialog(null);
                  setDeletionReason("");
                  setDeletionReasonOther("");
                } finally {
                  setDeletingId(null);
                }
              }}
              disabled={
                !deletionReason ||
                (deletionReason === "기타" && !deletionReasonOther.trim()) ||
                deletingId === showDeleteDialog
              }
              className="btn-danger flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingId === showDeleteDialog ? "삭제 중..." : "삭제"}
            </button>
            <DialogClose asChild>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDialog(null);
                  setDeletionReason("");
                  setDeletionReasonOther("");
                }}
                disabled={deletingId === showDeleteDialog}
                className="btn-ghost flex-1"
              >
                취소
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}
      </div>
    </section>
  );
}
