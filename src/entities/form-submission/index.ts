/**
 * Form Submission 엔티티 클라이언트 및 공용 Public API
 *
 * FSD 단방향 참조 원칙에 따라 외부 레이어는 본 index.ts를 통해서만
 * 제출 스키마, 타입, TanStack Query 훅, 임시 입력값 스토어를 참조합니다.
 */
export {
  formSubmissions,
  insertFormSubmissionSchema,
  updateFormSubmissionSchema,
  selectFormSubmissionSchema,
  type FormSubmission,
  type InsertFormSubmission,
  type UpdateFormSubmission,
} from "./schema/form-submission.schema";

export {
  submissionQuerySchema,
  relationsQuerySchema,
  parseSortParam,
  parseFiltersParam,
  parseIdsParam,
  type SubmissionQueryParams,
  type RelationsQueryParams,
  type SortItem,
  type PaginatedSubmissionsResponse,
} from "./schema/submission-query.schema";

export type { RelatedSubmissionsGroup } from "./types/relation.types";

export { formSubmissionsKeys } from "./queries/form-submissions.keys";

export {
  getFormSubmissions,
  getFormSubmissionsByIds,
  getPaginatedFormSubmissions,
  getFormSubmissionDetail,
  useFormSubmissionsQuery,
  useFormSubmissionsByIdsQuery,
  useInfiniteFormSubmissionsQuery,
  useFormSubmissionDetailQuery,
  type UseInfiniteFormSubmissionsQueryOptions,
} from "./queries/use-form-submissions.query";

export {
  getRelatedSubmissions,
  useRelatedSubmissionsQuery,
} from "./queries/use-related-submissions.query";

export {
  submitFormResponse,
  updateFormSubmission,
  deleteFormSubmission,
  useSubmitFormMutation,
  useUpdateSubmissionMutation,
  useDeleteSubmissionMutation,
} from "./queries/use-form-submissions.mutation";

export { extractSubmissionPayload } from "./lib/extract-submission-payload";

export {
  useConsumerFormDraftStore,
  type ConsumerFormDraftState,
} from "./store/consumer-form-draft.store";

export {
  analyticsMetricSchema,
  analyticsTimeBucketSchema,
  analyticsDateAxisSchema,
  analyticsFieldFilterSchema,
  analyticsAggregationQuerySchema,
  seriesMetricPointSchema,
  computeSeriesMetricInputSchema,
  querySubmissionsForAnalysisSchema,
  type AnalyticsMetric,
  type AnalyticsTimeBucket,
  type AnalyticsDateAxis,
  type AnalyticsFieldFilter,
  type AnalyticsAggregationQuery,
  type SeriesMetricPoint,
  type ComputeSeriesMetricInput,
  type QuerySubmissionsForAnalysisInput,
} from "./schema/analytics-query.schema";

export {
  isValidCalendarDate,
  isValidTimezone,
  calendarDateStringSchema,
  type SubmissionDateRangeFilter,
} from "./schema/date-range.schema";

export {
  roundFloatingPoint,
  parseNumericValue,
  resolveFieldOptionLabelMap,
  formatFieldDisplayKey,
  formatTimeBucketKey,
  buildContinuousTimeBucketKeys,
  mergeSeriesWithZeroFill,
  computeSeriesMetric,
  type AnalyticsFieldMeta,
  type ComputedSeriesMetricRow,
  type ComputeSeriesMetricResult,
} from "./lib/analytics-calculator";
