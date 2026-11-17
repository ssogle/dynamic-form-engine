import { z } from "zod";
import { calendarDateStringSchema, refineDateRangeOrder } from "./date-range.schema";

/**
 * 통계 집계 메트릭 유형
 */
export const analyticsMetricSchema = z.enum(["count", "sum", "avg", "min", "max"]);

/**
 * 시계열 버킷 단위 (일/주/월/분기)
 */
export const analyticsTimeBucketSchema = z.enum(["day", "week", "month", "quarter"]);

/**
 * 날짜 기준 축 유형 ("field": 폼 내 date 타입 필드 / "createdAt": 시스템 제출일 폴백)
 */
export const analyticsDateAxisSchema = z.enum(["field", "createdAt"]);

/**
 * 특정 필드 값 일치 조건 필터 (relation 대상 레코드 ID/표시명, select/radio 옵션 값, 텍스트 등)
 */
export const analyticsFieldFilterSchema = z.object({
  fieldId: z.string().min(1, "필터 대상 필드 ID는 필수입니다."),
  value: z
    .string()
    .min(
      1,
      "필터 비교 값(relation 대상 레코드 UUID 또는 표시명, select 옵션 value/라벨 등)은 필수입니다."
    ),
});

/**
 * 서버 통계 집계 요청 파라미터 검증 스키마
 */
export const analyticsAggregationQuerySchema = z
  .object({
    formId: z.uuid("유효한 폼 ID(UUID)가 필요합니다."),
    metric: analyticsMetricSchema.default("count"),
    targetFieldId: z.string().min(1).optional(),
    groupByFieldId: z.string().min(1).optional(),
    timeBucket: analyticsTimeBucketSchema.optional(),
    dateFieldId: z.string().min(1).optional(),
    startDate: calendarDateStringSchema.optional(),
    endDate: calendarDateStringSchema.optional(),
    timezone: z.string().min(1).default("Asia/Seoul"),
    filters: z.array(analyticsFieldFilterSchema).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .superRefine((val, ctx) => {
    if (val.metric !== "count" && !val.targetFieldId) {
      ctx.addIssue({
        code: "custom",
        path: ["targetFieldId"],
        message: `${val.metric} 집계 시 대상 숫자 필드 ID(targetFieldId)는 필수입니다.`,
      });
    }
    refineDateRangeOrder(val, ctx);
  });

/**
 * 시리즈 산술 연산 입력 포인트 규격
 */
export const seriesMetricPointSchema = z.object({
  key: z.string().min(1, "시리즈 키는 필수입니다."),
  value: z.number(),
});

/**
 * 결정론적 시리즈 산술 연산 도구(computeSeriesMetric) 입력 스키마
 */
export const computeSeriesMetricInputSchema = z.object({
  operation: z
    .enum(["subtract", "add", "ratio"])
    .describe(
      "수행할 연산: 'subtract'(base - target 차액/손익), 'add'(base + target 합산), 'ratio'((base / target) * 100 백분율)"
    ),
  baseSeries: z
    .array(seriesMetricPointSchema)
    .describe("좌항 또는 분자 시리즈 (예: subtract 시 매출, ratio 시 실적 또는 순이익)"),
  targetSeries: z
    .array(seriesMetricPointSchema)
    .describe("우항 또는 분모 시리즈 (예: subtract 시 비용, ratio 시 계획 또는 매출)"),
  includeKeys: z
    .array(z.string().min(1))
    .optional()
    .describe(
      "집계 데이터가 0건이라 baseSeries/targetSeries에서 누락되었더라도 결과에 0으로 반드시 포함할 기준 축 키 목록 (예: relation 마스터 폼의 전체 프로젝트명)"
    ),
  resultKey: z
    .string()
    .min(1, "결과 필드 키 이름은 필수입니다.")
    .describe("결과 필드 키 이름 (예: 'net_profit', 'execution_rate')"),
});

/**
 * 분석용 레코드 샘플링/조건 조회 요청 스키마
 */
export const querySubmissionsForAnalysisSchema = z
  .object({
    formId: z.uuid("유효한 폼 ID(UUID)가 필요합니다."),
    dateFieldId: z.string().min(1).optional(),
    startDate: calendarDateStringSchema.optional(),
    endDate: calendarDateStringSchema.optional(),
    timezone: z.string().min(1).default("Asia/Seoul"),
    filters: z.array(analyticsFieldFilterSchema).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .superRefine(refineDateRangeOrder);

export type AnalyticsMetric = z.infer<typeof analyticsMetricSchema>;
export type AnalyticsTimeBucket = z.infer<typeof analyticsTimeBucketSchema>;
export type AnalyticsDateAxis = z.infer<typeof analyticsDateAxisSchema>;
export type AnalyticsFieldFilter = z.infer<typeof analyticsFieldFilterSchema>;
export type AnalyticsAggregationQuery = z.infer<typeof analyticsAggregationQuerySchema>;
export type SeriesMetricPoint = z.infer<typeof seriesMetricPointSchema>;
export type ComputeSeriesMetricInput = z.infer<typeof computeSeriesMetricInputSchema>;
export type QuerySubmissionsForAnalysisInput = z.infer<typeof querySubmissionsForAnalysisSchema>;
