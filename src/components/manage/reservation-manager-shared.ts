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
  const startDate = parseReservationDateTime(start);
  const endDate = parseReservationDateTime(end);
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

export const isValidDate = (value: Date | null | undefined): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

export const parseReservationDateTime = (value: string) => {
  if (!value) {
    return new Date(Number.NaN);
  }

  const normalized = value
    .trim()
    .split("~")[0]
    .trim()
    .replace(/오전\s*0(?=\d)/g, "오전 ")
    .replace(/오후\s*0(?=\d)/g, "오후 ");

  // Unix timestamp 문자열(초/밀리초) 지원
  if (/^\d{10,13}$/.test(normalized)) {
    const raw = Number(normalized);
    if (!Number.isNaN(raw)) {
      const millis = normalized.length === 10 ? raw * 1000 : raw;
      const timestampDate = new Date(millis);
      if (!Number.isNaN(timestampDate.getTime())) {
        return timestampDate;
      }
    }
  }

  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  // timezone 오프셋이 +0900 형태인 경우 Safari/일부 런타임 호환 보정 (+09:00)
  const withColonOffset = normalized.replace(
    /([+-]\d{2})(\d{2})$/,
    "$1:$2"
  );
  const withColonDate = new Date(withColonOffset);
  if (!Number.isNaN(withColonDate.getTime())) {
    return withColonDate;
  }

  // ISO 오프셋이 +09 형태(분 생략)로 넘어오는 경우 +09:00으로 보정
  const withFullHourOffset = withColonOffset.replace(/([+-]\d{2})$/, "$1:00");
  const withFullHourOffsetDate = new Date(withFullHourOffset);
  if (!Number.isNaN(withFullHourOffsetDate.getTime())) {
    return withFullHourOffsetDate;
  }

  // Safari 호환: "YYYY-MM-DD HH:mm:ss+09:00" -> "YYYY-MM-DDTHH:mm:ss+09:00"
  const safariCompatible = new Date(withColonOffset.replace(/\s+/, "T"));
  if (!Number.isNaN(safariCompatible.getTime())) {
    return safariCompatible;
  }

  // Safari 호환: timezone 앞 공백 제거 ("... 09:00 +09:00" -> "... 09:00+09:00")
  const compactTimezone = withColonOffset.replace(/\s+([+-]\d{2}:\d{2})$/, "$1");
  const compactTimezoneParsed = new Date(compactTimezone.replace(/\s+/, "T"));
  if (!Number.isNaN(compactTimezoneParsed.getTime())) {
    return compactTimezoneParsed;
  }

  // timezone이 없는 문자열도 로컬 시간으로 파싱되도록 보정
  const localLike = withColonOffset.replace(/\s+/, "T").replace(/Z$/i, "");
  const localParsed = new Date(localLike);
  if (!Number.isNaN(localParsed.getTime())) {
    return localParsed;
  }

  // "YYYY-MM-DD 오전 03:00" / "YYYY-MM-DD 오후 6:20" 포맷 보정
  const dashedKoreanMeridiemMatch = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s*(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (dashedKoreanMeridiemMatch) {
    const year = Number(dashedKoreanMeridiemMatch[1]);
    const month = Number(dashedKoreanMeridiemMatch[2]) - 1;
    const day = Number(dashedKoreanMeridiemMatch[3]);
    const meridiem = dashedKoreanMeridiemMatch[4];
    let hour = Number(dashedKoreanMeridiemMatch[5]);
    const minute = Number(dashedKoreanMeridiemMatch[6]);
    const second = Number(dashedKoreanMeridiemMatch[7] ?? "0");

    if (meridiem === "오후" && hour < 12) {
      hour += 12;
    }
    if (meridiem === "오전" && hour === 12) {
      hour = 0;
    }
    return new Date(year, month, day, hour, minute, second);
  }

  // "YYYY-MM-DD" 를 로컬 자정으로 파싱
  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month, day, 0, 0, 0);
  }

  // "2026. 2. 24. 09:00" / "2026.2.24 09:00" 같은 포맷 보정
  const dottedMatch = normalized.match(
    /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dottedMatch) {
    const year = Number(dottedMatch[1]);
    const month = Number(dottedMatch[2]) - 1;
    const day = Number(dottedMatch[3]);
    const hour = Number(dottedMatch[4] ?? "0");
    const minute = Number(dottedMatch[5] ?? "0");
    const second = Number(dottedMatch[6] ?? "0");
    return new Date(year, month, day, hour, minute, second);
  }

  // "2026. 2. 24. 오전 09:00" / "2026.2.24 오후 3:20" 같은 포맷 보정
  const dottedKoreanMeridiemMatch = normalized.match(
    /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (dottedKoreanMeridiemMatch) {
    const year = Number(dottedKoreanMeridiemMatch[1]);
    const month = Number(dottedKoreanMeridiemMatch[2]) - 1;
    const day = Number(dottedKoreanMeridiemMatch[3]);
    const meridiem = dottedKoreanMeridiemMatch[4];
    let hour = Number(dottedKoreanMeridiemMatch[5]);
    const minute = Number(dottedKoreanMeridiemMatch[6]);
    const second = Number(dottedKoreanMeridiemMatch[7] ?? "0");

    if (meridiem === "오후" && hour < 12) {
      hour += 12;
    }
    if (meridiem === "오전" && hour === 12) {
      hour = 0;
    }
    return new Date(year, month, day, hour, minute, second);
  }

  // "2026년 2월 24일 오전 09:00" 같은 한국어 로케일 문자열 보정
  const koreanMatch = normalized.match(
    /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s*(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (koreanMatch) {
    const year = Number(koreanMatch[1]);
    const month = Number(koreanMatch[2]) - 1;
    const day = Number(koreanMatch[3]);
    const meridiem = koreanMatch[4];
    let hour = Number(koreanMatch[5] ?? "0");
    const minute = Number(koreanMatch[6] ?? "0");
    const second = Number(koreanMatch[7] ?? "0");

    if (meridiem === "오후" && hour < 12) {
      hour += 12;
    }
    if (meridiem === "오전" && hour === 12) {
      hour = 0;
    }
    return new Date(year, month, day, hour, minute, second);
  }

  // 마지막 보정: 날짜만 추출 가능한 임의 포맷("YYYY/MM/DD ...", "YYYY.MM.DD ...")
  // + 시간 표기는 오전/오후/AM/PM + HH:mm(:ss) 또는 HH시mm분을 허용.
  const baseMatch = normalized.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (baseMatch) {
    const year = Number(baseMatch[1]);
    const month = Number(baseMatch[2]) - 1;
    const day = Number(baseMatch[3]);
    const timeMatch = normalized.match(
      /(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})[:시]\s*(\d{1,2})(?:[:분]\s*(\d{1,2}))?/
    );

    if (!timeMatch) {
      return new Date(year, month, day, 0, 0, 0);
    }

    const meridiem = timeMatch[1]?.toLowerCase() ?? null;
    let hour = Number(timeMatch[2]);
    const minute = Number(timeMatch[3]);
    const second = Number(timeMatch[4] ?? "0");

    if ((meridiem === "오후" || meridiem === "pm") && hour < 12) {
      hour += 12;
    }
    if ((meridiem === "오전" || meridiem === "am") && hour === 12) {
      hour = 0;
    }

    return new Date(year, month, day, hour, minute, second);
  }

  return new Date(Number.NaN);
};

export const parseReservationDateTimeSafe = (value: string) => {
  const parsed = parseReservationDateTime(value);
  return isValidDate(parsed) ? parsed : null;
};

const normalizeDateInput = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const collectRangeCandidates = (startValue: string, endValue: string) => {
  const candidates: string[] = [];
  const append = (source: string) => {
    if (!source) return;
    candidates.push(source);
    if (source.includes("~")) {
      source
        .split("~")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => candidates.push(part));
    }
  };
  append(startValue);
  append(endValue);
  return candidates;
};

export const parseReservationDateRange = (startValue: string, endValue: string) => {
  const normalizedStart = normalizeDateInput(startValue);
  const normalizedEnd = normalizeDateInput(endValue);

  const start =
    parseReservationDateTimeSafe(normalizedStart) ??
    parseReservationDateTimeSafe(normalizedEnd);
  const end =
    parseReservationDateTimeSafe(normalizedEnd) ??
    parseReservationDateTimeSafe(normalizedStart);

  if (!start || !end) {
    // 백엔드 데이터가 단일 문자열(range 포함)로 저장된 경우를 대비한 fallback
    const parsedCandidates = collectRangeCandidates(normalizedStart, normalizedEnd)
      .map((value) => parseReservationDateTimeSafe(value))
      .filter((value): value is Date => value !== null);

    if (parsedCandidates.length === 0) {
      return null;
    }

    const sorted = [...parsedCandidates].sort(
      (a, b) => a.getTime() - b.getTime()
    );
    return {
      start: sorted[0],
      end: sorted[sorted.length - 1],
    };
  }

  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return { start: end, end: start };
};
