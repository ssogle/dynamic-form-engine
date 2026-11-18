import { describe, expect, it } from "vitest";
import { parseFiltersParam, submissionQuerySchema } from "./submission-query.schema";

describe("Submission Query Schema (submission-query.schema)", () => {
  it("유효한 기간 필터(startDate, endDate, dateFieldId)를 파싱하고 빈 문자열은 undefined로 정규화해야 한다", () => {
    const parsed = submissionQuerySchema.safeParse({
      page: "1",
      limit: "20",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      dateFieldId: "f_expense_date",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startDate).toBe("2026-10-01");
      expect(parsed.data.endDate).toBe("2026-10-31");
      expect(parsed.data.dateFieldId).toBe("f_expense_date");
    }

    const emptyParams = submissionQuerySchema.safeParse({
      startDate: "",
      endDate: " ",
      dateFieldId: "",
    });
    expect(emptyParams.success).toBe(true);
    if (emptyParams.success) {
      expect(emptyParams.data.startDate).toBeUndefined();
      expect(emptyParams.data.endDate).toBeUndefined();
      expect(emptyParams.data.dateFieldId).toBeUndefined();
    }
  });

  it("잘못된 날짜 포맷이나 시작일 > 종료일 역전 기간은 거부해야 한다", () => {
    expect(
      submissionQuerySchema.safeParse({
        startDate: "2026-11-16",
        endDate: "2026-10-01",
      }).success
    ).toBe(false);

    expect(
      submissionQuerySchema.safeParse({
        startDate: "2026-02-31",
      }).success
    ).toBe(false);
  });

  it("parseFiltersParam은 신규 연산자 배열 형식과 레거시 key-value 객체 형식을 모두 파싱해야 한다", () => {
    expect(
      parseFiltersParam(
        JSON.stringify([{ fieldId: "f_amount", op: "between", min: 100, max: 500 }])
      )
    ).toEqual([{ fieldId: "f_amount", op: "between", min: 100, max: 500 }]);

    expect(parseFiltersParam(JSON.stringify({ f_name: "홍길동" }))).toEqual([
      { fieldId: "f_name", op: "contains", value: "홍길동" },
    ]);

    expect(parseFiltersParam("invalid-json")).toEqual([]);
  });
});
