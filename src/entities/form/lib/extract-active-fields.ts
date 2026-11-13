import type { Form } from "../schema/form.schema";
import type { ActiveForm, CoreFormField } from "../schema/form-field.schema";

/**
 * 폼 객체에서 파싱된 원시 스키마 구성 요소 인터페이스
 */
export interface FormSchemaParts {
  rawFields: CoreFormField[];
  rawPrimaryFieldId?: string | undefined;
}

/**
 * 활성 폼(ActiveForm) 또는 데이터베이스 폼 모델(Form)로부터
 * 원시 필드 배열(소프트 삭제 포함)과 선언된 대표 필드 ID(primaryFieldId)를 안전하게 추출합니다.
 *
 * - ActiveForm: `form.fields`, `form.primaryFieldId`
 * - Form (DB Model): `form.schemaDefinition.fields`, `form.schemaDefinition.primaryFieldId`
 *
 * @param form ActiveForm 또는 Form DB 모델
 * @returns 추출된 rawFields 배열과 rawPrimaryFieldId
 */
export function readFormSchemaParts(form?: ActiveForm | Form | null): FormSchemaParts {
  if (!form) {
    return { rawFields: [], rawPrimaryFieldId: undefined };
  }

  if ("fields" in form && Array.isArray(form.fields)) {
    const activeForm = form as ActiveForm & { primaryFieldId?: unknown };
    return {
      rawFields: activeForm.fields as CoreFormField[],
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
 * 폼 객체에서 소프트 삭제 여부를 구분하지 않고 전체 원시 필드 정의 배열을 추출합니다.
 * 빌더 도구 등에서 기존/삭제 필드를 보존한 채 스키마를 갱신할 때 사용합니다.
 *
 * @param form ActiveForm 또는 Form DB 모델
 * @returns CoreFormField[] 전체 배열
 */
export function extractRawFields(form?: ActiveForm | Form | null): CoreFormField[] {
  return readFormSchemaParts(form).rawFields;
}

/**
 * 활성 폼(ActiveForm) 또는 데이터베이스 폼 모델(Form)로부터
 * 소프트 삭제되지 않은(!deletedAt) 활성 필드 목록만 안전하게 추출합니다.
 *
 * @param form ActiveForm 또는 Form DB 모델
 * @returns 활성 CoreFormField[] 배열
 */
export function extractActiveFields(form?: ActiveForm | Form | null): CoreFormField[] {
  return readFormSchemaParts(form).rawFields.filter((f) => !f.deletedAt);
}
