type TelegramMessageResult = {
  ok: boolean;
  message?: string;
  messageId?: number;
};

type ReservationTelegramParams = {
  resourceType: "asset" | "space" | "vehicle";
  resourceName: string;
  borrowerName: string;
  borrowerDepartment?: string | null;
  startDate: string;
  endDate: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
}

export async function sendTelegramMessage(
  text: string,
  chatId?: string
): Promise<TelegramMessageResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId ?? process.env.TELEGRAM_DEFAULT_CHAT_ID;

  if (!botToken || !targetChatId) {
    return {
      ok: false,
      message: "텔레그램 환경 변수가 설정되지 않았습니다.",
    };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: { message_id?: number } }
      | null;

    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.description ?? "텔레그램 발송에 실패했습니다.",
      };
    }

    return {
      ok: true,
      messageId: data.result?.message_id,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "텔레그램 발송 오류",
    };
  }
}

export async function sendReservationRequestToTelegram(
  params: ReservationTelegramParams
): Promise<TelegramMessageResult> {
  const resourceTypeLabel =
    params.resourceType === "asset"
      ? "물품"
      : params.resourceType === "space"
      ? "공간"
      : "차량";
  const department = params.borrowerDepartment
    ? ` (${escapeHtml(params.borrowerDepartment)})`
    : "";

  const lines = [
    "<b>[StewardFlow] 새 예약 신청</b>",
    `자원: ${resourceTypeLabel} / ${escapeHtml(params.resourceName)}`,
    `신청자: ${escapeHtml(params.borrowerName)}${department}`,
    `기간: ${formatDate(params.startDate)} ~ ${formatDate(params.endDate)}`,
  ];

  return sendTelegramMessage(lines.join("\n"));
}

