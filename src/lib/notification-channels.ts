import { sendTelegramMessage } from "@/lib/telegram-message";
import { sendWebPushToUser } from "@/lib/web-push";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  sendReturnApprovalToAdmin,
  sendReturnApprovalToBorrower,
  sendReturnSubmittedToAdmin,
  sendReturnSubmittedToBorrower,
} from "@/lib/kakao-message";

type DispatchNotificationChannelsParams = {
  userId: string;
  type: string;
  payload?: Record<string, unknown> | null;
};

type ProfileChannelTarget = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
};

const isKakaoEnabled = () =>
  Boolean(process.env.KAKAO_BUSINESS_API_KEY) && Boolean(process.env.KAKAO_CHANNEL_ID);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getPushPath(type: string, payload: Record<string, unknown>): string {
  const resourceId = payload.resource_id as string | undefined;
  if (type.startsWith("asset_transfer_request")) return "/assets/transfers";
  if (type.startsWith("space") && resourceId) return `/spaces/${resourceId}`;
  if (type.startsWith("vehicle") && resourceId) return `/vehicles/${resourceId}`;
  if (resourceId) return `/assets/${resourceId}`;
  return "/notifications";
}

function getPushTitle(type: string): string {
  const titleMap: Record<string, string> = {
    reservation_created: "새 물품 예약 신청",
    reservation_status_changed: "물품 예약 상태 변경",
    space_reservation_created: "새 공간 예약 신청",
    space_reservation_status_changed: "공간 예약 상태 변경",
    vehicle_reservation_created: "새 차량 예약 신청",
    vehicle_reservation_status_changed: "차량 예약 상태 변경",
    asset_transfer_request_created: "불용품 양도 요청",
    asset_transfer_request_approved: "불용품 양도 요청 승인",
    asset_transfer_request_rejected: "불용품 양도 요청 반려",
    asset_transfer_request_cancelled: "불용품 양도 요청 취소",
    return_submitted: "반납 등록 알림",
    return_verified: "반납 확인 알림",
  };
  return titleMap[type] ?? "새 알림";
}

function getPushBody(type: string, payload: Record<string, unknown>): string {
  const resourceName = payload.resource_name as string | undefined;
  const status = payload.status as string | undefined;
  const verification = payload.verification_status as string | undefined;

  if (resourceName && verification) {
    return `${resourceName} (${verification})`;
  }
  if (resourceName && status) {
    return `${resourceName} (${status})`;
  }
  if (resourceName) {
    return resourceName;
  }
  if (type === "return_submitted") {
    return "새 반납 건이 등록되었습니다.";
  }
  if (type === "return_verified") {
    return "반납 확인 결과가 등록되었습니다.";
  }
  return "StewardFlow에서 알림을 확인해 주세요.";
}

function buildTelegramText(type: string, payload: Record<string, unknown>): string | null {
  const resourceType = escapeHtml((payload.resource_type as string | undefined) ?? "자원");
  const resourceName = escapeHtml((payload.resource_name as string | undefined) ?? "이름 없음");
  const status = (payload.status as string | undefined) ?? "";
  const fromDepartment = escapeHtml((payload.from_department as string | undefined) ?? "미등록");
  const toDepartment = escapeHtml((payload.to_department as string | undefined) ?? "미등록");
  const verification = (payload.verification_status as string | undefined) ?? "";

  if (
    (type === "reservation_status_changed" ||
      type === "space_reservation_status_changed" ||
      type === "vehicle_reservation_status_changed") &&
    status === "approved"
  ) {
    return [
      "<b>[StewardFlow] 예약 승인</b>",
      `자원: ${resourceType} / ${resourceName}`,
      "상태: 승인됨",
    ].join("\n");
  }

  if (type === "return_submitted") {
    return [
      "<b>[StewardFlow] 반납 등록</b>",
      `자원: ${resourceType} / ${resourceName}`,
      "상태: 반납 확인 대기",
    ].join("\n");
  }

  if (type === "return_verified") {
    return [
      "<b>[StewardFlow] 반납 확인 결과</b>",
      `자원: ${resourceType} / ${resourceName}`,
      `결과: ${escapeHtml(verification || "처리됨")}`,
    ].join("\n");
  }

  if (type === "asset_transfer_request_created") {
    return [
      "<b>[StewardFlow] 불용품 양도 요청</b>",
      `자원: ${resourceName}`,
      `이동: ${fromDepartment} -> ${toDepartment}`,
    ].join("\n");
  }

  if (type === "asset_transfer_request_approved" || type === "asset_transfer_request_rejected") {
    return [
      "<b>[StewardFlow] 불용품 양도 요청 처리</b>",
      `자원: ${resourceName}`,
      `결과: ${type === "asset_transfer_request_approved" ? "승인" : "거절"}`,
      `이동: ${fromDepartment} -> ${toDepartment}`,
    ].join("\n");
  }

  if (type === "asset_transfer_request_cancelled") {
    return [
      "<b>[StewardFlow] 불용품 양도 요청 취소</b>",
      `자원: ${resourceName}`,
      `이동: ${fromDepartment} -> ${toDepartment}`,
    ].join("\n");
  }

  return null;
}

export async function dispatchNotificationChannels({
  userId,
  type,
  payload,
}: DispatchNotificationChannelsParams) {
  const safePayload = payload ?? {};
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,name,phone,role")
    .eq("id", userId)
    .maybeSingle<ProfileChannelTarget>();

  const recipient = profile ?? null;
  const recipientPhone = recipient?.phone ?? null;
  const resourceType = (safePayload.resource_type as "asset" | "space" | "vehicle" | undefined) ?? "asset";
  const resourceName = (safePayload.resource_name as string | undefined) ?? "자원";
  const resourceId = (safePayload.resource_id as string | undefined) ?? null;
  const borrowerName = (safePayload.borrower_name as string | undefined) ?? "신청자";
  const returnDate = (safePayload.return_date as string | undefined) ?? new Date().toISOString();
  const isAdminLike = recipient?.role === "admin" || recipient?.role === "manager";
  const verificationRaw =
    (safePayload.verification_status as "verified" | "rejected" | string | undefined) ??
    (safePayload.status as "verified" | "rejected" | string | undefined);
  const verificationStatus: "verified" | "rejected" =
    verificationRaw === "rejected" ? "rejected" : "verified";

  const pushResult = await sendWebPushToUser({ userId });

  const telegramText = buildTelegramText(type, safePayload);
  const telegramResult = telegramText
    ? await sendTelegramMessage(telegramText)
    : { ok: false, message: "skip" };

  let kakaoResult: { ok: boolean; message?: string } = { ok: false, message: "skip" };
  if (isKakaoEnabled() && recipientPhone) {
    if (type === "return_submitted") {
      kakaoResult = isAdminLike
        ? await sendReturnSubmittedToAdmin(
            recipientPhone,
            resourceName,
            borrowerName,
            returnDate,
            resourceType,
            resourceId
          )
        : await sendReturnSubmittedToBorrower(
            recipientPhone,
            resourceName,
            returnDate,
            resourceType,
            resourceId
          );
    } else if (type === "return_verified") {
      kakaoResult = isAdminLike
        ? await sendReturnApprovalToAdmin(
            recipientPhone,
            resourceName,
            borrowerName,
            verificationStatus,
            resourceType,
            resourceId
          )
        : await sendReturnApprovalToBorrower(
            recipientPhone,
            resourceName,
            verificationStatus,
            resourceType,
            resourceId
          );
    }
  }

  return {
    push: {
      ...pushResult,
      title: getPushTitle(type),
      body: getPushBody(type, safePayload),
      path: getPushPath(type, safePayload),
    },
    telegram: telegramResult,
    kakao: kakaoResult,
  };
}
