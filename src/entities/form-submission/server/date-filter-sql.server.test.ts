import { describe, expect, it } from "vitest";
import { isValidTimezone } from "../schema/date-range.schema";
import { buildDateRangeConditions, buildTimeBucketSql } from "./date-filter-sql.server";

describe("Date Filter SQL Helpers (date-filter-sql)", () => {
  it("유효한 IANA 시간대와 잘못된 시간대 문자열을 정확히 판별해야 한다", () => {
    expect(isValidTimezone("Asia/Seoul")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Invalid/Zone_Test")).toBe(false);
  });

  it("dateFieldId 기준 및 createdAt 폴백 기준에 따라 조건 목록 개수를 알맞게 생성해야 한다", () => {
    const withField = buildDateRangeConditions({
      dateFieldId: "f_expense_date",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    // IS NOT NULL + >= startDate + <= endDate
    expect(withField).toHaveLength(3);

    const withFieldNoRangeRequireValid = buildDateRangeConditions({
      dateFieldId: "f_expense_date",
      requireValidDateField: true,
    });
    expect(withFieldNoRangeRequireValid).toHaveLength(1);

    const withCreatedAtFallback = buildDateRangeConditions({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      timezone: "Asia/Seoul",
    });
    // createdAt >= startBound + createdAt < nextDayBound
    expect(withCreatedAtFallback).toHaveLength(2);

    const empty = buildDateRangeConditions({});
    expect(empty).toHaveLength(0);
  });

  it("timeBucket(quarter/month/week/day) SQL 표현식을 dateFieldId 유무와 관계없이 생성해야 한다", () => {
    for (const bucket of ["day", "week", "month", "quarter"] as const) {
      expect(buildTimeBucketSql(bucket, "Asia/Seoul", "f_date")).toBeDefined();
      expect(buildTimeBucketSql(bucket, "Asia/Seoul")).toBeDefined();
    }
  });
});
