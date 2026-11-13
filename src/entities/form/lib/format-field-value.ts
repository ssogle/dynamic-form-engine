import type { CoreFormField } from "../schema/form-field.schema";

/**
 * 폼 필드의 저장 원시값(rawValue)을 목록 테이블·상세 화면·서브테이블 전반에서
 * 일관된 사용자 친화적 문자열로 포맷팅합니다.
 *
 * - undefined / null / "" / 빈 배열 -> fallback(기본 "-")
 * - boolean (또는 switch 필드의 "true"/"false" 문자열) -> "예" / "아니오"
 * - select / radio / checkbox 등 options 보유 필드 -> 내부 코드(value)를 옵션 한글 label(비활성 옵션 포함)로 매핑
 * - 배열 -> 각 원소를 매핑 후 ", "로 결합
 * - 객체 -> JSON 직렬화 문자열
 *
 * @param rawValue 제출 데이터 내 필드 원시 값
 * @param field 해당 필드의 스키마 메타데이터 (옵션 라벨 매핑 및 switch 문자열 판별용, 생략 가능)
 * @param fallback 빈 값일 때 반환할 대체 문자열 (기본값: "-")
 * @returns 화면 표시용 포맷팅 문자열
 */
export function formatFieldDisplayValue(
  rawValue: unknown,
  field?: Pick<CoreFormField, "type" | "options"> | null,
  fallback = "-"
): string {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  if (typeof rawValue === "boolean") {
    return rawValue ? "예" : "아니오";
  }

  if (field?.type === "switch") {
    if (rawValue === "true") return "예";
    if (rawValue === "false") return "아니오";
  }

  const options = field?.options;
  const optionLabelMap =
    options && options.length > 0
      ? new Map(options.map((opt) => [opt.value, opt.label]))
      : undefined;

  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0) {
      return fallback;
    }
    return rawValue
      .map((item) => {
        if (item !== null && typeof item === "object") {
          return JSON.stringify(item);
        }
        const key = String(item);
        return optionLabelMap?.get(key) ?? key;
      })
      .join(", ");
  }

  if (typeof rawValue === "object") {
    return JSON.stringify(rawValue);
  }

  const strVal = String(rawValue);
  if (optionLabelMap) {
    return optionLabelMap.get(strVal) ?? strVal;
  }

  return strVal;
}
