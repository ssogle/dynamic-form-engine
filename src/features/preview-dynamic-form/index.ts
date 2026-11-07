/**
 * 실시간 동적 폼 프리뷰어 슬라이스 Public API
 *
 * FSD 단방향 규칙에 따라 상위 레이어(widgets, app)는
 * 내부 파일 경로 대신 이 index.ts를 통해서만 컴포넌트와 타입을 참조합니다.
 */
export { FormPreviewCanvas, type FormPreviewCanvasProps } from "./ui/form-preview-canvas";

export { DynamicField, type DynamicFieldProps } from "./ui/field-registry";

export { FormFieldWrapper, type FormFieldWrapperProps } from "./ui/form-field-wrapper";
