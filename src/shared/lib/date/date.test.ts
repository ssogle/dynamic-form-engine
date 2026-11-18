import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDateToYmd,
  formatRelativeTime,
  formatUtc,
  formatYmdInputMask,
  nowUtcIso,
  parseYmdToDate,
  toSafeDate,
  toUtcIso,
} from "@/shared/lib/date";

describe("Date Utilities (shared/lib/date)", () => {
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

  describe("formatDateToYmd & parseYmdToDate", () => {
    it("formatDateToYmd는 로컬 Date 객체에서 타임존 왜곡 없이 YYYY-MM-DD 문자열을 추출해야 한다", () => {
      const localDate = new Date(2026, 0, 5);
      expect(formatDateToYmd(localDate)).toBe("2026-01-05");
    });

    it("parseYmdToDate는 유효한 YYYY-MM-DD 문자열을 로컬 Date 객체로 파싱하고 비정상 입력은 undefined를 반환해야 한다", () => {
      const parsed = parseYmdToDate("2026-01-05");
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(0);
      expect(parsed?.getDate()).toBe(5);

      const leapYearParsed = parseYmdToDate("2024-02-29");
      expect(leapYearParsed?.getFullYear()).toBe(2024);
      expect(leapYearParsed?.getMonth()).toBe(1);
      expect(leapYearParsed?.getDate()).toBe(29);

      expect(parseYmdToDate("2026-02-29")).toBeUndefined();
      expect(parseYmdToDate("2026-02-31")).toBeUndefined();
      expect(parseYmdToDate("2026/01/05")).toBeUndefined();
      expect(parseYmdToDate(undefined)).toBeUndefined();
      expect(parseYmdToDate(12345)).toBeUndefined();
    });
  });

  describe("formatYmdInputMask", () => {
    it("숫자 외의 문자(영문, 한글, 특수문자)를 차단하고 YYYY-MM-DD 형식으로 마스킹해야 한다", () => {
      expect(formatYmdInputMask("abc")).toBe("");
      expect(formatYmdInputMask("가나다2026!@#")).toBe("2026");
      expect(formatYmdInputMask("2026년 11월 18일")).toBe("2026-11-18");
      expect(formatYmdInputMask("20261")).toBe("2026-1");
      expect(formatYmdInputMask("202611")).toBe("2026-11");
      expect(formatYmdInputMask("20261118")).toBe("2026-11-18");
      expect(formatYmdInputMask("20261118999")).toBe("2026-11-18");
    });

    it("백스페이스 삭제 시 후행 하이픈이 남아 입력이 막히지 않아야 한다", () => {
      expect(formatYmdInputMask("2026-")).toBe("2026");
      expect(formatYmdInputMask("2026-11-")).toBe("2026-11");
    });
  });
});
