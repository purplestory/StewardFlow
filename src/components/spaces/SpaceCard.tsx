import Link from "next/link";
import type { Space } from "@/types/database";

type SpaceCardProps = {
  space: Space;
  requiredRoleLabel?: string;
};

const statusLabel: Record<Space["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "사용 불가",
  lost: "사용 불가",
};

export default function SpaceCard({ space, requiredRoleLabel }: SpaceCardProps) {
  const detailUrl = `/spaces/${space.short_id ?? space.id}`;
  
  // 첫 번째 이미지 가져오기 (image_urls 우선, 없으면 image_url)
  const firstImage = 
    (space.image_urls && space.image_urls.length > 0)
      ? space.image_urls[0]
      : space.image_url;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <Link href={detailUrl} className="block">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100 transition-opacity hover:opacity-90 cursor-pointer">
          {firstImage ? (
            <img
              src={firstImage}
              alt={space.name}
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
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold hover:text-neutral-700 cursor-pointer transition-colors flex-1 min-w-0">
            {space.name}
          </h2>
          {/* 상태 뱃지 - 제품명 옆에 표시 */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
              space.status === "available"
                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : space.status === "rented"
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : space.status === "repair"
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : space.status === "lost"
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : "bg-neutral-100 text-neutral-700 border border-neutral-200"
            }`}
          >
            {space.status === "available" && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {space.status === "rented" && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            )}
            {space.status === "repair" && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            )}
            {space.status === "lost" && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span>{statusLabel[space.status]}</span>
          </span>
        </div>
      </Link>

      {/* 위치 정보 및 기관 공용 표시 */}
      <div className="mt-3 space-y-1.5">
        {space.owner_scope === "organization" && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">소유</span>
            <span>기관 공용</span>
          </div>
        )}
        {space.location && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">위치</span>
            <span>{space.location}</span>
          </div>
        )}
      </div>

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
        href={detailUrl}
        className="mt-4 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm"
      >
        상세 보기
      </Link>
    </div>
  );
}
