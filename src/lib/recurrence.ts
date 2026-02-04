/**
 * 반복 일정 생성 유틸리티 함수
 */

type RecurrenceConfig = {
  type: "none" | "weekly" | "monthly";
  interval: number; // 몇 주/달마다 반복
  endDate: string; // 반복 종료일 (ISO string)
  daysOfWeek?: number[]; // 매주 반복 시 요일 배열 (0=일요일, 1=월요일, ..., 6=토요일)
  dayOfMonth?: number; // 매월 반복 시 일 (1-31)
};

type DateRange = {
  start: Date;
  end: Date;
};

/**
 * 반복 일정의 모든 인스턴스를 생성합니다.
 * 
 * @param baseStartDate 기본 시작일
 * @param baseEndDate 기본 종료일
 * @param config 반복 설정
 * @returns 생성된 모든 날짜 범위 배열
 */
export function generateRecurringDates(
  baseStartDate: string,
  baseEndDate: string,
  config: RecurrenceConfig
): DateRange[] {
  if (config.type === "none") {
    return [
      {
        start: new Date(baseStartDate),
        end: new Date(baseEndDate),
      },
    ];
  }

  const baseStart = new Date(baseStartDate);
  const baseEnd = new Date(baseEndDate);
  const endDate = new Date(config.endDate);
  const duration = baseEnd.getTime() - baseStart.getTime(); // 밀리초 단위 기간

  const instances: DateRange[] = [];

  if (config.type === "weekly") {
    // 매주 반복
    const daysOfWeek = config.daysOfWeek || [baseStart.getDay()];
    let currentDate = new Date(baseStart);

    while (currentDate <= endDate) {
      // 현재 주의 모든 지정된 요일에 대해 인스턴스 생성
      for (const dayOfWeek of daysOfWeek) {
        const instanceStart = new Date(currentDate);
        // 현재 날짜를 해당 요일로 조정
        const dayDiff = dayOfWeek - instanceStart.getDay();
        instanceStart.setDate(instanceStart.getDate() + dayDiff);

        if (instanceStart > endDate) continue;
        if (instanceStart < baseStart && dayDiff < 0) continue; // 첫 주는 baseStart 이후만

        const instanceEnd = new Date(instanceStart);
        instanceEnd.setTime(instanceStart.getTime() + duration);

        instances.push({
          start: instanceStart,
          end: instanceEnd,
        });
      }

      // 다음 주로 이동 (interval 주마다)
      currentDate.setDate(currentDate.getDate() + 7 * config.interval);
    }
  } else if (config.type === "monthly") {
    // 매월 반복
    let currentDate = new Date(baseStart);
    const dayOfMonth = config.dayOfMonth || baseStart.getDate();

    while (currentDate <= endDate) {
      const instanceStart = new Date(currentDate);
      instanceStart.setDate(dayOfMonth);

      // 해당 월에 해당 일이 없는 경우 (예: 2월 30일) 마지막 날로 조정
      if (instanceStart.getDate() !== dayOfMonth) {
        instanceStart.setDate(0); // 이전 달의 마지막 날
      }

      if (instanceStart > endDate) break;
      if (instanceStart < baseStart) {
        // 다음 달로 이동
        currentDate.setMonth(currentDate.getMonth() + config.interval);
        continue;
      }

      const instanceEnd = new Date(instanceStart);
      instanceEnd.setTime(instanceStart.getTime() + duration);

      instances.push({
        start: instanceStart,
        end: instanceEnd,
      });

      // 다음 달로 이동 (interval 달마다)
      currentDate.setMonth(currentDate.getMonth() + config.interval);
    }
  }

  // 중복 제거 및 정렬
  const uniqueInstances = instances
    .filter((instance, index, self) => {
      const key = `${instance.start.toISOString()}-${instance.end.toISOString()}`;
      return index === self.findIndex((i) => `${i.start.toISOString()}-${i.end.toISOString()}` === key);
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return uniqueInstances;
}

/**
 * 요일 번호를 한국어 요일명으로 변환
 */
export function getDayName(dayOfWeek: number): string {
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return days[dayOfWeek] || "";
}

/**
 * 반복 설정을 사용자 친화적인 문자열로 변환
 */
export function formatRecurrenceDescription(config: RecurrenceConfig): string {
  if (config.type === "none") {
    return "반복 없음";
  }

  if (config.type === "weekly") {
    const days = config.daysOfWeek || [];
    const dayNames = days.map(getDayName).join(", ");
    const intervalText = config.interval === 1 ? "매" : `${config.interval}주마다`;
    return `${intervalText}주 ${dayNames}`;
  }

  if (config.type === "monthly") {
    const intervalText = config.interval === 1 ? "매" : `${config.interval}달마다`;
    const dayText = config.dayOfMonth ? `${config.dayOfMonth}일` : "같은 날";
    return `${intervalText}월 ${dayText}`;
  }

  return "알 수 없음";
}
