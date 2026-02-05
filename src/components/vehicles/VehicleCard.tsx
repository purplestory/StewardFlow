import Link from "next/link";
import type { Vehicle } from "@/types/database";

type VehicleCardProps = {
  vehicle: Vehicle;
  requiredRoleLabel?: string;
};

const statusLabel: Record<Vehicle["status"], string> = {
  available: "사용 가능",
  rented: "예약 중",
  repair: "사용 불가",
  lost: "사용 불가",
};

export default function VehicleCard({ vehicle, requiredRoleLabel }: VehicleCardProps) {
  const detailUrl = `/vehicles/${vehicle.short_id ?? vehicle.id}`;
  
  // 첫 번째 이미지 가져오기 (image_urls 우선, 없으면 image_url)
  const firstImage = 
    (vehicle.image_urls && vehicle.image_urls.length > 0)
      ? vehicle.image_urls[0]
      : vehicle.image_url;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <Link href={detailUrl} className="block">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100 transition-opacity hover:opacity-90 cursor-pointer">
          {firstImage ? (
            <img
              src={firstImage}
              alt={vehicle.name}
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
        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold hover:text-neutral-700 cursor-pointer transition-colors flex-1 min-w-0">
              {vehicle.name}
            </h2>
            {/* 상태 뱃지 - 제품명 옆에 표시 */}
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
          </div>
        </div>
      </Link>

      {/* 상세 정보 표시 */}
      <div className="mt-3 space-y-1.5">
        {vehicle.category && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">카테고리</span>
            <span>{vehicle.category}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <span className="font-medium text-neutral-500">소유</span>
          <span>
            {vehicle.owner_scope === "organization" ? "기관 공용" : vehicle.owner_department}
          </span>
        </div>
        {vehicle.vehicle_type && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">차종</span>
            <span>{vehicle.vehicle_type}</span>
          </div>
        )}
        {vehicle.fuel_type && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">연료 타입</span>
            <span>{vehicle.fuel_type}</span>
          </div>
        )}
        {vehicle.license_plate && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">번호판</span>
            <span>{vehicle.license_plate}</span>
          </div>
        )}
        {vehicle.capacity && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-500">탑승 인원</span>
            <span>{vehicle.capacity}명</span>
          </div>
        )}
      </div>

      <Link
        href={detailUrl}
        className="mt-4 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm"
      >
        상세 보기
      </Link>
    </div>
  );
}
