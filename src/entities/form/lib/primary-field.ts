import type { Form } from "../schema/form.schema";
import type { ActiveForm, CoreFormField } from "../schema/form-field.schema";

/**
 * 대표 식별 필드(primaryFieldId)로 지정할 수 없는 복합/참조 계열 필드 타입 목록
 * 다중 선택 배열(checkbox)이나 타 레코드 UUID 참조(relation)는 단일 대표 라벨로 부적합하므로 제외합니다.
 */
export const PRIMARY_FIELD_DISALLOWED_TYPES = new Set<string>(["checkbox", "relation"]);

/**
 * 대표 필드 지정 유효성 검사 결과 인터페이스
 */
export interface PrimaryFieldValidationResult {
  isValid: boolean;
  reason?: string | undefined;
}

/**
 * 폼 객체에서 raw 필드 배열과 선언된 primaryFieldId 문자열을 안전하게 추출하는 내부 헬퍼입니다.
 */
function readSchemaParts(form?: ActiveForm | Form | null): {
  rawFields: CoreFormField[];
  rawPrimaryFieldId?: string | undefined;
} {
  if (!form) {
    return { rawFields: [], rawPrimaryFieldId: undefined };
  }

  if ("fields" in form && Array.isArray(form.fields)) {
    const activeForm = form as ActiveForm & { primaryFieldId?: unknown };
    return {
      rawFields: activeForm.fields,
      rawPrimaryFieldId:
        typeof activeForm.primaryFieldId === "string" ? activeForm.primaryFieldId : undefined,
    };
  }

  if (
    "schemaDefinition" in form &&
    form.schemaDefinition !== null &&
    typeof form.schemaDefinition === "object"
  ) {
    const schema = form.schemaDefinition as { fields?: unknown; primaryFieldId?: unknown };
    return {
      rawFields: Array.isArray(schema.fields) ? (schema.fields as CoreFormField[]) : [],
      rawPrimaryFieldId:
        typeof schema.primaryFieldId === "string" ? schema.primaryFieldId : undefined,
    };
  }

  return { rawFields: [], rawPrimaryFieldId: undefined };
}

/**
 * 폼의 필드 배열 내에서 주어진 primaryFieldId가 대표 식별 필드로 유효한지 검증합니다.
 *
 * 검증 규칙:
 * 1. 비어있거나 공백 문자열이 아니어야 합니다.
 * 2. 소프트 삭제되지 않은(!deletedAt) 활성 필드 중 실제로 존재해야 합니다.
 * 3. checkbox(배열), relation(UUID 참조) 타입이 아니어야 합니다.
 *
 * @param fields 폼 필드 정의 배열
 * @param primaryFieldId 검증할 대표 필드 ID
 * @returns 검증 통과 여부 및 실패 사유
 */
export function validatePrimaryFieldSelection(
  fields: CoreFormField[],
  primaryFieldId?: string | null
): PrimaryFieldValidationResult {
  const trimmedId = typeof primaryFieldId === "string" ? primaryFieldId.trim() : "";
  if (!trimmedId) {
    return {
      isValid: false,
      reason: "데이터 도메인 폼을 대표할 필드(primaryFieldId)를 반드시 지정해야 합니다.",
    };
  }

  const targetField = fields.find((f) => f.id === trimmedId && !f.deletedAt);
  if (!targetField) {
    return {
      isValid: false,
      reason: `지정한 대표 필드('${trimmedId}')가 활성 필드 목록에 존재하지 않습니다.`,
    };
  }

  if (PRIMARY_FIELD_DISALLOWED_TYPES.has(targetField.type)) {
    return {
      isValid: false,
      reason: `'${targetField.type}' 타입 필드('${targetField.label}')는 대표 필드로 지정할 수 없습니다. 단일 값을 표현하는 필드를 선택해 주세요.`,
    };
  }

  return { isValid: true };
}

/**
 * 폼 메타데이터로부터 유효한 활성 대표 필드 ID(primaryFieldId)를 추출합니다.
 * 누락되었거나 소프트 삭제된 필드를 가리키는 경우 undefined를 반환합니다.
 *
 * @param form ActiveForm 또는 Form DB 모델
 * @returns 유효한 대표 필드 ID 또는 undefined
 */
export function extractPrimaryFieldId(form?: ActiveForm | Form | null): string | undefined {
  const { rawFields, rawPrimaryFieldId } = readSchemaParts(form);
  if (!rawPrimaryFieldId) return undefined;

  const validation = validatePrimaryFieldSelection(rawFields, rawPrimaryFieldId);
  return validation.isValid ? rawPrimaryFieldId.trim() : undefined;
}

/**
 * 특정 폼의 대표 필드 정의에 기반하여 단일 제출 응답(submission)의 한 줄 요약 라벨을 추출합니다.
 *
 * - select / radio 타입은 저장된 코드값을 옵션 한글 라벨(비활성 옵션 포함)로 매핑합니다.
 * - switch 불리언 값은 "예" / "아니오"로 변환합니다.
 * - 값이 비어있거나 대표 필드가 없으면 `레코드 (UUID 앞 8자)` 폴백을 반환합니다.
 *
 * @param form 타깃 도메인 폼 모델
 * @param submission 대상 응답 객체 (id, data 포함)
 * @returns 화면 셀 또는 요약 목록에 표시할 대표 문자열
 */
export function extractPrimaryFieldValue(
  form: ActiveForm | Form | null | undefined,
  submission: { id: string; data?: Record<string, unknown> | unknown }
): string {
  const fallback = `레코드 (${submission.id.slice(0, 8)})`;
  const primaryId = extractPrimaryFieldId(form);
  if (!primaryId) return fallback;

  const { rawFields } = readSchemaParts(form);
  const primaryField = rawFields.find((f) => f.id === primaryId && !f.deletedAt);
  if (!primaryField) return fallback;

  const rowData =
    submission.data && typeof submission.data === "object"
      ? (submission.data as Record<string, unknown>)
      : {};
  const rawValue = rowData[primaryId];

  if (rawValue === undefined || rawValue === null) {
    return fallback;
  }

  if (primaryField.type === "switch") {
    if (typeof rawValue === "boolean") {
      return rawValue ? "예" : "아니오";
    }
    if (rawValue === "true") return "예";
    if (rawValue === "false") return "아니오";
  }

  if (primaryField.type === "select" || primaryField.type === "radio") {
    const strVal = String(rawValue);
    if (strVal.trim() === "") return fallback;
    const matchedOpt = (primaryField.options ?? []).find((opt) => opt.value === strVal);
    return matchedOpt ? matchedOpt.label : strVal;
  }

  const trimmed = String(rawValue).trim();
  return trimmed !== "" ? trimmed : fallback;
}
