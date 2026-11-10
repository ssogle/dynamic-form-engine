/**
 * Manage Form Submissions Feature Public API
 *
 * 폼 응답 목록 조회, 테이블 시각화, 단건 상세 조회 및 응답 삭제 인터랙션을 담당하는 기능 슬라이스의 진입점입니다.
 */
export {
  ManageFormSubmissions,
  type ManageFormSubmissionsProps,
} from "./ui/manage-form-submissions";
export {
  SubmissionListTable,
  type SubmissionListTableProps,
  SYSTEM_COLUMN_LABELS,
} from "./ui/submission-list-table";
export { SubmissionDetailView, type SubmissionDetailViewProps } from "./ui/submission-detail-view";
