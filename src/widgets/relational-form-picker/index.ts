/**
 * Relational Form Picker Widget Public API
 *
 * 동적 폼 제출/수정 피처(`features/render-dynamic-form`)의 관계형 필드 선택 슬롯에
 * 공통 응답 테이블 피처(`features/manage-form-submissions`)를 조립해 제공하는 FSD 위젯 진입점입니다.
 */

export {
  RelationalDynamicFormRenderer,
  type RelationalDynamicFormRendererProps,
  RelationalFormSubmitter,
  type RelationalFormSubmitterProps,
  RelationalSubmissionEditor,
  type RelationalSubmissionEditorProps,
} from "./ui/relational-form-picker";
