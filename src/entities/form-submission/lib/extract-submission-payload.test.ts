import { describe, expect, it } from "vitest";
import { extractSubmissionPayload } from "./extract-submission-payload";

describe("extractSubmissionPayload (entities/form-submission/lib)", () => {
  it("data 속성으로 래핑된 요청 본문이면 내부 data 객체를 추출해야 한다", () => {
    expect(extractSubmissionPayload({ data: { f_name: "홍길동", f_amount: 1000 } })).toEqual({
      f_name: "홍길동",
      f_amount: 1000,
    });
  });

  it("래핑 없이 평면 Key-Value 객체가 전달되면 그대로 반환해야 한다", () => {
    expect(extractSubmissionPayload({ f_name: "김철수", f_urgent: true })).toEqual({
      f_name: "김철수",
      f_urgent: true,
    });
  });

  it("null, undefined, 배열, 원시값 등 비객체 본문이면 빈 객체를 반환해야 한다", () => {
    expect(extractSubmissionPayload(null)).toEqual({});
    expect(extractSubmissionPayload(undefined)).toEqual({});
    expect(extractSubmissionPayload("invalid")).toEqual({});
    expect(extractSubmissionPayload(123)).toEqual({});
    expect(extractSubmissionPayload(["a", "b"])).toEqual({});
  });
});
