/**
 * 분석 뷰 엔티티 클라이언트 공용 Public API
 *
 * 브라우저 안전 Zod 스키마, 블록 추출 헬퍼, 정적 타입 및 TanStack Query 훅을 노출합니다.
 */
export {
  analysisBlockSchema,
  analysisViews,
  chartAnalysisBlockSchema,
  chartSeriesSchema,
  extractAnalysisBlocks,
  insertAnalysisViewSchema,
  selectAnalysisViewSchema,
  tableAnalysisBlockSchema,
  tableColumnSchema,
  textAnalysisBlockSchema,
  updateAnalysisViewSchema,
  type AnalysisBlock,
  type AnalysisView,
  type ChartAnalysisBlock,
  type ChartSeries,
  type InsertAnalysisView,
  type TableAnalysisBlock,
  type TableColumn,
  type TextAnalysisBlock,
  type UpdateAnalysisView,
} from "./schema/analysis-view.schema";

export { analysisViewKeys } from "./queries/analysis-view.keys";
export { getAnalysisViews, useAnalysisViewsQuery } from "./queries/use-analysis-views.query";
export {
  getPublishedAnalysisViews,
  usePublishedAnalysisViewsQuery,
} from "./queries/use-published-analysis-views.query";
export {
  getAnalysisViewDetail,
  useAnalysisViewDetailQuery,
} from "./queries/use-analysis-view-detail.query";
export {
  deleteAnalysisView,
  publishAnalysisView,
  useDeleteAnalysisViewMutation,
  usePublishAnalysisViewMutation,
} from "./queries/use-analysis-view.mutation";
