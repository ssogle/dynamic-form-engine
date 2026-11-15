import { describe, expect, it } from "vitest";
import { apiResponse, badRequest } from "@/shared/lib/http";
import { createApiRouter, createSubRouter, handleRoute } from "./create-api-router";

describe("createApiRouter", () => {
  it("throws no error and routes correctly when basePath is omitted (default root)", async () => {
    const app = createApiRouter();
    app.get("/health", () => apiResponse.ok({ status: "ok" }));

    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: { status: string } };
    expect(json).toEqual({
      success: true,
      data: { status: "ok" },
    });
  });

  it("mounts routes under the specified basePath prefix", async () => {
    const app = createApiRouter({ basePath: "/api/v1/sample" });
    app.get("/", () => apiResponse.ok({ list: [] }));
    app.get("/:id", (c) => apiResponse.ok({ id: c.req.param("id") }));

    const listRes = await app.request("/api/v1/sample");
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toEqual({ success: true, data: { list: [] } });

    const itemRes = await app.request("/api/v1/sample/abc-123");
    expect(itemRes.status).toBe(200);
    expect(await itemRes.json()).toEqual({ success: true, data: { id: "abc-123" } });
  });

  it("converts HttpErrorObject thrown inside a handler into standard apiResponse.fail JSON", async () => {
    const app = createApiRouter({ basePath: "/api/v1/sample" });
    app.get("/fail", () => {
      throw badRequest("잘못된 요청 파라미터입니다.", { field: "title" });
    });

    const res = await app.request("/api/v1/sample/fail");
    expect(res.status).toBe(400);

    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string; details?: unknown };
    };
    expect(json).toEqual({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "잘못된 요청 파라미터입니다.",
        details: { field: "title" },
      },
    });
  });

  it("converts unexpected Error instances into 500 INTERNAL_SERVER_ERROR JSON", async () => {
    const app = createApiRouter({ basePath: "/api/v1/sample" });
    app.get("/boom", () => {
      throw new Error("DB 연결 실패");
    });

    const res = await app.request("/api/v1/sample/boom");
    expect(res.status).toBe(500);

    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "DB 연결 실패",
      },
    });
  });

  it("returns standard 404 NOT_FOUND JSON for unmatched paths", async () => {
    const app = createApiRouter({ basePath: "/api/v1/sample" });
    app.get("/", () => apiResponse.ok("ok"));

    const res = await app.request("/api/v1/sample/unknown/path");
    expect(res.status).toBe(404);

    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("delegates sub-router errors to parent router onError and notFound handlers", async () => {
    const subRouter = createSubRouter();
    subRouter.get("/sub-error", () => {
      throw badRequest("서브 라우터 검증 오류");
    });

    const app = createApiRouter({ basePath: "/api/v1/sample" });
    app.route("/", subRouter);

    const errorRes = await app.request("/api/v1/sample/sub-error");
    expect(errorRes.status).toBe(400);
    const errorJson = (await errorRes.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(errorJson.success).toBe(false);
    expect(errorJson.error.code).toBe("BAD_REQUEST");
    expect(errorJson.error.message).toBe("서브 라우터 검증 오류");

    const notFoundRes = await app.request("/api/v1/sample/missing");
    expect(notFoundRes.status).toBe(404);
  });
});

describe("handleRoute", () => {
  it("adapts a Hono router into a Next.js App Router Request handler", async () => {
    const app = createApiRouter({ basePath: "/api/v1/adapter-test" });
    app.post("/", async (c) => {
      const body = (await c.req.json()) as { name: string };
      return apiResponse.created({ greeting: `Hello, ${body.name}` });
    });

    const POST = handleRoute(app);
    const req = new Request("http://localhost:3000/api/v1/adapter-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Engine" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      data: { greeting: "Hello, Engine" },
    });
  });
});
