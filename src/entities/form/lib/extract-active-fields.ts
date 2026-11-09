import type { Form } from "../schema/form.schema";
import type { ActiveForm, CoreFormField } from "../schema/form-field.schema";

/**
 * 활성 폼(ActiveForm) 또는 데이터베이스 폼 모델(Form)로부터
 * 소프트 삭제되지 않은 활성 필드 목록을 안전하게 추출합니다.
 *
 * - ActiveForm: form.fields (CoreFormField[])
 * - Form (DB Model): form.schemaDefinition.fields (Array<Record<string, unknown>>)
 */
export function extractActiveFields(form?: ActiveForm | Form | null): CoreFormField[] {
  if (!form) return [];

  let rawFields: CoreFormField[] = [];

  if ("fields" in form && Array.isArray(form.fields)) {
    rawFields = form.fields as CoreFormField[];
  } else if (
    "schemaDefinition" in form &&
    form.schemaDefinition !== null &&
    typeof form.schemaDefinition === "object"
  ) {
    const rawSchema = form.schemaDefinition as { fields?: unknown };
    if (Array.isArray(rawSchema.fields)) {
      rawFields = rawSchema.fields as CoreFormField[];
    }
  }

  return rawFields.filter((f) => !f.deletedAt);
}
