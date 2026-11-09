import { format, formatDistanceToNow, isValid } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * 날짜 포맷팅 입력 지원 타입
 */
export type DateInput = Date | string | number | null | undefined;

/**
 * 입력값이 유효한 Date 객체인지 안전하게 검증하고 변환합니다.
 *
 * @param input Date 객체, ISO 문자열, 타임스탬프 숫자 또는 null/undefined
 * @returns 유효한 Date 객체 또는 변환 실패 시 null
 */
export function toSafeDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);
  return isValid(date) ? date : null;
}

/**
 * 날짜를 지정된 형식으로 안전하게 포맷팅합니다.
 * 유효하지 않거나 null/undefined인 경우 fallback 문자열(기본값: "-")을 반환합니다.
 *
 * @param date 포맷팅할 대상 일시
 * @param pattern 포맷 패턴 문자열 (기본값: "yyyy.MM.dd")
 * @param fallback 변환 실패 시 반환할 대체 문자열 (기본값: "-")
 * @returns 포맷팅된 문자열
 */
export function formatDate(date: DateInput, pattern = "yyyy.MM.dd", fallback = "-"): string {
  const safeDate = toSafeDate(date);
  if (!safeDate) {
    return fallback;
  }

  return format(safeDate, pattern, { locale: ko });
}

/**
 * 날짜와 시간을 "yyyy.MM.dd HH:mm" 표준 형식으로 포맷팅합니다.
 *
 * @param date 포맷팅할 대상 일시
 * @param fallback 변환 실패 시 반환할 대체 문자열 (기본값: "-")
 * @returns 포맷팅된 날짜 시간 문자열
 */
export function formatDateTime(date: DateInput, fallback = "-"): string {
  return formatDate(date, "yyyy.MM.dd HH:mm", fallback);
}

/**
 * 현재 시점 기준 상대적인 시간(예: "방금 전", "3분 전", "2일 전")을 한국어로 반환합니다.
 *
 * @param date 대상 일시
 * @param fallback 변환 실패 시 반환할 대체 문자열 (기본값: "-")
 * @returns 한국어 상대 시간 표현 문자열
 */
export function formatRelativeTime(date: DateInput, fallback = "-"): string {
  const safeDate = toSafeDate(date);
  if (!safeDate) {
    return fallback;
  }

  return formatDistanceToNow(safeDate, { addSuffix: true, locale: ko });
}

/**
 * 현재 시점의 UTC 표준 ISO-8601 문자열을 생성합니다.
 * (예: "2026-11-08T02:14:00.000Z")
 *
 * 날것의 new Date().toISOString() 호출 대신 본 함수를 사용하여
 * JSONB 필드나 API 통신 시 일관된 UTC 표준 문자열을 생성합니다.
 */
export function nowUtcIso(): string {
  return new Date().toISOString();
}

/**
 * 임의의 날짜 입력을 표준 UTC ISO-8601 문자열로 정규화합니다.
 * 유효하지 않거나 null/undefined인 경우 null을 반환합니다.
 */
export function toUtcIso(date: DateInput): string | null {
  const safeDate = toSafeDate(date);
  return safeDate ? safeDate.toISOString() : null;
}

/**
 * 로컬 타임존과 무관하게 항상 UTC 기준으로 일시를 포맷팅합니다.
 *
 * @param date 포맷팅할 대상 일시
 * @param pattern 포맷 패턴 (기본값: "yyyy.MM.dd HH:mm UTC")
 * @param fallback 변환 실패 시 반환할 대체 문자열 (기본값: "-")
 * @returns UTC 기준 포맷팅된 문자열
 */
export function formatUtc(
  date: DateInput,
  pattern = "yyyy.MM.dd HH:mm UTC",
  fallback = "-"
): string {
  const safeDate = toSafeDate(date);
  if (!safeDate) {
    return fallback;
  }

  const year = String(safeDate.getUTCFullYear());
  const month = String(safeDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getUTCDate()).padStart(2, "0");
  const hours = String(safeDate.getUTCHours()).padStart(2, "0");
  const minutes = String(safeDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(safeDate.getUTCSeconds()).padStart(2, "0");

  return pattern
    .replace("yyyy", year)
    .replace("MM", month)
    .replace("dd", day)
    .replace("HH", hours)
    .replace("mm", minutes)
    .replace("ss", seconds);
}
