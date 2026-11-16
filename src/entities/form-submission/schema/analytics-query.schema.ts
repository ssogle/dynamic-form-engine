import { z } from "zod";

/**
 * 통계 집계 메트릭 유형
 */
export const analyticsMetricSchema = z.enum(["count", "sum", "avg", "min", "max"]);

/**
 * 시계열 버킷 단위 (일/주/월/분기)
 */
export const analyticsTimeBucketSchema = z.enum(["day", "week", "month", "quarter"]);

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
    timezone: z.string().min(1).default("Asia/Seoul"),
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
  resultKey: z
    .string()
    .min(1, "결과 필드 키 이름은 필수입니다.")
    .describe("결과 필드 키 이름 (예: 'net_profit', 'execution_rate')"),
});

/**
 * 분석용 레코드 샘플링/조건 조회 요청 스키마
 */
export const querySubmissionsForAnalysisSchema = z.object({
  formId: z.uuid("유효한 폼 ID(UUID)가 필요합니다."),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(50).default(20),
});

export type AnalyticsMetric = z.infer<typeof analyticsMetricSchema>;
export type AnalyticsTimeBucket = z.infer<typeof analyticsTimeBucketSchema>;
export type AnalyticsAggregationQuery = z.infer<typeof analyticsAggregationQuerySchema>;
export type SeriesMetricPoint = z.infer<typeof seriesMetricPointSchema>;
export type ComputeSeriesMetricInput = z.infer<typeof computeSeriesMetricInputSchema>;
export type QuerySubmissionsForAnalysisInput = z.infer<typeof querySubmissionsForAnalysisSchema>;
