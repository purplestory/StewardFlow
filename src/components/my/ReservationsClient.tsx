"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
import { useUserReservations, type UserReservationItem } from "@/hooks/useReservations";
import { useUserProfile } from "@/hooks/useAssets";

const statusLabel: Record<"pending" | "approved" | "returned" | "rejected", string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

const statusBadgeClass: Record<"pending" | "approved" | "returned" | "rejected", string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  returned: "bg-neutral-100 text-neutral-700",
  rejected: "bg-rose-100 text-rose-700",
};

const toDateTimeLocal = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const shortReservationId = (value: string) => {
  if (!value) return "-";
  if (value.length <= 8) return value;
  return value.slice(0, 8);
};

export default function ReservationsClient() {
  const queryClient = useQueryClient();
  // React Query를 사용한 데이터 페칭
  const { data: reservations = [], isLoading: loading, error } = useUserReservations();
  const { data: userProfile } = useUserProfile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const userId = userProfile?.user?.id ?? null;
  const message = error ? error.message : null;
  const selectedReservation = useMemo(
    () => reservations.find((item) => item.id === selectedId) ?? null,
    [reservations, selectedId]
  );

  const openDetail = (reservationId: string) => {
    const target = reservations.find((item) => item.id === reservationId);
    if (!target) return;
    setSelectedId(target.id);
    setDraftStartDate(toDateTimeLocal(target.start_date));
    setDraftEndDate(toDateTimeLocal(target.end_date));
    setDraftNote(target.note ?? "");
    setActionMessage(null);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setActionMessage(null);
  };

  const getAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const handleSave = async () => {
    if (!selectedReservation) return;
    if (!draftStartDate || !draftEndDate) {
      setActionMessage("시작/종료 일시를 모두 입력해주세요.");
      return;
    }

    setUpdating(true);
    setActionMessage(null);
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setActionMessage("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/reservations/my", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: selectedReservation.id,
          startDate: `${draftStartDate}:00`,
          endDate: `${draftEndDate}:00`,
          note: draftNote,
          accessToken,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setActionMessage(result?.message ?? "예약 수정에 실패했습니다.");
        return;
      }

      queryClient.setQueryData<UserReservationItem[]>(["userReservations"], (previous) =>
        (previous ?? []).map((item) =>
          item.id === selectedReservation.id
            ? {
                ...item,
                start_date: `${draftStartDate}:00`,
                end_date: `${draftEndDate}:00`,
                note: draftNote.trim() ? draftNote.trim() : null,
              }
            : item
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["userReservations"] });
      await queryClient.refetchQueries({ queryKey: ["userReservations"], type: "active" });
      setActionMessage("예약 신청 내용이 수정되었습니다.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "예약 수정 중 오류가 발생했습니다.";
      setActionMessage(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const cancelReservation = async (reservationId: string, closeModalAfterCancel = false) => {
    if (!reservationId) return;

    setUpdating(true);
    setActionMessage(null);
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setActionMessage("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/reservations/my", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          accessToken,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setActionMessage(result?.message ?? "예약 취소에 실패했습니다.");
        return;
      }

      queryClient.setQueryData<UserReservationItem[]>(["userReservations"], (previous) =>
        (previous ?? []).filter((item) => item.id !== reservationId)
      );

      await queryClient.invalidateQueries({ queryKey: ["userReservations"] });
      await queryClient.refetchQueries({ queryKey: ["userReservations"], type: "active" });
      const remainingReservation =
        queryClient
          .getQueryData<UserReservationItem[]>(["userReservations"])
          ?.some((item) => item.id === reservationId) ?? false;
      if (remainingReservation) {
        setActionMessage("삭제 요청이 완료되지 않았습니다. 다시 시도해 주세요.");
        return;
      }

      if (selectedId === reservationId || closeModalAfterCancel) {
        setSelectedId(null);
      }
      setActionMessage("예약 신청이 삭제되었습니다.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "예약 취소 중 오류가 발생했습니다.";
      setActionMessage(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedReservation) return;
    await cancelReservation(selectedReservation.id, true);
  };

  const handleDeleteFromList = async (reservationId: string) => {
    const confirmed = window.confirm("해당 대여 신청을 삭제하시겠습니까?");
    if (!confirmed) return;
    await cancelReservation(reservationId, false);
  };

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
      {actionMessage && !selectedReservation && (
        <Notice>{actionMessage}</Notice>
      )}
      {reservations.map((reservation) => (
        <div
          key={reservation.id}
          className="rounded-lg border border-neutral-200 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-neutral-900">
                {reservation.assets?.name ?? "자산"} 대여
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                신청번호: {shortReservationId(reservation.id)}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {formatDateTime(reservation.start_date)} ~ {formatDateTime(reservation.end_date)}
              </p>
              {reservation.note && (
                <p className="mt-1 text-xs text-neutral-500">메모: {reservation.note}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  statusBadgeClass[reservation.status]
                }`}
              >
                {statusLabel[reservation.status]}
              </span>
              {reservation.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                    onClick={() => openDetail(reservation.id)}
                    disabled={updating}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    onClick={() => handleDeleteFromList(reservation.id)}
                    disabled={updating}
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                  onClick={() => openDetail(reservation.id)}
                >
                  상세 보기
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900">대여 신청 상세</h3>
            <p className="mt-2 text-sm text-neutral-600">
              자산: {selectedReservation.assets?.name ?? "자산"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              신청번호: {shortReservationId(selectedReservation.id)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-neutral-500">상태</span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  statusBadgeClass[selectedReservation.status]
                }`}
              >
                {statusLabel[selectedReservation.status]}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-700">시작일시</span>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={draftStartDate}
                  onChange={(event) => setDraftStartDate(event.target.value)}
                  disabled={selectedReservation.status !== "pending" || updating}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-700">종료일시</span>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={draftEndDate}
                  onChange={(event) => setDraftEndDate(event.target.value)}
                  disabled={selectedReservation.status !== "pending" || updating}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-700">사용 목적 / 메모</span>
                <textarea
                  className="form-textarea"
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  disabled={selectedReservation.status !== "pending" || updating}
                />
              </label>
            </div>

            {selectedReservation.status !== "pending" && (
              <p className="mt-3 text-xs text-neutral-500">
                승인 대기 상태에서만 신청 내용을 수정/취소할 수 있습니다.
              </p>
            )}

            {actionMessage && (
              <p className="mt-3 text-sm text-neutral-700">{actionMessage}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {selectedReservation.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    onClick={handleCancel}
                    disabled={updating}
                  >
                    신청 취소
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={updating}
                  >
                    {updating ? "저장 중..." : "내용 저장"}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={closeDetail}
                disabled={updating}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
