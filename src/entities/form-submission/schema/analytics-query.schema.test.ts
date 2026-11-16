import { describe, expect, it } from "vitest";
import {
  analyticsAggregationQuerySchema,
  computeSeriesMetricInputSchema,
} from "./analytics-query.schema";

describe("Analytics Query & Series Metric Schemas", () => {
  const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  describe("analyticsAggregationQuerySchema", () => {
    it("기본 count 집계 및 day/week/month/quarter 버킷을 모두 허용해야 한다", () => {
      for (const timeBucket of ["day", "week", "month", "quarter"] as const) {
        const result = analyticsAggregationQuerySchema.safeParse({
          formId: validUuid,
          metric: "count",
          timeBucket,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timezone).toBe("Asia/Seoul");
          expect(result.data.limit).toBe(50);
        }
      }
    });

    it("sum, avg, min, max 메트릭 요청 시 targetFieldId가 없으면 실패해야 한다", () => {
      for (const metric of ["sum", "avg", "min", "max"] as const) {
        const missingField = analyticsAggregationQuerySchema.safeParse({
          formId: validUuid,
          metric,
        });
        expect(missingField.success).toBe(false);

        const withField = analyticsAggregationQuerySchema.safeParse({
          formId: validUuid,
          metric,
          targetFieldId: "f_amount",
        });
        expect(withField.success).toBe(true);
      }
    });
  });

  describe("computeSeriesMetricInputSchema", () => {
    it("subtract, add, ratio 연산과 유효한 시리즈를 통과시켜야 한다", () => {
      const parsed = computeSeriesMetricInputSchema.safeParse({
        operation: "ratio",
        baseSeries: [{ key: "2026-Q1", value: 80 }],
        targetSeries: [{ key: "2026-Q1", value: 100 }],
        resultKey: "execution_rate",
      });

      expect(parsed.success).toBe(true);
    });

    it("지원하지 않는 연산자나 빈 resultKey는 실패해야 한다", () => {
      expect(
        computeSeriesMetricInputSchema.safeParse({
          operation: "multiply",
          baseSeries: [],
          targetSeries: [],
          resultKey: "x",
        }).success
      ).toBe(false);

      expect(
        computeSeriesMetricInputSchema.safeParse({
          operation: "subtract",
          baseSeries: [],
          targetSeries: [],
          resultKey: "",
        }).success
      ).toBe(false);
    });
  });
});
