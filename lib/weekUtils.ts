/**
 * 주차 번호: YYYY * 1000 + MM * 10 + W (W = 1~5, 해당 월의 N주차)
 * 예: 2026년 2월 1주차 → 2026021
 */
export function getCurrentWeekNum(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const weekOfMonth = getWeekOfMonth(now.getDate());
  return year * 1000 + month * 10 + weekOfMonth;
}

/** 해당 월의 몇 주차인지 (1~5) */
function getWeekOfMonth(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

export function parseWeekNum(weekNum: number): { year: number; month: number; week: number } {
  const year = Math.floor(weekNum / 1000);
  const rest = weekNum % 1000;
  const month = Math.floor(rest / 10);
  const week = rest % 10;
  return { year, month, week };
}

/** 퀴즈 제목: "20xx년 x월 x주차 토익 part.5 모의고사" */
export function formatWeeklyQuizTitle(weekNum: number): string {
  const { year, month, week } = parseWeekNum(weekNum);
  return `${year}년 ${month}월 ${week}주차 토익 part.5 모의고사`;
}
