/**
 * 카카오톡 메시지 발송 유틸리티
 * 카카오 비즈니스 메시지 API를 사용하여 알림톡/친구톡 발송
 */

type KakaoMessageResult = {
  ok: boolean;
  message?: string;
  messageId?: string;
};

/**
 * 카카오톡 알림톡 발송
 * @param phoneNumber 수신자 전화번호 (하이픈 제거, 숫자만)
 * @param templateCode 카카오톡 템플릿 코드
 * @param templateArgs 템플릿 변수 (key-value)
 */
export async function sendKakaoAlimTalk(
  phoneNumber: string,
  templateCode: string,
  templateArgs: Record<string, string>
): Promise<KakaoMessageResult> {
  // 카카오 비즈니스 메시지 API 키 확인
  const apiKey = process.env.KAKAO_BUSINESS_API_KEY;
  const channelId = process.env.KAKAO_CHANNEL_ID;
  const serviceUrl = process.env.KAKAO_SERVICE_URL;

  if (!apiKey || !channelId) {
    console.warn("카카오톡 API 키가 설정되지 않았습니다. 알림을 발송하지 않습니다.");
    return { ok: false, message: "카카오톡 API 키가 설정되지 않았습니다." };
  }

  // 전화번호 정규화 (하이픈 제거, 숫자만)
  const normalizedPhone = phoneNumber.replace(/[^0-9]/g, "");

  if (!normalizedPhone || normalizedPhone.length < 10) {
    return { ok: false, message: "유효하지 않은 전화번호입니다." };
  }

  try {
    // 카카오 비즈니스 메시지 API 호출
    // 실제 구현은 카카오 비즈니스 메시지 API 문서를 참고하세요
    // https://developers.kakao.com/docs/latest/ko/business-message/rest-api
    
    const response = await fetch("https://kapi.kakao.com/v1/alimtalk/send", {
      method: "POST",
      headers: {
        "Authorization": `KakaoAK ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        template_code: templateCode,
        receiver_phone_number: normalizedPhone,
        template_args: templateArgs,
        service_url: serviceUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "알 수 없는 오류" }));
      console.error("카카오톡 발송 실패:", errorData);
      return { ok: false, message: errorData.message || "카카오톡 발송에 실패했습니다." };
    }

    const data = await response.json();
    return { ok: true, messageId: data.message_id };
  } catch (error) {
    console.error("카카오톡 발송 오류:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "카카오톡 발송 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 예약 신청 알림 (관리자용)
 */
export async function sendReservationRequestToAdmin(
  adminPhone: string,
  resourceName: string,
  borrowerName: string,
  borrowerDepartment: string | null,
  startDate: string,
  endDate: string,
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  const deptText = borrowerDepartment ? `(${borrowerDepartment})` : "";
  
  return sendKakaoAlimTalk(adminPhone, "RESERVATION_REQUEST_ADMIN", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    borrower_name: borrowerName,
    borrower_department: deptText,
    start_date: new Date(startDate).toLocaleDateString("ko-KR"),
    end_date: new Date(endDate).toLocaleDateString("ko-KR"),
  });
}

/**
 * 예약 신청 알림 (신청자용)
 */
export async function sendReservationRequestToBorrower(
  borrowerPhone: string,
  resourceName: string,
  startDate: string,
  endDate: string,
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  
  return sendKakaoAlimTalk(borrowerPhone, "RESERVATION_REQUEST_BORROWER", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    start_date: new Date(startDate).toLocaleDateString("ko-KR"),
    end_date: new Date(endDate).toLocaleDateString("ko-KR"),
  });
}

/**
 * 예약 승인 알림 (신청자용) - 반납 기한 포함
 */
export async function sendReservationApprovalToBorrower(
  borrowerPhone: string,
  resourceName: string,
  startDate: string,
  endDate: string,
  returnDeadline: string,
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  
  return sendKakaoAlimTalk(borrowerPhone, "RESERVATION_APPROVED", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    start_date: new Date(startDate).toLocaleDateString("ko-KR"),
    end_date: new Date(endDate).toLocaleDateString("ko-KR"),
    return_deadline: new Date(returnDeadline).toLocaleDateString("ko-KR"),
  });
}

/**
 * 반납 결과 등록 알림 (관리자용)
 */
export async function sendReturnSubmittedToAdmin(
  adminPhone: string,
  resourceName: string,
  borrowerName: string,
  returnDate: string,
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  
  return sendKakaoAlimTalk(adminPhone, "RETURN_SUBMITTED_ADMIN", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    borrower_name: borrowerName,
    return_date: new Date(returnDate).toLocaleDateString("ko-KR"),
  });
}

/**
 * 반납 결과 등록 알림 (신청자용)
 */
export async function sendReturnSubmittedToBorrower(
  borrowerPhone: string,
  resourceName: string,
  returnDate: string,
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  
  return sendKakaoAlimTalk(borrowerPhone, "RETURN_SUBMITTED_BORROWER", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    return_date: new Date(returnDate).toLocaleDateString("ko-KR"),
  });
}

/**
 * 반납 승인 알림 (관리자용)
 */
export async function sendReturnApprovalToAdmin(
  adminPhone: string,
  resourceName: string,
  borrowerName: string,
  verificationStatus: "verified" | "rejected",
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  const statusText = verificationStatus === "verified" ? "승인" : "반려";
  
  return sendKakaoAlimTalk(adminPhone, "RETURN_APPROVED_ADMIN", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    borrower_name: borrowerName,
    verification_status: statusText,
  });
}

/**
 * 반납 승인 알림 (신청자용)
 */
export async function sendReturnApprovalToBorrower(
  borrowerPhone: string,
  resourceName: string,
  verificationStatus: "verified" | "rejected",
  resourceType: "asset" | "space" | "vehicle"
): Promise<KakaoMessageResult> {
  const resourceTypeLabel = resourceType === "asset" ? "물품" : resourceType === "space" ? "공간" : "차량";
  const statusText = verificationStatus === "verified" ? "승인" : "반려";
  
  return sendKakaoAlimTalk(borrowerPhone, "RETURN_APPROVED_BORROWER", {
    resource_type: resourceTypeLabel,
    resource_name: resourceName,
    verification_status: statusText,
  });
}
