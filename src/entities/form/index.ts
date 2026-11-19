/**
 * Form 엔티티 Public API 진입점
 *
 * FSD 아키텍처 원칙에 따라 상위 레이어(features, widgets, app)는
 * 내부 세부 파일 경로 대신 이 index.ts를 통해서만 폼 스키마와 타입을 참조합니다.
 */
export {
  forms,
  formIdParamSchema,
  formsListQuerySchema,
  formSchemaDefinitionSchema,
  insertFormSchema,
  publishFormBodySchema,
  selectFormSchema,
  updateFormSchema,
  type Form,
  type FormIdParam,
  type FormsListQuery,
  type InsertForm,
  type PublishFormBody,
  type UpdateForm,
} from "./schema/form.schema";

export {
  coreFieldTypeSchema,
  coreFormFieldSchema,
  activeFormSchema,
  selectOptionSchema,
  relationConfigSchema,
  type CoreFieldType,
  type CoreFormField,
  type ActiveForm,
  type SelectOption,
  type RelationConfig,
} from "./schema/form-field.schema";

export {
  extractActiveFields,
  extractRawFields,
  readFormSchemaParts,
  type FormSchemaParts,
} from "./lib/extract-active-fields";
export { mergeOptionsWithPreservation } from "./lib/merge-options-with-preservation";
export {
  validateFormSchemaTransition,
  type FormSchemaTransitionResult,
  type ValidateFormSchemaTransitionParams,
} from "./lib/validate-form-schema-transition";
export { normalizeSelectOption, normalizeSelectOptions } from "./lib/select-options";
export { formatFieldDisplayValue } from "./lib/format-field-value";
export {
  buildFormRelationGraph,
  type FormRelationGraphData,
  type FormRelationGraphLink,
  type FormRelationGraphNode,
} from "./lib/build-form-relation-graph";
export {
  PRIMARY_FIELD_DISALLOWED_TYPES,
  validatePrimaryFieldSelection,
  extractPrimaryFieldId,
  extractPrimaryFieldValue,
  orderFieldsWithPrimaryFirst,
  type PrimaryFieldValidationResult,
} from "./lib/primary-field";
export { PrimaryFieldBadge, type PrimaryFieldBadgeProps } from "./ui/primary-field-badge";

export { buildDynamicFormSchema, validateSubmissionData } from "./schema/dynamic-form.schema";
export type { SubmissionValidationResult } from "./types/dynamic-form.types";

export { formKeys } from "./queries/form.keys";
export { getForms, useFormsQuery } from "./queries/use-forms.query";
export { getPublishedForms, usePublishedFormsQuery } from "./queries/use-published-forms.query";
export { getFormDetail, useFormDetailQuery } from "./queries/use-form-detail.query";
export {
  createForm,
  updateForm,
  publishForm,
  deleteForm,
  useCreateFormMutation,
  useUpdateFormMutation,
  usePublishFormMutation,
  useDeleteFormMutation,
} from "./queries/use-form.mutation";
