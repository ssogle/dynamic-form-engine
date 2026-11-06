/**
 * Form 엔티티 Public API 진입점
 *
 * FSD 아키텍처 원칙에 따라 상위 레이어(features, widgets, app)는
 * 내부 세부 파일 경로 대신 이 index.ts를 통해서만 폼 스키마와 타입을 참조합니다.
 */
export {
  forms,
  insertFormSchema,
  selectFormSchema,
  updateFormSchema,
  type Form,
  type InsertForm,
  type UpdateForm,
} from "./schema/form.schema";

export {
  coreFieldTypeSchema,
  coreFormFieldSchema,
  activeFormSchema,
  type CoreFieldType,
  type CoreFormField,
  type ActiveForm,
} from "./types/form-field.types";

export { formKeys } from "./queries/form.keys";
export { getForms, useFormsQuery } from "./queries/use-forms.query";
export { getFormDetail, useFormDetailQuery } from "./queries/use-form-detail.query";
export {
  createForm,
  updateForm,
  deleteForm,
  useCreateFormMutation,
  useUpdateFormMutation,
  useDeleteFormMutation,
} from "./queries/use-form.mutation";
