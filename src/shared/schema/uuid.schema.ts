import { z } from "zod";

/**
 * 표준 UUID(RFC 4122/9562) 문자열 검증용 공용 Zod 스키마
 */
export const uuidSchema = z.uuid("유효한 UUID 형식이 아닙니다.");

/**
 * 전달된 값이 표준 UUID(RFC 4122/9562) 형식의 문자열인지 판별합니다.
 *
 * 문자열 앞뒤 공백을 제거한 뒤 Zod 내장 `z.uuid()` 검증기로 검사하며,
 * 비문자열 입력에는 `false`를 반환합니다.
 *
 * @param value 검사할 원시 값
 * @returns UUID 형식 문자열 여부
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidSchema.safeParse(value.trim()).success;
}
