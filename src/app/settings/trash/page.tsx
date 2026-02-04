"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listDeletedAssets, restoreAsset, deleteAsset } from "@/actions/asset-actions";
import type { Asset } from "@/types/database";
import Notice from "@/components/common/Notice";
import OrganizationGate from "@/components/settings/OrganizationGate";

export default function TrashPage() {
  const [deletedAssets, setDeletedAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        setLoading(false);
        return;
      }

      // Get user role
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setUserRole((profileData.role as "admin" | "manager" | "user") ?? "user");
      }

      // Only admins can see deleted assets
      if (profileData?.role !== "admin") {
        setMessage("최고 관리자만 삭제된 자원을 볼 수 있습니다.");
        setLoading(false);
        return;
      }

      try {
        const assets = await listDeletedAssets();
        setDeletedAssets(assets);
      } catch (error) {
        setMessage(`로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    setMessage(null);
    try {
      await restoreAsset(id);
      setDeletedAssets((prev) => prev.filter((asset) => asset.id !== id));
      setMessage("자원이 복원되었습니다.");
    } catch (error) {
      setMessage(`복원 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteAsset(id, true);
      setDeletedAssets((prev) => prev.filter((asset) => asset.id !== id));
      setMessage("자원이 영구 삭제되었습니다.");
    } catch (error) {
      setMessage(`영구 삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedIds.size === 0) {
      setMessage("선택된 자원이 없습니다.");
      return;
    }
    if (!confirm(`선택한 ${selectedIds.size}개의 자원을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    setDeletingId("bulk");
    setMessage(null);
    try {
      for (const id of selectedIds) {
        await deleteAsset(id, true);
      }
      setDeletedAssets((prev) => prev.filter((asset) => !selectedIds.has(asset.id)));
      setSelectedIds(new Set());
      setMessage(`${selectedIds.size}개의 자원이 영구 삭제되었습니다.`);
    } catch (error) {
      setMessage(`영구 삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (userRole !== "admin") {
    return (
      <section className="space-y-6">
        <Notice variant="error">
          최고 관리자만 삭제된 자원을 볼 수 있습니다.
        </Notice>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">휴지통</h1>
        <p className="text-sm text-neutral-600 mt-2">
          삭제된 자원을 복원하거나 영구 삭제할 수 있습니다.
        </p>
      </div>

      <OrganizationGate>
        {message && (
          <Notice variant={message.includes("실패") ? "error" : "success"}>
            {message}
          </Notice>
        )}

        {loading ? (
          <Notice>로딩 중...</Notice>
        ) : deletedAssets.length === 0 ? (
          <Notice>삭제된 자원이 없습니다.</Notice>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">
                총 {deletedAssets.length}개의 삭제된 자원
              </span>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkPermanentDelete}
                  disabled={deletingId === "bulk"}
                  className="btn-ghost text-sm text-rose-600 hover:text-rose-700"
                >
                  {deletingId === "bulk" ? "삭제 중..." : `선택한 ${selectedIds.size}개 영구 삭제`}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {deletedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(asset.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => new Set([...prev, asset.id]));
                          } else {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              next.delete(asset.id);
                              return next;
                            });
                          }
                        }}
                        className="rounded border-neutral-300"
                      />
                      <div>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-xs text-neutral-500">
                          삭제일: {asset.deleted_at ? new Date(asset.deleted_at).toLocaleString("ko-KR") : "알 수 없음"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(asset.short_id || asset.id)}
                        disabled={restoringId === asset.id || deletingId === asset.id}
                        className="btn-ghost text-sm"
                      >
                        {restoringId === asset.id ? "복원 중..." : "복원"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(asset.short_id || asset.id)}
                        disabled={restoringId === asset.id || deletingId === asset.id}
                        className="btn-ghost text-sm text-rose-600 hover:text-rose-700"
                      >
                        {deletingId === asset.id ? "삭제 중..." : "영구 삭제"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </OrganizationGate>
    </section>
  );
}
