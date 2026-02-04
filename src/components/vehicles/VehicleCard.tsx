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
  const ownerLabel =
    vehicle.owner_scope === "organization"
      ? "기관 공용"
      : vehicle.owner_department;

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
        <h2 className="mt-4 text-base font-semibold hover:text-neutral-700 cursor-pointer transition-colors">
          {vehicle.name}
        </h2>
      </Link>
      <p className="mt-1 text-xs text-neutral-500">
        소유: {ownerLabel} · 상태: {statusLabel[vehicle.status]}
      </p>
      {vehicle.license_plate && (
        <p className="mt-1 text-xs text-neutral-500">
          번호판: {vehicle.license_plate}
        </p>
      )}
      {requiredRoleLabel && (
        <p className="mt-1 text-xs text-neutral-500">
          승인 필요: {requiredRoleLabel}
        </p>
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
