export type NotificationRow = {
  id: string;
  type: string;
  status: "pending" | "sent" | "failed";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const typeLabel: Record<string, string> = {
  reservation_created: "물품 예약 신청",
  reservation_status_changed: "물품 예약 상태 변경",
  space_reservation_created: "공간 예약 신청",
  space_reservation_status_changed: "공간 예약 상태 변경",
  vehicle_reservation_created: "차량 예약 신청",
  vehicle_reservation_status_changed: "차량 예약 상태 변경",
  reservation_cancel_requested: "물품 예약 취소 요청",
  space_reservation_cancel_requested: "공간 예약 취소 요청",
  vehicle_reservation_cancel_requested: "차량 예약 취소 요청",
  book_loan_cancel_requested: "도서 대출 취소 요청",
  return_submitted: "반납 등록",
  return_verified: "반납 확인",
  asset_transfer_request_created: "불용품 양도 요청",
  asset_transfer_request_approved: "불용품 양도 요청 승인",
  asset_transfer_request_rejected: "불용품 양도 요청 거절",
  asset_transfer_request_cancelled: "불용품 양도 요청 취소",
};

const notificationStatusLabel: Record<NotificationRow["status"], string> = {
  pending: "대기",
  sent: "발송 완료",
  failed: "실패",
};

const reservationStatusLabel: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  returned: "반납 확인",
  rejected: "반려",
  borrowed: "대출 중",
  overdue: "연체",
  cancelled: "취소",
};

const getStatusBadge = (status: NotificationRow["status"]) => {
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "sent") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  return "bg-neutral-100 text-neutral-700";
};

const getReservationStatusBadge = (status: string) => {
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "returned") return "bg-neutral-100 text-neutral-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-neutral-100 text-neutral-700";
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
};

export const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatGroupDate = (value: string) => {
  const today = new Date();
  const target = new Date(value);

  if (Number.isNaN(target.getTime())) {
    return value;
  }

  const toKey = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const diffDays = Math.floor(
    (toKey(today) - toKey(target)) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return "최근 7일";

  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(
    target
  );
};

export const groupByDate = (items: NotificationRow[]) => {
  const groups = new Map<string, NotificationRow[]>();

  items.forEach((item) => {
    const dateKey = item.created_at.split("T")[0];
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(item);
    groups.set(dateKey, bucket);
  });

  return Array.from(groups.entries()).map(([date, values]) => ({
    date,
    items: values,
  }));
};

export const renderTitle = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const status = payload.status as string | undefined;
  const resourceName = payload.resource_name as string | undefined;
  const title = typeLabel[item.type] ?? "알림";

  if (resourceName && status) {
    return `${title}: ${resourceName} (${reservationStatusLabel[status] ?? status})`;
  }

  if (resourceName) {
    return `${title}: ${resourceName}`;
  }

  if (status) {
    return `${title} (${status})`;
  }

  return title;
};

export const getSummaryText = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const startDate = payload.start_date as string | undefined;
  const endDate = payload.end_date as string | undefined;
  const status = payload.status as string | undefined;
  const resourceId = payload.resource_id as string | undefined;
  const resourceName = payload.resource_name as string | undefined;
  const fromDepartment = payload.from_department as string | undefined;
  const toDepartment = payload.to_department as string | undefined;
  const note = payload.note as string | undefined;
  const cancelReason = payload.cancel_reason as string | undefined;

  const parts: string[] = [];

  if (resourceName) {
    parts.push(`대상: ${resourceName}`);
  } else if (resourceId) {
    parts.push(`예약 ID: ${resourceId}`);
  }

  if (startDate && endDate) {
    parts.push(`기간 ${formatDateTime(startDate)} ~ ${formatDateTime(endDate)}`);
  }

  if (status) {
    parts.push(`상태 ${reservationStatusLabel[status] ?? status}`);
  }

  if (fromDepartment || toDepartment) {
    parts.push(
      `이동 ${fromDepartment ?? "미등록"} → ${toDepartment ?? "미등록"}`
    );
  }

  if (note) {
    parts.push(`사유 ${truncateText(note, 40)}`);
  }

  if (cancelReason) {
    parts.push(`취소 사유 ${truncateText(cancelReason, 40)}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" · ");
};

export const getTemplateText = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const resourceName = (payload.resource_name as string | undefined) ?? "대상";
  const status = payload.status as string | undefined;
  const fromDepartment = payload.from_department as string | undefined;
  const toDepartment = payload.to_department as string | undefined;
  const moveSummary =
    fromDepartment || toDepartment
      ? `(${fromDepartment ?? "미등록"} → ${toDepartment ?? "미등록"})`
      : "";
  const statusText = status
    ? reservationStatusLabel[status] ?? status
    : null;

  if (item.type === "reservation_created") {
    return `${resourceName} 물품 예약이 접수되었습니다.`;
  }

  if (item.type === "space_reservation_created") {
    return `${resourceName} 공간 예약이 접수되었습니다.`;
  }

  if (item.type === "vehicle_reservation_created") {
    return `${resourceName} 차량 예약이 접수되었습니다.`;
  }

  if (item.type === "reservation_status_changed" && statusText) {
    return `${resourceName} 예약 상태가 ${statusText}(으)로 변경되었습니다.`;
  }

  if (item.type === "space_reservation_status_changed" && statusText) {
    return `${resourceName} 공간 예약 상태가 ${statusText}(으)로 변경되었습니다.`;
  }

  if (item.type === "vehicle_reservation_status_changed" && statusText) {
    return `${resourceName} 차량 예약 상태가 ${statusText}(으)로 변경되었습니다.`;
  }

  if (item.type === "asset_transfer_request_created") {
    return `${resourceName} 불용품 양도 요청이 등록되었습니다. ${moveSummary}`;
  }

  if (item.type === "asset_transfer_request_approved") {
    return `${resourceName} 불용품 양도 요청이 승인되었습니다. ${moveSummary}`;
  }

  if (item.type === "asset_transfer_request_rejected") {
    return `${resourceName} 불용품 양도 요청이 거절되었습니다. ${moveSummary}`;
  }

  if (item.type === "asset_transfer_request_cancelled") {
    return `${resourceName} 불용품 양도 요청이 취소되었습니다. ${moveSummary}`;
  }

  return null;
};

type DetailRow = {
  label: string;
  value: string;
};

export const getDetailRows = (item: NotificationRow): DetailRow[] => {
  const payload = item.payload ?? {};
  const rows: DetailRow[] = [];
  const resourceName = payload.resource_name as string | undefined;
  const reservationStatus = payload.status as string | undefined;
  const startDate = payload.start_date as string | undefined;
  const endDate = payload.end_date as string | undefined;
  const fromDepartment = payload.from_department as string | undefined;
  const toDepartment = payload.to_department as string | undefined;
  const note = payload.note as string | undefined;
  const cancelReason = payload.cancel_reason as string | undefined;

  if (resourceName) {
    rows.push({ label: "대상", value: resourceName });
  }

  if (reservationStatus) {
    rows.push({
      label: "상태",
      value: reservationStatusLabel[reservationStatus] ?? reservationStatus,
    });
  }

  if (startDate && endDate) {
    rows.push({
      label: "기간",
      value: `${formatDateTime(startDate)} ~ ${formatDateTime(endDate)}`,
    });
  }

  if (fromDepartment || toDepartment) {
    rows.push({
      label: "이동",
      value: `${fromDepartment ?? "미등록"} → ${toDepartment ?? "미등록"}`,
    });
  }

  if (note) {
    rows.push({ label: "사유", value: note });
  }

  if (cancelReason) {
    rows.push({ label: "취소 사유", value: cancelReason });
  }

  return rows;
};

export const renderNotificationDetail = (item: NotificationRow) => {
  const rows = getDetailRows(item);
  if (rows.length === 0) return null;
  const period = rows.find((row) => row.label === "기간");
  if (!period) return null;
  return <p className="mt-1 text-xs text-neutral-500">{period.label}: {period.value}</p>;
};

export const renderSummary = (item: NotificationRow) => {
  const summary = getSummaryText(item);
  if (!summary) return null;
  return <p className="text-xs text-neutral-500">{summary}</p>;
};

export const renderTemplateMessage = (item: NotificationRow) => {
  const template = getTemplateText(item);
  if (!template) return null;
  return <p className="text-xs text-neutral-600">{template}</p>;
};

export const getThumbnail = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  return (payload.resource_image_url as string | undefined) ?? null;
};

export const getTypeColor = (type: string) => {
  if (type === "reservation_created") return "bg-blue-500";
  if (type === "reservation_status_changed") return "bg-indigo-500";
  if (type === "space_reservation_created") return "bg-emerald-500";
  if (type === "space_reservation_status_changed") return "bg-amber-500";
  if (type === "vehicle_reservation_created") return "bg-cyan-500";
  if (type === "vehicle_reservation_status_changed") return "bg-sky-500";
  if (type === "return_submitted") return "bg-orange-500";
  if (type === "return_verified") return "bg-teal-500";
  if (type === "book_loan_cancel_requested") return "bg-violet-500";
  if (type.endsWith("reservation_cancel_requested")) return "bg-amber-500";
  if (type.startsWith("asset_transfer_request")) return "bg-fuchsia-500";
  return "bg-neutral-400";
};

export const renderPageNumbers = (totalPages: number, current: number) => {
  const pages: Array<
    { type: "page"; page: number; key: string } | { type: "ellipsis"; key: string }
  > = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) {
      pages.push({ type: "page", page: i, key: `page-${i}` });
    }
    return pages;
  }

  pages.push({ type: "page", page: 1, key: "page-1" });

  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);

  if (left > 2) {
    pages.push({ type: "ellipsis", key: "ellipsis-left" });
  }

  for (let i = left; i <= right; i += 1) {
    pages.push({ type: "page", page: i, key: `page-${i}` });
  }

  if (right < totalPages - 1) {
    pages.push({ type: "ellipsis", key: "ellipsis-right" });
  }

  pages.push({
    type: "page",
    page: totalPages,
    key: `page-${totalPages}`,
  });

  return pages;
};

export const getResourcePath = (item: NotificationRow) => {
  const payload = item.payload ?? {};
  const resourceId = payload.resource_id as string | undefined;
  const resourceType = payload.resource_type as string | undefined;

  if (item.type.startsWith("asset_transfer_request")) {
    return "/assets/transfers";
  }

  if (item.type.startsWith("book_loan")) {
    return "/books/manage";
  }

  if (!resourceId) {
    return "/notifications";
  }

  if (item.type.startsWith("space")) {
    return `/spaces/${resourceId}`;
  }

  if (item.type.startsWith("vehicle")) {
    return `/vehicles/${resourceId}`;
  }

  if (item.type.startsWith("return")) {
    if (resourceType === "space") return `/spaces/${resourceId}`;
    if (resourceType === "vehicle") return `/vehicles/${resourceId}`;
    return `/assets/${resourceId}`;
  }

  return `/assets/${resourceId}`;
};

export const getTypeIcon = (type: string) => {
  if (type.startsWith("space")) return "S";
  if (type.startsWith("vehicle")) return "V";
  if (type.startsWith("return")) return "R";
  if (type.startsWith("reservation")) return "A";
  if (type.startsWith("asset_transfer_request")) return "T";
  if (type.startsWith("book_loan")) return "B";
  return "?";
};

export const getItemStatusLabel = (item: NotificationRow) => {
  const reservationStatus = (item.payload?.status as string | undefined) ?? null;

  if (reservationStatus && reservationStatusLabel[reservationStatus]) {
    return {
      label: "예약 상태",
      value: reservationStatusLabel[reservationStatus],
      badgeClass: getReservationStatusBadge(reservationStatus),
    };
  }

  return {
    label: "알림 상태",
    value: notificationStatusLabel[item.status],
    badgeClass: getStatusBadge(item.status),
  };
};
