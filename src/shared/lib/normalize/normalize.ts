/**
 * normalizeStringIds 옵션 인터페이스
 */
export interface NormalizeStringIdsOptions {
  /** 반환할 최대 식별자 개수를 제한합니다 (예: 단일 선택일 때 1). */
  maxItems?: number | undefined;
}

/**
 * 단일 문자열 또는 문자열 배열 입력을 공백 제거·중복 제거된 정규화 ID 배열로 변환합니다.
 *
 * - 비문자열(null, undefined, 숫자, 객체 등)과 공백만 있는 문자열은 제외합니다.
 * - 입력 순서를 유지하며 중복 식별자를 제거합니다.
 *
 * @param rawVal 단일 문자열, 문자열 배열 또는 알 수 없는 원시 값
 * @param options 최대 개수 제한 옵션
 * @returns 정제된 식별자 문자열 배열
 */
export function normalizeStringIds(
  rawVal: unknown,
  options: NormalizeStringIdsOptions = {}
): string[] {
  const { maxItems } = options;
  const candidates = Array.isArray(rawVal) ? rawVal : [rawVal];
  const uniqueIds: string[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;

    seen.add(trimmed);
    uniqueIds.push(trimmed);

    if (maxItems !== undefined && uniqueIds.length >= maxItems) {
      break;
    }
  }

  return uniqueIds;
}
