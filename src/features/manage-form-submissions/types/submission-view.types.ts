/**
 * 응답 목록 및 상세 화면의 동작 모드 타입
 *
 * - `"consumer"`: 컨슈머 포털 실사용 모드 (URL 동기화, 상세/수정 라우트 이동, 삭제 허용)
 * - `"preview"`: 빌더 다중 뷰 미리보기 모드 (URL 이동/수정/삭제 차단, 인라인 콜백 및 샘플 폴백 지원)
 */
export type FormSubmissionViewMode = "consumer" | "preview";

/**
 * 공통 응답 목록 테이블(ManageFormSubmissions)을 관계형 레코드 선택 피커로 사용할 때의 선택 상태 제어 계약
 */
export interface SubmissionSelectionMode {
  /** 다중 선택 허용 여부 (false: 라디오형 단일 선택, true: 체크박스형 복수 선택) */
  readonly multiple: boolean;
  /** 현재 선택된 응답 레코드 UUID 목록 */
  readonly selectedIds: readonly string[];
  /** 행 클릭 또는 선택 체크박스 조작 시 호출되는 토글 콜백 */
  readonly onToggleSelect: (submissionId: string) => void;
}
