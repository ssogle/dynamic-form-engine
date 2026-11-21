/**
 * 코어 폼 필드 타입별 사용자 친화적 한글 라벨 사전 (단일 진실 원천 - SSOT)
 */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "단문 텍스트",
  textarea: "장문 텍스트",
  number: "숫자",
  select: "선택 항목",
  radio: "라디오 선택",
  checkbox: "체크박스",
  date: "날짜",
  switch: "스위치",
  relation: "관계 참조",
};

/**
 * 필드 타입 코드에 대응하는 한글 표시 라벨을 반환합니다.
 */
export function getFieldTypeLabel(fieldType: string): string {
  return FIELD_TYPE_LABELS[fieldType] ?? fieldType;
}
