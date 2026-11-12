import { describe, expect, it } from "vitest";
import {
  submissionQuerySchema,
  parseSortParam,
  parseFiltersParam,
  parseIdsParam,
} from "./submission-query.schema";

describe("submissionQuerySchema (entities/form-submission/schema)", () => {
  it("기본값이 올바르게 적용되어야 한다", () => {
    const parsed = submissionQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sort).toBe("createdAt:desc");
    expect(parsed.filters).toBeUndefined();
    expect(parsed.ids).toBeUndefined();
  });

  it("ids 쿼리 파라미터를 문자열로 파싱해야 한다", () => {
    const id1 = "11111111-1111-4111-a111-111111111111";
    const id2 = "22222222-2222-4222-a222-222222222222";
    const parsed = submissionQuerySchema.parse({
      ids: `${id1},${id2}`,
    });
    expect(parsed.ids).toBe(`${id1},${id2}`);
  });

  it("문자열 형태의 숫자 파라미터를 숫자로 강제 변환(coerce)해야 한다", () => {
    const parsed = submissionQuerySchema.parse({
      page: "3",
      limit: "50",
    });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
  });

  it("유효하지 않은 page나 limit는 검증 에러를 발생시켜야 한다", () => {
    expect(() => submissionQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => submissionQuerySchema.parse({ limit: 101 })).toThrow();
  });
});

describe("parseSortParam", () => {
  it("쉼표로 분리된 멀티 정렬 문자열을 SortItem[] 배열로 파싱해야 한다", () => {
    const result = parseSortParam("f_exp:desc,f_name:asc,createdAt:desc");
    expect(result).toEqual([
      { id: "f_exp", desc: true },
      { id: "f_name", desc: false },
      { id: "createdAt", desc: true },
    ]);
  });

  it("정렬 방향이 생략되거나 비어있을 때 안전하게 기본값을 반환해야 한다", () => {
    const emptyResult = parseSortParam("");
    expect(emptyResult).toEqual([{ id: "createdAt", desc: true }]);

    const undefinedResult = parseSortParam(undefined);
    expect(undefinedResult).toEqual([{ id: "createdAt", desc: true }]);
  });
});

describe("parseFiltersParam", () => {
  it("JSON 문자열을 Record<string, string>으로 안전하게 파싱해야 한다", () => {
    const raw = JSON.stringify({
      f_applicant: "홍길동",
      f_role: "frontend",
      f_exp: 5,
    });
    const result = parseFiltersParam(raw);
    expect(result).toEqual({
      f_applicant: "홍길동",
      f_role: "frontend",
      f_exp: "5",
    });
  });

  it("잘못된 JSON 형식이나 빈 문자열에 대해 빈 객체를 반환해야 한다", () => {
    expect(parseFiltersParam("invalid-json")).toEqual({});
    expect(parseFiltersParam("")).toEqual({});
    expect(parseFiltersParam(undefined)).toEqual({});
    expect(parseFiltersParam("[]")).toEqual({});
  });
});

describe("parseIdsParam", () => {
  it("쉼표로 구분된 UUID 문자열을 공백 제거 및 중복 제거하여 UUID 배열로 파싱해야 한다", () => {
    const id1 = "11111111-1111-4111-a111-111111111111";
    const id2 = "22222222-2222-4222-a222-222222222222";
    const result = parseIdsParam(` ${id1} , ${id2}, ${id1}, invalid-token `);
    expect(result).toEqual([id1, id2]);
  });

  it("빈 문자열이나 undefined 전달 시 빈 배열을 반환해야 한다", () => {
    expect(parseIdsParam(undefined)).toEqual([]);
    expect(parseIdsParam("")).toEqual([]);
    expect(parseIdsParam("not-a-uuid,123")).toEqual([]);
  });
});
