/**
 * Manage Form Submissions Feature Public API
 *
 * 폼 응답 목록 조회, 테이블 시각화, 단건 상세 조회 및 응답 삭제 인터랙션을 담당하는 기능 슬라이스의 진입점입니다.
 */

export {
  ManageFormSubmissions,
  type ManageFormSubmissionsProps,
} from "./ui/manage-form-submissions";
export { SubmissionListTable, type SubmissionListTableProps } from "./ui/submission-list-table";
export { ColumnHeaderFilter, type ColumnHeaderFilterProps } from "./ui/column-header-filter";
export { SubmissionActionCell, type SubmissionActionCellProps } from "./ui/submission-action-cell";
export { SubmissionDetailView, type SubmissionDetailViewProps } from "./ui/submission-detail-view";
export {
  RelatedSubmissionSubtable,
  type RelatedSubmissionSubtableProps,
} from "./ui/related-submission-subtable";

// 커스텀 훅 및 시스템 상수 Public API
export {
  SYSTEM_COLUMN_LABELS,
  getColumnLabel,
  useSubmissionListTable,
  type UseSubmissionListTableParams,
  type UseSubmissionListTableReturn,
} from "./hooks/use-submission-list-table.hook";
export {
  useSubmissionDetailView,
  type UseSubmissionDetailViewParams,
  type UseSubmissionDetailViewReturn,
} from "./hooks/use-submission-detail-view.hook";
