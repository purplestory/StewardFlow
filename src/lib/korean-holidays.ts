/**
 * 대한민국 공휴일 API를 사용하여 공휴일 정보를 가져옵니다.
 * 
 * 사용 가능한 API:
 * 1. 공공데이터포털 한국천문연구원 특일 정보 API (API 키 필요)
 * 2. 무료 공휴일 API (예: https://date.nager.at/api/v3/PublicHolidays/{year}/KR)
 */

type Holiday = {
  date: string; // YYYY-MM-DD 형식
  name: string;
  localName: string;
};

/**
 * Nager.Date API를 사용하여 한국 공휴일 목록을 가져옵니다.
 * 무료 API이며 API 키가 필요 없습니다.
 * 
 * @param year 연도 (예: 2026)
 * @returns 공휴일 목록
 */
export async function getKoreanHolidays(year: number): Promise<Holiday[]> {
  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`,
      {
        next: { revalidate: 86400 }, // 24시간 캐시
      }
    );

    if (!response.ok) {
      console.warn(`공휴일 API 호출 실패 (${year}):`, response.statusText);
      return [];
    }

    const data = await response.json();
    return data.map((holiday: any) => ({
      date: holiday.date,
      name: holiday.name,
      localName: holiday.localName || holiday.name,
    }));
  } catch (error) {
    console.error("공휴일 API 오류:", error);
    return [];
  }
}

/**
 * 특정 날짜가 공휴일인지 확인합니다.
 * 
 * @param date 확인할 날짜
 * @param holidays 공휴일 목록 (선택사항, 없으면 API에서 가져옴)
 * @returns 공휴일 여부
 */
export async function isHoliday(
  date: Date,
  holidays?: Holiday[]
): Promise<boolean> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  // 일요일은 공휴일
  if (dayOfWeek === 0) {
    return true;
  }

  // 공휴일 목록이 없으면 API에서 가져오기
  const holidayList = holidays || (await getKoreanHolidays(year));

  // 날짜 형식: YYYY-MM-DD
  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // 공휴일 목록에서 확인
  return holidayList.some((holiday) => holiday.date === dateString);
}

/**
 * 여러 연도의 공휴일을 한 번에 가져옵니다.
 * 
 * @param years 연도 배열
 * @returns 공휴일 목록
 */
export async function getKoreanHolidaysForYears(
  years: number[]
): Promise<Holiday[]> {
  const promises = years.map((year) => getKoreanHolidays(year));
  const results = await Promise.all(promises);
  return results.flat();
}

/**
 * 현재 연도와 다음 연도의 공휴일을 가져옵니다.
 * 
 * @returns 공휴일 목록
 */
export async function getCurrentYearHolidays(): Promise<Holiday[]> {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  return getKoreanHolidaysForYears([currentYear, nextYear]);
}
