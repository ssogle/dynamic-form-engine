/**
 * features/render-dynamic-form
 *
 * 동적 폼 렌더링 코어, 폼 입력 및 실시간 제출(ConsumerFormSubmitter),
 * 기제출 응답 수정 워크스페이스(ConsumerSubmissionEditor)를 제공하는 기능 슬라이스 진입점입니다.
 */

export { DynamicFormRenderer } from "./ui/dynamic-form-renderer";
export { DynamicField } from "./ui/dynamic-field";
export { FormFieldWrapper } from "./ui/form-field-wrapper";
export {
  ConsumerFormSubmitter,
  type ConsumerFormSubmitterProps,
} from "./ui/consumer-form-submitter";
export {
  ConsumerSubmissionEditor,
  type ConsumerSubmissionEditorProps,
} from "./ui/consumer-submission-editor";

export type {
  DynamicFormMode,
  DynamicFormRendererProps,
  DynamicFieldProps,
} from "./types/render-dynamic-form.types";
