"use client";

import Link from "next/link";
import Notice from "@/components/common/Notice";
import { useUserReservations } from "@/hooks/useReservations";
import { useUserProfile } from "@/hooks/useAssets";

type ReservationRow = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  note: string | null;
  assets: { name: string } | null;
};

export default function ReservationsClient() {
  // React Query를 사용한 데이터 페칭
  const { data: reservations = [], isLoading: loading, error } = useUserReservations();
  const { data: userProfile } = useUserProfile();

  const userId = userProfile?.user?.id ?? null;
  const message = error ? error.message : null;

  if (loading) {
    return (
      <Notice>예약 내역을 불러오는 중입니다.</Notice>
    );
  }

  if (!userId) {
    return (
      <Notice>
        로그인 후 예약 내역을 확인할 수 있습니다.{" "}
        <a href="/login" className="underline">
          로그인
        </a>
        으로 이동해 주세요.
      </Notice>
    );
  }

  if (message) {
    return (
      <Notice variant="error">{message}</Notice>
    );
  }

  if (reservations.length === 0) {
    return (
      <Notice>
        예약 내역이 없습니다.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      {reservations.map((reservation) => (
        <div
          key={reservation.id}
          className="rounded-lg border border-neutral-200 px-4 py-3"
        >
          <p className="text-sm font-medium">
            {reservation.assets?.name ?? "자산"} 대여
          </p>
          <p className="text-xs text-neutral-500">
            {reservation.start_date} ~ {reservation.end_date}
          </p>
          <p className="text-xs text-neutral-500">
            상태: {reservation.status}
          </p>
          {reservation.note && (
            <p className="mt-1 text-xs text-neutral-400">
              메모: {reservation.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
