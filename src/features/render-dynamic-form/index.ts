/**
 * features/render-dynamic-form
 *
 * 동적 폼 렌더링 코어, 폼 입력 및 실시간 제출(ConsumerFormSubmitter),
 * 기제출 응답 수정 워크스페이스(ConsumerSubmissionEditor)를 제공하는 기능 슬라이스 진입점입니다.
 */

export { DynamicFormRenderer } from "./ui/dynamic-form-renderer";
export { DynamicField } from "./ui/dynamic-field";
export { FormFieldWrapper } from "./ui/form-field-wrapper";
export { RelationFieldInput, type RelationFieldInputProps } from "./ui/relation-field-input";
export {
  ConsumerFormSubmitter,
  type ConsumerFormSubmitterProps,
} from "./ui/consumer-form-submitter";
export {
  ConsumerSubmissionEditor,
  type ConsumerSubmissionEditorProps,
} from "./ui/consumer-submission-editor";

// 커스텀 훅 및 인터페이스 Public API
export {
  useDynamicForm,
  type UseDynamicFormOptions,
  type UseDynamicFormReturn,
} from "./hooks/use-dynamic-form.hook";
export {
  useConsumerFormSubmitter,
  type UseConsumerFormSubmitterParams,
  type UseConsumerFormSubmitterReturn,
} from "./hooks/use-consumer-form-submitter.hook";
export {
  useConsumerSubmissionEditor,
  type UseConsumerSubmissionEditorParams,
  type UseConsumerSubmissionEditorReturn,
} from "./hooks/use-consumer-submission-editor.hook";

export type {
  DynamicFormMode,
  DynamicFormRendererProps,
  DynamicFieldProps,
} from "./types/render-dynamic-form.types";
