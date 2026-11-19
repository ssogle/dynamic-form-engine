import type { Form } from "../schema/form.schema";
import type { CoreFormField } from "../schema/form-field.schema";
import { extractRawFields } from "./extract-active-fields";

/**
 * 폼 스키마 전이 검증 입력 파라미터
 */
export interface ValidateFormSchemaTransitionParams {
  /** 기존 DB에 저장된 폼 엔티티 스냅샷 (발행 일시 및 기존 스키마 정의) */
  existingForm: Pick<Form, "publishedAt" | "schemaDefinition">;
  /** 새로 저장하려는 스키마 정의 (생략 시 제목·설명 등 메타데이터 변경으로 간주) */
  nextSchemaDefinition?:
    | {
        primaryFieldId?: string | undefined;
        fields: CoreFormField[];
      }
    | undefined;
  /** 해당 폼에 과거 제출 응답(소프트 삭제 이력 포함)이 1건 이상 존재하는지 여부 */
  hasSubmissions: boolean;
}

/**
 * 스키마 전이 검증 Result 반환 타입
 */
export type FormSchemaTransitionResult =
  | {
      data: {
        primaryFieldId?: string | undefined;
        fields: CoreFormField[];
      } | null;
      error: null;
    }
  | {
      data: null;
      error: string;
    };

/**
 * 기존 필드와 변경 후 필드 간의 데이터 호환성(타입, 관계형 참조 대상, 다중 선택 축소, 옵션 물리 삭제)을 검증합니다.
 */
function validateFieldCompatibility(
  oldField: CoreFormField,
  nextField: CoreFormField
): string | null {
  if (nextField.type !== oldField.type) {
    return `응답 데이터가 존재하는 폼의 필드('${oldField.label}') 타입은 변경할 수 없습니다. (${oldField.type} -> ${nextField.type})`;
  }

  if (oldField.type === "relation" && nextField.type === "relation") {
    const oldTargetId = oldField.relationConfig?.targetFormId;
    const nextTargetId = nextField.relationConfig?.targetFormId;
    if (oldTargetId && nextTargetId && oldTargetId !== nextTargetId) {
      return `응답 데이터가 존재하는 폼의 관계형 필드('${oldField.label}') 참조 대상은 변경할 수 없습니다.`;
    }

    const wasMultiple = Boolean(oldField.relationConfig?.multiple);
    const isMultiple = Boolean(nextField.relationConfig?.multiple);
    if (wasMultiple && !isMultiple) {
      return `응답 데이터가 존재하는 폼의 관계형 필드('${oldField.label}')는 다중 선택에서 단일 선택으로 축소할 수 없습니다.`;
    }
  }

  if (oldField.type === "select" && nextField.type === "select") {
    const wasMultiple = Boolean(oldField.multiple);
    const isMultiple = Boolean(nextField.multiple);
    if (wasMultiple && !isMultiple) {
      return `응답 데이터가 존재하는 폼의 선택형 필드('${oldField.label}')는 다중 선택에서 단일 선택으로 축소할 수 없습니다.`;
    }
  }

  if (oldField.options && oldField.options.length > 0) {
    const nextOptionValueSet = new Set((nextField.options ?? []).map((opt) => opt.value));
    for (const oldOpt of oldField.options) {
      if (!nextOptionValueSet.has(oldOpt.value)) {
        return `응답 데이터가 존재하는 폼의 선택지('${oldOpt.label}')는 물리 삭제할 수 없습니다. 비활성화(disabled: true)를 사용해 주세요.`;
      }
    }
  }

  return null;
}

/**
 * 폼 발행 상태 및 과거 제출 응답 유무에 따라 스키마 변경 허용 여부를 검증합니다.
 *
 * [2단계 보호 정책]
 * 1. 발행 상태(`publishedAt !== null`): 라이브 응답 수집 중인 스키마 보호를 위해 스키마 변경을 차단합니다.
 *    (제목/설명 등 메타데이터만 변경하거나, 먼저 초안으로 회수한 뒤 수정해야 합니다.)
 * 2. 초안 상태 + 응답 1건 이상(`hasSubmissions === true`):
 *    - 필드/옵션 물리 삭제 금지 (소프트 삭제 `deletedAt` / 비활성화 `disabled: true`만 허용)
 *    - 기존 필드 `type` 변경 금지
 *    - `relation.targetFormId` 변경 및 `relation.multiple: true -> false` 축소 금지
 *    - `select.multiple: true -> false` 축소 금지
 * 3. 초안 상태 + 응답 0건: 모든 스키마 변경 자유 허용
 */
export function validateFormSchemaTransition({
  existingForm,
  nextSchemaDefinition,
  hasSubmissions,
}: ValidateFormSchemaTransitionParams): FormSchemaTransitionResult {
  if (!nextSchemaDefinition) {
    return { data: null, error: null };
  }

  if (existingForm.publishedAt !== null && existingForm.publishedAt !== undefined) {
    return {
      data: null,
      error:
        "현재 발행 중인 폼의 스키마는 직접 수정할 수 없습니다. 먼저 초안으로 회수한 뒤 수정해 주세요.",
    };
  }

  if (!hasSubmissions) {
    return { data: nextSchemaDefinition, error: null };
  }

  const existingFields = extractRawFields(existingForm as unknown as Form);
  const nextFieldMap = new Map(nextSchemaDefinition.fields.map((field) => [field.id, field]));

  for (const oldField of existingFields) {
    const nextField = nextFieldMap.get(oldField.id);
    if (!nextField) {
      return {
        data: null,
        error: `응답 데이터가 존재하는 폼의 기존 필드('${oldField.label}')는 물리 삭제할 수 없습니다. 소프트 삭제(deletedAt)를 사용해 주세요.`,
      };
    }

    const compatError = validateFieldCompatibility(oldField, nextField);
    if (compatError !== null) {
      return { data: null, error: compatError };
    }
  }

  return { data: nextSchemaDefinition, error: null };
}
