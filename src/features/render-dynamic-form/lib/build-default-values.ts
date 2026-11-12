import type { CoreFormField } from "@/entities/form";

/**
 * 폼 필드 정의 목록을 기반으로 폼 라이브러리(React Hook Form)에 주입할 기본값 맵을 생성하는 순수 함수
 *
 * [필드 타입별 기본값 매핑 규칙]
 * - section: 데이터 입력 컨트롤이 아니므로 기본값 맵에서 건너뜁니다.
 * - number, date: 빈 상태(undefined)로 초기화하여 Zod 타입 변환과 충돌하지 않도록 합니다.
 * - switch: 불리언 기본값 false
 * - checkbox: 옵션이 정의된 다중 선택이면 빈 배열([]), 단일 토글이면 false
 * - relation: 다중 참조(multiple: true)이면 빈 배열([]), 단일 참조이면 undefined
 * - text, textarea, select, radio 등: 빈 문자열("")
 *
 * @param fields 활성 폼 필드 정의 배열
 * @returns 필드 ID를 키로 하는 기본값 딕셔너리
 */
export function buildDefaultValues(fields: CoreFormField[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of fields) {
    // 1. 레이아웃 전용 구분선(section) 필드는 기본값에서 제외
    if (field.type === "section") {
      continue;
    }

    // 2. 타입별 결정론적 기본값 할당
    if (field.type === "number" || field.type === "date") {
      defaults[field.id] = undefined;
    } else if (field.type === "switch") {
      defaults[field.id] = false;
    } else if (field.type === "checkbox") {
      const hasOptions = Boolean(field.options && field.options.length > 0);
      defaults[field.id] = hasOptions ? [] : false;
    } else if (field.type === "relation") {
      defaults[field.id] = field.relationConfig?.multiple ? [] : undefined;
    } else {
      defaults[field.id] = "";
    }
  }

  return defaults;
}
