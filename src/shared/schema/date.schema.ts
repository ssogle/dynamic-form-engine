import { z } from "zod";

/**
 * IANA 시간대(timezone) 문자열의 런타임 유효성을 검증합니다.
 *
 * @param timezone 검증할 IANA 시간대 식별자 (예: "Asia/Seoul", "UTC")
 * @returns 유효한 IANA 시간대 여부
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * 순수 달력 날짜(YYYY-MM-DD) 문자열이 실제 그레고리력 날짜로 유효한지 검증합니다.
 * 예: "2026-02-31", "2026-04-31", "2025-02-29"는 false를 반환하고, 윤년 "2024-02-29"는 true를 반환합니다.
 *
 * @param value 검증할 날짜 문자열
 * @returns 실제 달력에 존재하는 유효한 날짜 여부
 */
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

/**
 * YYYY-MM-DD 포맷 및 실존 달력 날짜를 검증하는 공용 Zod 스키마
 */
export const calendarDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.")
  .refine(isValidCalendarDate, "유효한 달력 날짜가 아닙니다.");

/**
 * 원천 목록 및 집계 드릴다운에서 공통 사용하는 기간 필터 파라미터 Zod 스키마
 *
 * - startDate / endDate: 실존 그레고리력 달력 날짜(YYYY-MM-DD)
 * - dateFieldId: 기간 필터링 기준이 되는 폼 내 date 필드 ID (미지정 시 createdAt 기준)
 */
export const submissionDateRangeFilterSchema = z.object({
  startDate: calendarDateStringSchema.optional(),
  endDate: calendarDateStringSchema.optional(),
  dateFieldId: z.string().min(1).optional(),
});

/**
 * 기간 필터 파라미터 TypeScript 정적 타입 (submissionDateRangeFilterSchema 파생)
 */
export type SubmissionDateRangeFilter = z.infer<typeof submissionDateRangeFilterSchema>;

/**
 * 시작일과 종료일이 모두 존재할 때 startDate <= endDate 순서를 검증해 Zod 컨텍스트에 이슈를 등록합니다.
 *
 * @param val startDate/endDate를 포함한 객체
 * @param ctx Zod superRefine 컨텍스트
 */
export function refineDateRangeOrder(
  val: { startDate?: string | undefined; endDate?: string | undefined },
  ctx: z.RefinementCtx
): void {
  if (val.startDate && val.endDate && val.startDate > val.endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "종료일(endDate)은 시작일(startDate)보다 같거나 이후여야 합니다.",
    });
  }
}
