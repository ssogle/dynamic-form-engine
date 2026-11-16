import { describe, expect, it } from "vitest";
import {
  buildContinuousTimeBucketKeys,
  computeSeriesMetric,
  formatFieldDisplayKey,
  formatTimeBucketKey,
  mergeSeriesWithZeroFill,
  parseNumericValue,
  resolveFieldOptionLabelMap,
} from "./analytics-calculator";

describe("Analytics Calculator (entities/form-submission/lib)", () => {
  describe("parseNumericValue (비수치 및 빈 문자열 방어)", () => {
    it("유효한 숫자와 숫자 문자열을 파싱하고 콤마가 포함된 금액 문자열도 처리해야 한다", () => {
      expect(parseNumericValue(1500)).toBe(1500);
      expect(parseNumericValue(-42.5)).toBe(-42.5);
      expect(parseNumericValue("25000")).toBe(25000);
      expect(parseNumericValue(" 1,234.50 ")).toBe(1234.5);
    });

    it("빈 문자열, null, undefined, NaN, Infinity, 비수치 문자열은 null을 반환해야 한다", () => {
      expect(parseNumericValue("")).toBeNull();
      expect(parseNumericValue("   ")).toBeNull();
      expect(parseNumericValue(null)).toBeNull();
      expect(parseNumericValue(undefined)).toBeNull();
      expect(parseNumericValue(Number.NaN)).toBeNull();
      expect(parseNumericValue(Number.POSITIVE_INFINITY)).toBeNull();
      expect(parseNumericValue("미정")).toBeNull();
      expect(parseNumericValue("12abc")).toBeNull();
      expect(parseNumericValue(true)).toBeNull();
    });
  });

  describe("resolveFieldOptionLabelMap & formatFieldDisplayKey (select/radio/checkbox 라벨 매핑)", () => {
    const schemaDefinition = {
      primaryFieldId: "f_dept",
      fields: [
        {
          id: "f_dept",
          type: "select",
          label: "부서",
          options: [
            { label: "영업팀", value: "sales", disabled: false },
            { label: "구)마케팅팀", value: "mkt_legacy", disabled: true },
          ],
        },
        {
          id: "f_tags",
          type: "checkbox",
          label: "유형",
          options: [
            { label: "신규", value: "new", disabled: false },
            { label: "긴급", value: "urgent", disabled: false },
          ],
        },
        {
          id: "f_deleted",
          type: "select",
          label: "삭제필드",
          deletedAt: "2026-11-01T00:00:00Z",
          options: [{ label: "A", value: "a", disabled: false }],
        },
      ],
    };

    it("소프트 삭제된 필드는 제외하고 활성 필드의 옵션 value->label 맵(폐기 옵션 포함)을 생성해야 한다", () => {
      const fieldMetaMap = resolveFieldOptionLabelMap(schemaDefinition);

      expect(fieldMetaMap.has("f_deleted")).toBe(false);
      const deptMeta = fieldMetaMap.get("f_dept");
      expect(deptMeta?.label).toBe("부서");
      expect(deptMeta?.optionsMap.get("sales")).toBe("영업팀");
      expect(deptMeta?.optionsMap.get("mkt_legacy")).toBe("구)마케팅팀");
    });

    it("select 단일 값, checkbox 다중 배열, null/빈값을 사람 친화적 라벨로 변환해야 한다", () => {
      const fieldMetaMap = resolveFieldOptionLabelMap(schemaDefinition);
      const deptOptions = fieldMetaMap.get("f_dept")?.optionsMap;
      const tagOptions = fieldMetaMap.get("f_tags")?.optionsMap;

      expect(formatFieldDisplayKey("sales", deptOptions)).toBe("영업팀");
      expect(formatFieldDisplayKey("mkt_legacy", deptOptions)).toBe("구)마케팅팀");
      expect(formatFieldDisplayKey(["new", "urgent"], tagOptions)).toBe("신규, 긴급");
      expect(formatFieldDisplayKey(null, deptOptions)).toBe("미응답");
      expect(formatFieldDisplayKey("", deptOptions)).toBe("미응답");
      expect(formatFieldDisplayKey([], tagOptions)).toBe("미응답");
    });
  });

  describe("formatTimeBucketKey (day/week/month/quarter 및 KST/UTC 경계 보정)", () => {
    it("UTC 2026-03-31 18:00:00Z는 Asia/Seoul 기준 2026-04-01이므로 2026-Q2, 2026-04, 2026-04-01로 분류되어야 한다", () => {
      const boundaryDate = new Date("2026-03-31T18:00:00.000Z");

      expect(formatTimeBucketKey(boundaryDate, "day", "Asia/Seoul")).toBe("2026-04-01");
      expect(formatTimeBucketKey(boundaryDate, "month", "Asia/Seoul")).toBe("2026-04");
      expect(formatTimeBucketKey(boundaryDate, "quarter", "Asia/Seoul")).toBe("2026-Q2");
      expect(formatTimeBucketKey(boundaryDate, "quarter", "UTC")).toBe("2026-Q1");
    });

    it("week 버킷은 해당 주 월요일 날짜(YYYY-MM-DD)로 정규화되어야 한다", () => {
      // 2026-11-18(수) -> 월요일은 2026-11-16
      const wednesday = new Date("2026-11-18T05:00:00.000Z");
      expect(formatTimeBucketKey(wednesday, "week", "Asia/Seoul")).toBe("2026-11-16");
    });
  });

  describe("mergeSeriesWithZeroFill (다중 폼 합집합 Zero-fill 병합)", () => {
    it("서로 다른 키를 가진 복수 시리즈를 합집합 기준으로 0 채움하고 정렬해야 한다", () => {
      const merged = mergeSeriesWithZeroFill(
        [
          {
            seriesKey: "revenue",
            points: [
              { key: "2026-Q2", value: 1200 },
              { key: "2026-Q1", value: 1000 },
            ],
          },
          {
            seriesKey: "cost",
            points: [
              { key: "2026-Q1", value: 700 },
              { key: "2026-Q3", value: 300 },
            ],
          },
        ],
        "key_asc"
      );

      expect(merged).toEqual([
        { key: "2026-Q1", revenue: 1000, cost: 700 },
        { key: "2026-Q2", revenue: 1200, cost: 0 },
        { key: "2026-Q3", revenue: 0, cost: 300 },
      ]);
    });
  });

  describe("computeSeriesMetric (결정론적 시리즈 산술 연산)", () => {
    it("subtract(손익) 및 add(합산)를 합집합 Zero-fill과 부동소수점 보정으로 계산해야 한다", () => {
      const profitResult = computeSeriesMetric({
        operation: "subtract",
        baseSeries: [
          { key: "2026-Q1", value: 1000.3 },
          { key: "2026-Q2", value: 500 },
        ],
        targetSeries: [
          { key: "2026-Q1", value: 1000.1 },
          { key: "2026-Q3", value: 200 },
        ],
        resultKey: "net_profit",
      });

      expect(profitResult.rows).toEqual([
        { key: "2026-Q1", baseValue: 1000.3, targetValue: 1000.1, net_profit: 0.2 },
        { key: "2026-Q2", baseValue: 500, targetValue: 0, net_profit: 500 },
        { key: "2026-Q3", baseValue: 0, targetValue: 200, net_profit: -200 },
      ]);

      const addResult = computeSeriesMetric({
        operation: "add",
        baseSeries: [{ key: "A", value: 0.1 }],
        targetSeries: [{ key: "A", value: 0.2 }],
        resultKey: "total",
      });
      expect(addResult.rows[0]?.total).toBe(0.3);
    });

    it("ratio(백분율) 연산 시 소수점 둘째 자리 반올림과 분모 0에 대한 null 방어를 수행해야 한다", () => {
      const ratioResult = computeSeriesMetric({
        operation: "ratio",
        baseSeries: [
          { key: "2026-Q1", value: 2 },
          { key: "2026-Q2", value: 150 },
        ],
        targetSeries: [
          { key: "2026-Q1", value: 3 },
          { key: "2026-Q2", value: 0 },
          { key: "2026-Q3", value: 100 },
        ],
        resultKey: "execution_rate",
      });

      expect(ratioResult.rows).toEqual([
        { key: "2026-Q1", baseValue: 2, targetValue: 3, execution_rate: 66.67 },
        { key: "2026-Q2", baseValue: 150, targetValue: 0, execution_rate: null },
        { key: "2026-Q3", baseValue: 0, targetValue: 100, execution_rate: 0 },
      ]);
    });
  });

  describe("buildContinuousTimeBucketKeys (0건 구간 포함 연속 버킷 생성)", () => {
    it("month/quarter/week/day 단위 연속 키를 생성하고 limit 초과 시 최신 구간만 유지하며 isTruncated를 반환한다", () => {
      expect(buildContinuousTimeBucketKeys("month", "2026-08-16", "2026-11-16", 50)).toEqual({
        keys: ["2026-08", "2026-09", "2026-10", "2026-11"],
        isTruncated: false,
      });

      expect(buildContinuousTimeBucketKeys("month", "2026-01-01", "2026-11-30", 2)).toEqual({
        keys: ["2026-10", "2026-11"],
        isTruncated: true,
      });

      expect(buildContinuousTimeBucketKeys("quarter", "2026-01-15", "2026-11-16", 50)).toEqual({
        keys: ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"],
        isTruncated: false,
      });

      expect(buildContinuousTimeBucketKeys("day", "2026-11-14", "2026-11-16", 50)).toEqual({
        keys: ["2026-11-14", "2026-11-15", "2026-11-16"],
        isTruncated: false,
      });

      expect(buildContinuousTimeBucketKeys("week", "2026-11-04", "2026-11-18", 50)).toEqual({
        keys: ["2026-11-02", "2026-11-09", "2026-11-16"],
        isTruncated: false,
      });
    });
  });
});
