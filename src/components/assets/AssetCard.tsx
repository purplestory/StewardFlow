import Link from "next/link";
import type { Asset } from "@/types/database";

type AssetCardProps = {
  asset: Asset;
  requiredRoleLabel?: string;
};

const statusLabel: Record<Asset["status"], string> = {
  available: "대여 가능",
  rented: "대여 중",
  repair: "수리 중",
  lost: "분실",
  retired: "불용품",
};

const mobilityLabel: Record<NonNullable<Asset["mobility"]>, string> = {
  fixed: "고정",
  movable: "이동",
};

export default function AssetCard({ asset, requiredRoleLabel }: AssetCardProps) {
  const ownerLabel =
    asset.owner_scope === "organization"
      ? "기관 공용"
      : asset.owner_department;
  const tags = asset.tags ?? [];
  const showUnused = !asset.last_used_at;

  const detailUrl = `/assets/${asset.short_id ?? asset.id}`;
  
  // 첫 번째 이미지 가져오기 (image_urls 우선, 없으면 image_url)
  const firstImage = 
    (asset.image_urls && asset.image_urls.length > 0)
      ? asset.image_urls[0]
      : asset.image_url;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <Link href={detailUrl} className="block">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100 transition-opacity hover:opacity-90 cursor-pointer">
          {firstImage ? (
            <img
              src={firstImage}
              alt={asset.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral-400">
              이미지 없음
            </div>
          )}
        </div>
      </Link>
      <Link href={detailUrl} className="block">
        <h2 className="mt-4 text-base font-semibold hover:text-neutral-700 cursor-pointer transition-colors">
          {asset.name}
        </h2>
      </Link>
      
      {/* 상태 뱃지 - available이 아닐 때만 표시 */}
      {asset.status !== "available" && (
        <div className="mt-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${
              asset.status === "rented"
                ? "bg-blue-500 text-white"
                : asset.status === "repair"
                ? "bg-amber-500 text-white"
                : asset.status === "lost"
                ? "bg-rose-500 text-white"
                : asset.status === "retired"
                ? "bg-neutral-600 text-white"
                : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {statusLabel[asset.status]}
          </span>
        </div>
      )}

      {/* 소유 및 설치 정보 */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <span className="font-medium text-neutral-500">소유</span>
          <span>{ownerLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <span className="font-medium text-neutral-500">설치</span>
          <span>{asset.mobility ? mobilityLabel[asset.mobility] : "이동"}</span>
        </div>
      </div>

      {/* 태그 */}
      {(tags.length > 0 || showUnused) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {showUnused && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
              미사용
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 border border-neutral-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 승인 필요 정보 */}
      {requiredRoleLabel && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 border border-blue-100">
          <svg
            className="h-3.5 w-3.5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-xs font-medium text-blue-700">
            {requiredRoleLabel} 승인 필요
          </span>
        </div>
      )}
      <Link
        href={`/assets/${asset.short_id ?? asset.id}`}
        className="mt-4 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm"
      >
        상세 보기
      </Link>
    </div>
  );
}
