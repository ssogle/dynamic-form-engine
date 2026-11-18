/**
 * Shared Schema Public API 진입점
 *
 * 2개 이상의 엔티티 또는 피처가 공통으로 참조하는 범용 원자 Zod 스키마,
 * 필드 조회 능력(Capability) 레지스트리, 통합 필터 조건 스키마 및 파생 타입을 노출합니다.
 */
export {
  calendarDateStringSchema,
  isValidCalendarDate,
  isValidTimezone,
  refineDateRangeOrder,
  submissionDateRangeFilterSchema,
  type SubmissionDateRangeFilter,
} from "./date.schema";

export {
  analyticsMetricTypeSchema,
  CHECKBOX_BOOLEAN_CAPABILITY,
  CORE_FIELD_CAPABILITIES,
  coreFieldTypeSchema,
  FIELD_FILTER_OPERATOR_LABELS,
  fieldFilterOperatorSchema,
  fieldFilterWidgetSchema,
  isSystemFieldId,
  resolveFieldQueryCapability,
  resolveSystemFieldCapability,
  resolveTargetFieldCapability,
  SYSTEM_FIELD_CAPABILITIES,
  SYSTEM_FIELD_LABELS,
  systemFieldIdSchema,
  type AnalyticsMetricType,
  type CoreFieldType,
  type FieldCapabilityTarget,
  type FieldFilterOperator,
  type FieldFilterWidget,
  type FieldQueryCapability,
  type SystemFieldId,
} from "./field-capability.schema";

export {
  fieldFilterConditionSchema,
  normalizeFieldFilterCondition,
  parseFieldFiltersParam,
  parseFieldFiltersStrict,
  serializeFieldFiltersParam,
  validateFiltersAgainstFields,
  type FieldFilterCondition,
  type FilterableFieldDescriptor,
  type NormalizedFieldFilterCondition,
} from "./field-filter.schema";
