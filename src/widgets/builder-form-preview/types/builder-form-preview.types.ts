/**
 * 빌더 데이터 미리보기 모달 뷰 종류 식별자 타입
 *
 * - `"list"`: 데이터 레코드 목록 테이블 (`ManageFormSubmissions`)
 * - `"detail"`: 단건 데이터 상세 응답 내용 (`SubmissionDetailView`)
 */
export type BuilderDataPreviewView = "list" | "detail";

/**
 * 빌더 데이터 화면 미리보기 모달 위젯 Props 인터페이스
 */
export interface BuilderDataPreviewDialogProps {
  /** 미리보기 대상 폼 고유 식별자 (UUID) */
  readonly formId: string;
}
