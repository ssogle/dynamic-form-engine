import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, parseRequestData, withErrorHandler } from "./server";
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

  it("apiResponse.fail은 프로덕션 환경에서 일반 Error의 내부 메시지를 마스킹하고 서버 로그만 기록해야 한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = apiResponse.fail(new Error('relation "forms" violates constraint fk_secret'));
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json).toEqual({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "서버 처리 중 오류가 발생했습니다.",
        },
      });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  describe("parseRequestData", () => {
    const schema = z.object({
      id: z.uuid("유효한 UUID가 아닙니다."),
    });

    it("스키마 검증 통과 시 파싱된 데이터를 반환해야 한다", () => {
      const validId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const parsed = parseRequestData(schema, { id: validId }, "요청 파라미터가 잘못되었습니다.");
      expect(parsed).toEqual({ id: validId });
    });

    it("스키마 검증 실패 시 400 BAD_REQUEST HttpErrorObject(details 포함)를 던져야 한다", () => {
      expect(() =>
        parseRequestData(schema, { id: "not-a-uuid" }, "올바른 식별자가 필요합니다.")
      ).toThrow("올바른 식별자가 필요합니다.");

      try {
        parseRequestData(schema, { id: "not-a-uuid" }, "올바른 식별자가 필요합니다.");
      } catch (err) {
        const res = apiResponse.fail(err);
        expect(res.status).toBe(400);
      }
    });
  });
});
