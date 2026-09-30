import Link from "next/link";
import Image from "next/image";
import type { Asset } from "@/types/database";
import ResourceStatusBadge from "@/components/ui/ResourceStatusBadge";

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

const categoryLabel: Record<NonNullable<Asset["category"]>, string> = {
  sound: "음향",
  video: "영상",
  kitchen: "조리",
  furniture: "가구",
  etc: "기타",
};

export default function AssetCard({ asset, requiredRoleLabel }: AssetCardProps) {
  const tags = asset.tags ?? [];

  const detailUrl = `/assets/${asset.short_id ?? asset.id}`;
  
  // 첫 번째 이미지 가져오기 (image_urls 우선, 없으면 image_url)
  const firstImage = 
    (asset.image_urls && asset.image_urls.length > 0)
      ? asset.image_urls[0]
      : asset.image_url;

  return (
    <Link
      href={detailUrl}
      className="surface-card surface-card-interactive group flex h-full flex-col p-4"
      aria-label={`${asset.name} 상세 보기`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
          {firstImage ? (
            <Image
              src={firstImage}
              alt={asset.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral-400">
              이미지 없음
            </div>
          )}
      </div>
      <div className="mt-4">
          <div className="flex flex-wrap items-start gap-2">
            <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-slate-950 transition-colors group-hover:text-brand-primary">
              {asset.name}
            </h2>
            <ResourceStatusBadge status={asset.status} label={statusLabel[asset.status]} className="shrink-0" />
          </div>
          {/* 모델명 */}
          {asset.model_name && (
            <p className="mt-1 text-xs text-neutral-500">{asset.model_name}</p>
          )}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs">
        {asset.category && (
          <><dt className="text-neutral-500">분류</dt><dd className="truncate text-neutral-700">{categoryLabel[asset.category] || asset.category}</dd></>
        )}
        <dt className="text-neutral-500">소유</dt>
        <dd className="break-words text-neutral-700">{asset.owner_scope === "organization" ? "기관 공용" : asset.owner_department}</dd>
        <dt className="text-neutral-500">형태</dt>
        <dd className="text-neutral-700">{asset.mobility ? mobilityLabel[asset.mobility] : "이동"}</dd>
        {asset.location && (
          <><dt className="text-neutral-500">위치</dt><dd className="break-words text-neutral-700">{asset.location}</dd></>
        )}
        {asset.quantity > 1 && (
          <><dt className="text-neutral-500">수량</dt><dd className="text-neutral-700">{asset.quantity}개</dd></>
        )}
        {requiredRoleLabel ? (
          <><dt className="text-neutral-500">승인</dt><dd className="truncate text-neutral-700">{requiredRoleLabel}</dd></>
        ) : null}
      </dl>

      {/* 태그 */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 border border-neutral-200"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 ? <span className="chip-muted">+{tags.length - 3}</span> : null}
        </div>
      )}
    </Link>
  );
}
