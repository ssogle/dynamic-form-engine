import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiResponse } from "@/shared/lib/http";
import { createApiRouter } from "./create-api-router";
import { parseJsonBody, parseQueryParams, parseRouteParams, readJsonBody } from "./request-helpers";

describe("request-helpers", () => {
  describe("parseRouteParams", () => {
    it("extracts and validates route params against a Zod schema", async () => {
      const paramsSchema = z.object({
        id: z.uuid("유효한 UUID 형식이 아닙니다."),
      });

      const app = createApiRouter({ basePath: "/api/v1/test" });
      app.get("/:id", (c) => {
        const { id } = parseRouteParams(c, paramsSchema);
        return apiResponse.ok({ id });
      });

      const validId = "550e8400-e29b-41d4-a716-446655440000";
      const validRes = await app.request(`/api/v1/test/${validId}`);
      expect(validRes.status).toBe(200);
      expect(await validRes.json()).toEqual({ success: true, data: { id: validId } });

      const invalidRes = await app.request("/api/v1/test/not-a-uuid");
      expect(invalidRes.status).toBe(400);
      const invalidJson = (await invalidRes.json()) as {
        success: boolean;
        error: { code: string; message: string; details?: unknown };
      };
      expect(invalidJson.success).toBe(false);
      expect(invalidJson.error.code).toBe("BAD_REQUEST");
      expect(invalidJson.error.details).toBeDefined();
    });
  });

  describe("parseQueryParams", () => {
    it("extracts and coerces query string parameters against a Zod schema", async () => {
      const querySchema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        published: z.enum(["true", "false"]).optional(),
      });

      const app = createApiRouter({ basePath: "/api/v1/test" });
      app.get("/", (c) => {
        const query = parseQueryParams(c, querySchema, "쿼리 파라미터 검증 실패");
        return apiResponse.ok(query);
      });

      const defaultRes = await app.request("/api/v1/test");
      expect(defaultRes.status).toBe(200);
      expect(await defaultRes.json()).toEqual({
        success: true,
        data: { page: 1 },
      });

      const customRes = await app.request("/api/v1/test?page=3&published=true");
      expect(customRes.status).toBe(200);
      expect(await customRes.json()).toEqual({
        success: true,
        data: { page: 3, published: "true" },
      });

      const badRes = await app.request("/api/v1/test?page=0");
      expect(badRes.status).toBe(400);
      const badJson = (await badRes.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(badJson.error.code).toBe("BAD_REQUEST");
      expect(badJson.error.message).toBe("쿼리 파라미터 검증 실패");
    });
  });

  describe("readJsonBody", () => {
    it("parses valid JSON request bodies", async () => {
      const app = createApiRouter({ basePath: "/api/v1/test" });
      app.post("/raw", async (c) => {
        const body = await readJsonBody(c);
        return apiResponse.ok(body);
      });

      const res = await app.request("/api/v1/test/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { fieldA: "hello" } }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        data: { data: { fieldA: "hello" } },
      });
    });

    it("throws 400 BAD_REQUEST on malformed JSON syntax", async () => {
      const app = createApiRouter({ basePath: "/api/v1/test" });
      app.post("/raw", async (c) => {
        const body = await readJsonBody(c);
        return apiResponse.ok(body);
      });

      const res = await app.request("/api/v1/test/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ broken-json",
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("handles empty request body based on allowEmpty option", async () => {
      const app = createApiRouter({ basePath: "/api/v1/test" });
      app.post("/strict", async (c) => {
        const body = await readJsonBody(c);
        return apiResponse.ok(body);
      });
      app.post("/optional", async (c) => {
        const body = await readJsonBody(c, { allowEmpty: true });
        return apiResponse.ok(body);
      });

      const strictRes = await app.request("/api/v1/test/strict", { method: "POST" });
      expect(strictRes.status).toBe(400);

      const optionalRes = await app.request("/api/v1/test/optional", { method: "POST" });
      expect(optionalRes.status).toBe(200);
      expect(await optionalRes.json()).toEqual({ success: true, data: {} });
    });
  });

  describe("parseJsonBody", () => {
    it("reads JSON body and validates it with the given Zod schema", async () => {
      const bodySchema = z.object({
        title: z.string().min(1, "제목은 필수입니다."),
      });

      const app = createApiRouter({ basePath: "/api/v1/test" });
      app.post("/validated", async (c) => {
        const parsed = await parseJsonBody(c, bodySchema, "폼 데이터 검증 실패");
        return apiResponse.created(parsed);
      });

      const okRes = await app.request("/api/v1/test/validated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "고객 설문" }),
      });
      expect(okRes.status).toBe(201);
      expect(await okRes.json()).toEqual({
        success: true,
        data: { title: "고객 설문" },
      });

      const invalidSyntaxRes = await app.request("/api/v1/test/validated", {
        method: "POST",
        body: "{bad",
      });
      expect(invalidSyntaxRes.status).toBe(400);

      const schemaFailRes = await app.request("/api/v1/test/validated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });
      expect(schemaFailRes.status).toBe(400);
      const schemaFailJson = (await schemaFailRes.json()) as {
        success: boolean;
        error: { code: string; message: string; details?: unknown };
      };
      expect(schemaFailJson.error.code).toBe("BAD_REQUEST");
      expect(schemaFailJson.error.message).toBe("폼 데이터 검증 실패");
      expect(schemaFailJson.error.details).toBeDefined();
    });
  });
});
