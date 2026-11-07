import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatUtc,
  nowUtcIso,
  toSafeDate,
  toUtcIso,
} from "./date.util";

describe("Date Utilities (shared/lib/utils/date.util)", () => {
  const fixedDate = new Date("2026-11-08T12:30:45Z");

  describe("nowUtcIso & toUtcIso", () => {
    it("nowUtcIso는 ISO-8601 UTC 규격(Z 종료) 문자열을 반환해야 한다", () => {
      const iso = nowUtcIso();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("toUtcIso는 유효한 Date 입력을 받아 정확한 UTC ISO 문자열로 변환해야 한다", () => {
      expect(toUtcIso(fixedDate)).toBe("2026-11-08T12:30:45.000Z");
      expect(toUtcIso(null)).toBeNull();
      expect(toUtcIso(undefined)).toBeNull();
    });
  });

  describe("formatUtc", () => {
    it("로컬 타임존과 무관하게 항상 UTC 기준으로 일시를 포맷팅해야 한다", () => {
      // 12시 30분 UTC
      const formatted = formatUtc(fixedDate);
      expect(formatted).toBe("2026.11.08 12:30 UTC");
    });

    it("null 또는 유효하지 않은 값이 주어지면 fallback을 반환해야 한다", () => {
      expect(formatUtc(null)).toBe("-");
      expect(formatUtc("invalid-date", "yyyy.MM.dd", "미등록")).toBe("미등록");
    });
  });

  describe("toSafeDate", () => {
    it("유효한 Date 객체는 그대로 반환해야 한다", () => {
      const result = toSafeDate(fixedDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(fixedDate.toISOString());
    });

    it("유효한 ISO 문자열을 Date 객체로 변환해야 한다", () => {
      const result = toSafeDate("2026-11-08T12:30:45Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(fixedDate.toISOString());
    });

    it("null, undefined, 빈 문자열인 경우 null을 반환해야 한다", () => {
      expect(toSafeDate(null)).toBeNull();
      expect(toSafeDate(undefined)).toBeNull();
      expect(toSafeDate("")).toBeNull();
    });

    it("유효하지 않은 날짜 문자열인 경우 null을 반환해야 한다", () => {
      expect(toSafeDate("invalid-date-string")).toBeNull();
    });
  });

  describe("formatDate", () => {
    it("기본 포맷(yyyy.MM.dd)으로 날짜를 올바르게 포맷팅해야 한다", () => {
      const formatted = formatDate(fixedDate);
      expect(formatted).toMatch(/^2026\.11\.\d{2}$/);
    });

    it("커스텀 패턴을 지정하여 포맷팅할 수 있어야 한다", () => {
      const formatted = formatDate(fixedDate, "yyyy-MM-dd");
      expect(formatted).toMatch(/^2026-11-\d{2}$/);
    });

    it("null 또는 undefined가 전달되면 기본 fallback('-')을 반환해야 한다", () => {
      expect(formatDate(null)).toBe("-");
      expect(formatDate(undefined)).toBe("-");
    });

    it("유효하지 않은 날짜가 전달되면 사용자 지정 fallback을 반환해야 한다", () => {
      expect(formatDate("invalid-date", "yyyy.MM.dd", "미등록")).toBe("미등록");
    });
  });

  describe("formatDateTime", () => {
    it("기본 포맷(yyyy.MM.dd HH:mm)으로 날짜와 시간을 포맷팅해야 한다", () => {
      const formatted = formatDateTime(fixedDate);
      expect(formatted).toMatch(/^2026\.11\.\d{2} \d{2}:\d{2}$/);
    });

    it("null이 전달되면 '-'를 반환해야 한다", () => {
      expect(formatDateTime(null)).toBe("-");
    });
  });

  describe("formatRelativeTime", () => {
    it("현재로부터 과거 일시에 대해 한국어 상대 시간 표현을 반환해야 한다", () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const relative = formatRelativeTime(tenMinutesAgo);

      expect(relative).toContain("전");
    });

    it("null 또는 유효하지 않은 값이 전달되면 fallback을 반환해야 한다", () => {
      expect(formatRelativeTime(null)).toBe("-");
      expect(formatRelativeTime("invalid", "알 수 없음")).toBe("알 수 없음");
    });
  });
});
