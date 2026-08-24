"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
import {
  useUserReservations,
  type ReservationResourceType,
  type ReservationStatus,
  type UserReservationItem,
} from "@/hooks/useReservations";
import { useUserProfile } from "@/hooks/useAssets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusLabel: Record<ReservationStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  borrowed: "대출 중",
  overdue: "연체",
  returned: "반납 완료",
  rejected: "반려",
  cancelled: "취소됨",
};

const statusBadgeClass: Record<ReservationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  borrowed: "bg-sky-100 text-sky-700",
  overdue: "bg-rose-100 text-rose-700",
  returned: "bg-neutral-100 text-neutral-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-neutral-100 text-neutral-600",
};

const resourceTypeLabel: Record<ReservationResourceType, string> = {
  asset: "물품",
  space: "공간",
  vehicle: "차량",
  book: "도서",
};

const reservationVerbByType: Record<ReservationResourceType, string> = {
  asset: "대여",
  space: "예약",
  vehicle: "예약",
  book: "대출",
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

const formatReservationPeriod = (reservation: UserReservationItem) => {
  if (reservation.resource_type !== "book") {
    return `${formatDateTime(reservation.start_date)} ~ ${formatDateTime(reservation.end_date)}`;
  }

  const startLabel =
    reservation.status === "pending" ||
    reservation.status === "rejected" ||
    reservation.status === "cancelled"
      ? "신청일"
      : reservation.status === "approved"
        ? "승인일"
        : "대출일";
  const hasDistinctEnd = reservation.end_date !== reservation.start_date;
  const endLabel = reservation.status === "returned" ? "반납일" : "반납 예정";

  return `${startLabel}: ${formatDateTime(reservation.start_date)}${
    hasDistinctEnd ? ` · ${endLabel}: ${formatDateTime(reservation.end_date)}` : ""
  }`;
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
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
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
    setCancelReasonDraft("");
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
    if (selectedReservation.resource_type === "book") {
      setActionMessage("도서 대출 신청은 날짜를 직접 수정할 수 없습니다.");
      return;
    }
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
          resourceType: selectedReservation.resource_type,
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
    const target = reservations.find((item) => item.id === reservationId);
    if (!target) return;

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
          resourceType: target.resource_type,
          accessToken,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setActionMessage(result?.message ?? "예약 취소에 실패했습니다.");
        return;
      }

      queryClient.setQueryData<UserReservationItem[]>(["userReservations"], (previous) =>
        target.resource_type === "book"
          ? (previous ?? []).map((item) =>
              item.id === reservationId ? { ...item, status: "cancelled" } : item
            )
          : (previous ?? []).filter((item) => item.id !== reservationId)
      );

      await queryClient.invalidateQueries({ queryKey: ["userReservations"] });
      await queryClient.refetchQueries({ queryKey: ["userReservations"], type: "active" });
      if (target.resource_type !== "book") {
        const remainingReservation =
          queryClient
            .getQueryData<UserReservationItem[]>(["userReservations"])
            ?.some((item) => item.id === reservationId) ?? false;
        if (remainingReservation) {
          setActionMessage("삭제 요청이 완료되지 않았습니다. 다시 시도해 주세요.");
          return;
        }
      }

      if (selectedId === reservationId || closeModalAfterCancel) {
        setSelectedId(null);
      }
      setActionMessage(
        result?.message ??
          (target.resource_type === "book"
            ? "도서 대출 신청이 취소되었습니다."
            : "예약 신청이 삭제되었습니다.")
      );
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
    const target = reservations.find((item) => item.id === reservationId);
    const confirmed = window.confirm(
      target?.resource_type === "book"
        ? "해당 도서 대출 신청을 취소하시겠습니까?"
        : "해당 대여 신청을 삭제하시겠습니까?"
    );
    if (!confirmed) return;
    await cancelReservation(reservationId, false);
  };

  const requestCancelReservation = async (reservationId: string, closeModalAfterRequest = false) => {
    if (!reservationId) return;
    const target = reservations.find((item) => item.id === reservationId);
    if (!target) return;
    if (target.status !== "approved") {
      setActionMessage("승인된 신청 건에서만 취소 요청을 보낼 수 있습니다.");
      return;
    }
    if (cancelReasonDraft.trim().length < 5) {
      setActionMessage("취소 사유를 5자 이상 입력해 주세요.");
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          resourceType: target.resource_type,
          cancelReason: cancelReasonDraft.trim(),
          accessToken,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setActionMessage(result?.message ?? "취소 요청에 실패했습니다.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["userReservations"] });
      setActionMessage("관리자에게 취소 요청을 보냈습니다.");
      if (closeModalAfterRequest) {
        setSelectedId(null);
      }
      setCancelReasonDraft("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "취소 요청 중 오류가 발생했습니다.";
      setActionMessage(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedReservation) return;
    await requestCancelReservation(selectedReservation.id, true);
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
    <div className="space-y-4">
      {actionMessage && !selectedReservation && (
        <Notice
          variant={
            actionMessage.includes("실패") || actionMessage.includes("오류")
              ? "error"
              : "success"
          }
        >
          {actionMessage}
        </Notice>
      )}
      <div className="module-list">
        <div className="list-row-muted hidden items-center text-xs text-neutral-500 md:grid md:grid-cols-[minmax(0,1fr)_auto]">
          <span>신청 정보</span>
          <span className="text-right">상태 / 액션</span>
        </div>
        <div>
          {reservations.map((reservation, index) => (
            <div
              key={reservation.id}
              className={`list-row flex-col gap-3 md:flex-row md:items-start md:justify-between ${
                index > 0 ? "!border-t !border-neutral-200" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
                  {reservation.resource_name} {resourceTypeLabel[reservation.resource_type]}{" "}
                  {reservationVerbByType[reservation.resource_type]}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  신청번호: {shortReservationId(reservation.id)}
                </p>
                <p className="mt-2 text-sm text-neutral-700">
                  {formatReservationPeriod(reservation)}
                </p>
                {reservation.note && (
                  <p className="mt-1 text-sm text-neutral-600">메모: {reservation.note}</p>
                )}
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 md:w-auto md:flex-nowrap">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    statusBadgeClass[reservation.status]
                  }`}
                >
                  {statusLabel[reservation.status]}
                </span>
                {reservation.status === "pending" ? (
                  <>
                    {reservation.resource_type !== "book" && (
                      <button
                        type="button"
                        className="btn-ghost h-8 px-3 text-xs"
                        onClick={() => openDetail(reservation.id)}
                        disabled={updating}
                      >
                        수정
                      </button>
                    )}
                    {reservation.resource_type === "book" && (
                      <button
                        type="button"
                        className="btn-ghost h-8 px-3 text-xs"
                        onClick={() => openDetail(reservation.id)}
                        disabled={updating}
                      >
                        상세 보기
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-outline btn-outline-danger h-8 px-3 text-xs disabled:opacity-60"
                      onClick={() => handleDeleteFromList(reservation.id)}
                      disabled={updating}
                    >
                      삭제
                    </button>
                  </>
                ) : reservation.status === "approved" ? (
                  <>
                    <button
                      type="button"
                      className="btn-outline btn-outline-warning h-8 px-3 text-xs disabled:opacity-60"
                      onClick={() => openDetail(reservation.id)}
                      disabled={updating}
                    >
                      취소 요청
                    </button>
                    <button
                      type="button"
                      className="btn-ghost h-8 px-3 text-xs"
                      onClick={() => openDetail(reservation.id)}
                    >
                      상세 보기
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost h-8 px-3 text-xs"
                    onClick={() => openDetail(reservation.id)}
                  >
                    상세 보기
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(selectedReservation)} onOpenChange={(open) => !open && closeDetail()}>
        {selectedReservation && (
          <DialogContent className="max-w-xl !p-0 overflow-hidden">
            <DialogHeader className="rounded-t-2xl border-b border-neutral-200 px-6 py-4">
              <DialogTitle>대여 신청 상세</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 px-6 py-4">
              <div>
                <p className="text-sm text-neutral-600">
                  {resourceTypeLabel[selectedReservation.resource_type]}: {selectedReservation.resource_name}
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
              </div>

              {selectedReservation.resource_type === "book" ? (
                <div className="space-y-2 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">
                  <p>{formatReservationPeriod(selectedReservation)}</p>
                  <p>메모: {selectedReservation.note?.trim() || "없음"}</p>
                </div>
              ) : (
                <div className="space-y-3">
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
              )}

              {selectedReservation.status !== "pending" && (
                <p className="text-xs text-neutral-500">
                  {selectedReservation.status === "approved"
                    ? "승인된 신청은 취소 요청을 통해 관리자 확인 후 처리됩니다."
                    : selectedReservation.resource_type === "book" &&
                        (selectedReservation.status === "borrowed" ||
                          selectedReservation.status === "overdue")
                      ? "대출 중인 도서는 도서 화면에서 반납 절차를 진행해 주세요."
                      : "승인 대기 상태에서만 신청 내용을 수정/취소할 수 있습니다."}
                </p>
              )}

              {selectedReservation.status === "approved" && (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-neutral-700">취소 사유</span>
                  <textarea
                    className="form-textarea"
                    value={cancelReasonDraft}
                    onChange={(event) => setCancelReasonDraft(event.target.value)}
                    placeholder="예: 일정 변경으로 더 이상 대여가 필요하지 않습니다."
                    disabled={updating}
                  />
                </label>
              )}

              {actionMessage && (
                <Notice
                  variant={
                    actionMessage.includes("실패") || actionMessage.includes("오류")
                      ? "error"
                      : "success"
                  }
                  className="p-3 text-left text-sm"
                >
                  {actionMessage}
                </Notice>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              {selectedReservation.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-rose-200 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    onClick={handleCancel}
                    disabled={updating}
                  >
                    신청 취소
                  </button>
                  {selectedReservation.resource_type !== "book" && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={updating}
                    >
                      {updating ? "저장 중..." : "내용 저장"}
                    </button>
                  )}
                </>
              )}
              {selectedReservation.status === "approved" && (
                <button
                  type="button"
                  className="h-10 rounded-xl border border-amber-200 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                  onClick={handleCancelRequest}
                  disabled={updating}
                >
                  {updating ? "요청 중..." : "취소 요청"}
                </button>
              )}
              {selectedReservation.resource_type === "book" &&
                (selectedReservation.status === "borrowed" ||
                  selectedReservation.status === "overdue") && (
                  <a className="btn-primary" href="/books">
                    도서 화면으로 이동
                  </a>
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
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
