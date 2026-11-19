/**
 * Builder Form Preview Widget Public API
 *
 * 빌더 작업 공간에서 데이터 목록 및 단건 상세 화면을 모달로 미리보기하는 위젯 진입점입니다.
 */
export { BuilderDataPreviewDialog } from "./ui/builder-data-preview-dialog";
export {
  useBuilderFormPreview,
  type UseBuilderFormPreviewParams,
  type UseBuilderFormPreviewReturn,
} from "./hooks/use-builder-form-preview.hook";
export type {
  BuilderDataPreviewView,
  BuilderDataPreviewDialogProps,
} from "./types/builder-form-preview.types";
