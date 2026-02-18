export type ReservationStatus = "pending" | "approved" | "returned" | "rejected";
export type ProfileRole = "admin" | "manager" | "user";

export const reservationStatusOptions: ReservationStatus[] = [
  "pending",
  "approved",
  "returned",
  "rejected",
];

export const reservationStatusLabel: Record<ReservationStatus, string> = {
  pending: "대기",
  approved: "승인",
  returned: "반납 확인",
  rejected: "반려",
};

export const roleLabel: Record<ProfileRole, string> = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};

export const formatDateTimeRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} ~ ${end}`;
  }
  return `${startDate.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })} ~ ${endDate.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
};

export const formatBorrowerName = (
  borrower: { name: string | null; department: string | null } | null,
  borrowerId: string
) => {
  if (!borrower?.name) return borrowerId;
  return `${borrower.department ?? "부서 미지정"} / ${borrower.name}`;
};
