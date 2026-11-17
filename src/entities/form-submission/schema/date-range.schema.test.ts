import { describe, expect, it } from "vitest";
import { calendarDateStringSchema, isValidCalendarDate } from "./date-range.schema";

describe("Date Range Shared Schema (date-range.schema)", () => {
  it("실존하는 달력 날짜와 윤년 날짜를 허용하고 2월 31일 등 존재하지 않는 날짜를 거부해야 한다", () => {
    expect(isValidCalendarDate("2026-11-16")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
    expect(isValidCalendarDate("2026-02-31")).toBe(false);
    expect(isValidCalendarDate("2026-04-31")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2026/11/16")).toBe(false);
  });

  it("calendarDateStringSchema가 유효하지 않은 포맷 및 날짜에 오류를 반환해야 한다", () => {
    expect(calendarDateStringSchema.safeParse("2026-11-16").success).toBe(true);
    expect(calendarDateStringSchema.safeParse("2026-02-30").success).toBe(false);
    expect(calendarDateStringSchema.safeParse("invalid-date").success).toBe(false);
  });
});
