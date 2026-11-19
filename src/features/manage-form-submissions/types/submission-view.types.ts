/**
 * 응답 목록 및 상세 화면의 동작 모드 타입
 *
 * - `"consumer"`: 컨슈머 포털 실사용 모드 (URL 동기화, 상세/수정 라우트 이동, 삭제 허용)
 * - `"preview"`: 빌더 다중 뷰 미리보기 모드 (URL 이동/수정/삭제 차단, 인라인 콜백 및 샘플 폴백 지원)
 */
export type FormSubmissionViewMode = "consumer" | "preview";
