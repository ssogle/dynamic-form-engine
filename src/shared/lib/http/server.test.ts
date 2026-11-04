import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { apiResponse, withErrorHandler } from "./server";
import { notFound, badRequest } from "./errors";

describe("HTTP Server Utilities (apiResponse & withErrorHandler)", () => {
  it("apiResponse.ok는 200 상태코드와 성공 페이로드를 반환해야 한다", async () => {
    const res = apiResponse.ok({ id: 1, name: "폼" });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({
      success: true,
      data: { id: 1, name: "폼" },
    });
  });

  it("apiResponse.created는 201 상태코드를 반환해야 한다", async () => {
    const res = apiResponse.created({ id: 2 });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ id: 2 });
  });

  it("apiResponse.fail은 HttpErrorObject의 status와 code를 반영해야 한다", async () => {
    const err = notFound("해당 폼이 없습니다.");
    const res = apiResponse.fail(err);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "해당 폼이 없습니다.",
      },
    });
  });

  it("withErrorHandler는 throw된 에러를 가로채어 JSON 에러 응답으로 변환해야 한다", async () => {
    const handler = withErrorHandler(async () => {
      throw badRequest("잘못된 필드 값입니다.", { field: "title" });
    });

    const dummyReq = new NextRequest("http://localhost:3000/api/test");
    const res = await handler(dummyReq, undefined);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("잘못된 필드 값입니다.");
    expect(json.error.details).toEqual({ field: "title" });
  });
});
