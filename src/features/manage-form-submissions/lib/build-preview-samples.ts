import { extractActiveFields, type CoreFormField, type Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";

/**
 * 샘플 날짜 필드 값 풀 (순수 YYYY-MM-DD 포맷)
 */
const SAMPLE_DATES = ["2026-11-18", "2026-11-12", "2026-11-05"] as const;

/**
 * 단일/라디오 선택형 필드에서 활성 옵션을 우선 선택해 샘플 값을 생성합니다.
 */
function pickSingleOptionSample(field: CoreFormField, index: number): string | undefined {
  const options = field.options ?? [];
  if (options.length === 0) {
    return undefined;
  }
  const activeOptions = options.filter((opt) => !opt.disabled);
  const pool = activeOptions.length > 0 ? activeOptions : options;
  return pool[index % pool.length]?.value;
}

/**
 * 체크박스 필드(옵션 배열 다중 선택 또는 단일 불리언)의 샘플 값을 생성합니다.
 */
function pickCheckboxSample(field: CoreFormField, index: number): string[] | boolean {
  const options = field.options ?? [];
  if (options.length === 0) {
    return index % 2 === 0;
  }
  const activeOptions = options.filter((opt) => !opt.disabled);
  const pool = activeOptions.length > 0 ? activeOptions : options;

  if (index % 2 === 1 && pool.length > 1) {
    return [pool[0]!.value, pool[1]!.value];
  }
  const picked = pool[index % pool.length];
  return picked ? [picked.value] : [];
}

/**
 * 개별 폼 필드 타입(9종)에 맞는 결정론적 샘플 값을 생성합니다.
 */
function buildFieldSampleValue(field: CoreFormField, index: number): unknown {
  switch (field.type) {
    case "text":
      return `${field.label} 예시 ${index + 1}`;

    case "textarea":
      return `${field.label}에 대한 샘플 상세 내용입니다. (${index + 1}번째 예시)`;

    case "number":
      return (index + 1) * 100;

    case "date":
      return SAMPLE_DATES[index % SAMPLE_DATES.length];

    case "switch":
      return index % 2 === 0;

    case "select":
    case "radio":
      return pickSingleOptionSample(field, index);

    case "checkbox":
      return pickCheckboxSample(field, index);

    case "relation":
      return field.relationConfig?.multiple
        ? [`샘플 참조 레코드 ${index + 1}-A`, `샘플 참조 레코드 ${index + 1}-B`]
        : `샘플 참조 레코드 ${index + 1}`;

    default:
      return `${field.label} 예시 ${index + 1}`;
  }
}

/**
 * 빌더 다중 뷰 미리보기(방안 A)에서 실제 제출 데이터가 0건일 때
 * 폼 스키마의 활성 필드 정의를 바탕으로 결정론적 가상 샘플 레코드 목록을 생성합니다.
 *
 * @param form 대상 폼 엔티티
 * @param count 생성할 샘플 레코드 건수 (기본값 3)
 * @returns 테이블/상세 뷰에서 그대로 렌더링 가능한 샘플 FormSubmission 배열
 */
export function buildPreviewSampleSubmissions(form: Form, count = 3): FormSubmission[] {
  const activeFields = extractActiveFields(form);
  if (activeFields.length === 0 || count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const data: Record<string, unknown> = {};
    for (const field of activeFields) {
      data[field.id] = buildFieldSampleValue(field, index);
    }

    const day = Math.max(1, 18 - index);
    const timestamp = new Date(Date.UTC(2026, 10, day, 9, 0, 0));

    return {
      id: `sample-preview-${index + 1}`,
      formId: form.id,
      data,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
  });
}
