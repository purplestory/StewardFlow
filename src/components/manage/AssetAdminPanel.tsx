"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import type { Asset } from "@/types/database";
import { isUUID } from "@/lib/short-id";

const statusOptions: Array<{ value: Asset["status"] | "all"; label: string }> =
  [
    { value: "all", label: "전체 상태" },
    { value: "available", label: "대여 가능" },
    { value: "rented", label: "대여 중" },
    { value: "repair", label: "수리 중" },
    { value: "retired", label: "불용품" },
  ];

const statusLabel: Record<Asset["status"], string> = {
  available: "대여 가능",
  rented: "대여 중",
  repair: "수리 중",
  lost: "분실",
  retired: "불용품",
};

export default function AssetAdminPanel() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
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

    let query = supabase
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">물품 관리</h2>
          <p className="text-sm text-neutral-600">
            물품 상태를 일괄 변경하거나 검색할 수 있습니다.
          </p>
        </div>
        <Link
          href="/new?category=equipment"
          className="btn-primary whitespace-nowrap"
        >
          물품 등록
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>총 {assets.length}건</span>
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
            className="form-input h-10 text-xs"
            placeholder="자산명/소유 부서 검색"
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
            대여 가능
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
            대여 중
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
            수리 중
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("retired")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "retired"
                ? "bg-neutral-600 text-white shadow-sm"
                : "bg-white text-neutral-700 border border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
            }`}
          >
            불용품
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
              const status = event.target.value as Asset["status"];
              if (status) {
                bulkUpdateStatus(status);
                event.target.value = ""; // 선택 초기화
              }
            }}
            disabled={updating}
          >
            <option value="">일괄 상태 변경...</option>
            <option value="available">→ 대여 가능</option>
            <option value="rented">→ 대여 중</option>
            <option value="repair">→ 수리 중</option>
            <option value="retired">→ 불용품</option>
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
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={
                selectedIds.size > 0 &&
                selectedIds.size === filteredAssets.length
              }
              onChange={toggleSelectAll}
            />
            <span>전체 선택</span>
          </div>
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            >
              <label className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.id)}
                  onChange={() => toggleSelect(asset.id)}
                  className="flex-shrink-0"
                />
                <span className="truncate">{asset.name}</span>
                {/* 상태 뱃지 - 제품명 옆에 표시 */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    asset.status === "available"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : asset.status === "rented"
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : asset.status === "repair"
                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                      : asset.status === "lost"
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : asset.status === "retired"
                      ? "bg-neutral-100 text-neutral-700 border border-neutral-200"
                      : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                  }`}
                >
                  {asset.status === "available" && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {asset.status === "rented" && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  )}
                  {asset.status === "repair" && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  )}
                  {asset.status === "lost" && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  {asset.status === "retired" && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{statusLabel[asset.status]}</span>
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Link
                    href={`/assets/${asset.short_id || asset.id}/edit`}
                    className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
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
                    className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="삭제"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            {/* 모달 헤더 */}
            <div className="rounded-t-lg bg-blue-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">물품 삭제</h3>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-700">
                  정말 이 물품을 삭제하시겠습니까? 삭제된 물품은 휴지통으로 이동하며, 최고 관리자가 영구 삭제할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  삭제 사유 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={deletionReason}
                  onChange={(e) => {
                    setDeletionReason(e.target.value);
                    if (e.target.value !== "기타") {
                      setDeletionReasonOther("");
                    }
                  }}
                  className="w-full form-select"
                  autoFocus
                >
                  <option value="">선택하세요</option>
                  <option value="불용품">불용품 (사용 가능한 상태)</option>
                  <option value="잔존 수명 종료">잔존 수명 종료</option>
                  <option value="고장">고장</option>
                  <option value="분실">분실</option>
                  <option value="신제품 등록">신제품 등록</option>
                  <option value="기타">기타</option>
                </select>
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
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  message.includes("오류") || message.includes("실패")
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {message}
                </div>
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
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
                    // 클라이언트에서 직접 삭제 처리
                    const { data: sessionData } = await supabase.auth.getSession();
                    if (!sessionData.session) {
                      throw new Error("인증이 필요합니다. 로그인 후 다시 시도해주세요.");
                    }

                    const user = sessionData.session.user;
                    
                    // 사용자 프로필 확인
                    const { data: profileData, error: profileError } = await supabase
                      .from("profiles")
                      .select("role, organization_id, department")
                      .eq("id", user.id)
                      .maybeSingle();

                    if (profileError || !profileData) {
                      throw new Error("사용자 정보를 가져올 수 없습니다.");
                    }

                    // 자산 정보 확인
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

                    // 권한 확인
                    const isAdmin = profileData.role === "admin";
                    const isManager = profileData.role === "manager" || isAdmin;
                    const isOwner = assetData.owner_scope === "organization" 
                      ? assetData.organization_id === profileData.organization_id
                      : assetData.owner_department === profileData.department;

                    if (!isManager && !isOwner) {
                      throw new Error("삭제 권한이 없습니다.");
                    }

                    // Soft delete 실행
                    const finalReason = deletionReason === "기타" ? deletionReasonOther.trim() : deletionReason;
                    const { error: updateError } = await supabase
                      .from("assets")
                      .update({ 
                        deleted_at: new Date().toISOString(),
                        deletion_reason: finalReason || null
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
                    setMessage(`삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
                    // 에러가 발생해도 모달은 닫기
                    setShowDeleteDialog(null);
                    setDeletionReason("");
                    setDeletionReasonOther("");
                  } finally {
                    setDeletingId(null);
                  }
                }}
                disabled={!deletionReason || (deletionReason === "기타" && !deletionReasonOther.trim()) || deletingId === showDeleteDialog}
                className="flex-1 btn-primary bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === showDeleteDialog ? "삭제 중..." : "삭제"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDialog(null);
                  setDeletionReason("");
                  setDeletionReasonOther("");
                }}
                disabled={deletingId === showDeleteDialog}
                className="flex-1 btn-ghost"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
