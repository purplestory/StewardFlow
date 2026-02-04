"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listUnusedAssets } from "@/actions/asset-actions";
import type { Asset } from "@/types/database";
import Notice from "@/components/common/Notice";
import OrganizationGate from "@/components/settings/OrganizationGate";
import Link from "next/link";

export default function UnusedAssetsPage() {
  const [unusedAssets, setUnusedAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const assets = await listUnusedAssets();
        setUnusedAssets(assets);
      } catch (error) {
        setMessage(`로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredAssets = unusedAssets.filter((asset) => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return true;
    return (
      asset.name.toLowerCase().includes(normalized) ||
      asset.owner_department.toLowerCase().includes(normalized) ||
      (asset.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized))
    );
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">불용품 목록</h1>
        <p className="text-sm text-neutral-600 mt-2">
          사용 가능한 상태의 불용품을 확인하고 양도를 신청할 수 있습니다.
        </p>
      </div>

      <OrganizationGate>
        {message && (
          <Notice variant={message.includes("실패") ? "error" : "success"}>
            {message}
          </Notice>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="물품명, 부서, 태그로 검색"
              className="form-input"
            />
          </div>

          {loading ? (
            <Notice>로딩 중...</Notice>
          ) : filteredAssets.length === 0 ? (
            <Notice>조건에 맞는 불용품이 없습니다.</Notice>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{asset.name}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        소유 부서: {asset.owner_department}
                        {asset.location && ` · 설치(보관) 장소: ${asset.location}`}
                        {asset.tags && asset.tags.length > 0 && ` · 태그: ${asset.tags.join(", ")}`}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        삭제일: {asset.deleted_at ? new Date(asset.deleted_at).toLocaleDateString("ko-KR") : "알 수 없음"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/assets/${asset.short_id || asset.id}`}
                        className="btn-ghost text-sm"
                      >
                        상세보기
                      </Link>
                      <Link
                        href={`/assets/transfers?asset_id=${asset.short_id || asset.id}`}
                        className="btn-primary text-sm"
                      >
                        양도 신청
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </OrganizationGate>
    </section>
  );
}
