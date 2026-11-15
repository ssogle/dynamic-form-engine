import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RelatedSubmissionsGroup } from "@/entities/form-submission";
import * as formSubmissionServer from "@/entities/form-submission/server";
import * as relationsRouteModule from "./route";

// 엔티티 서버 레이어의 역참조 조회 함수를 모킹하여 Thin Controller의 파라미터 검증 및 위임 계약을 테스트합니다.
vi.mock("@/entities/form-submission/server", () => ({
  findInboundRelatedSubmissions: vi.fn(),
}));

describe("GET /api/v1/relations (Hono Thin Controller)", () => {
  const VALID_TARGET_ID = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports only allowed HTTP method handlers (GET)", () => {
    expect(typeof relationsRouteModule.GET).toBe("function");
    expect("POST" in relationsRouteModule).toBe(false);
    expect("relationsApp" in relationsRouteModule).toBe(false);
  });

  it("returns 400 BAD_REQUEST when targetId query param is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/relations");
    const res = await relationsRouteModule.GET(req);

    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; details?: unknown };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.details).toBeDefined();
    expect(formSubmissionServer.findInboundRelatedSubmissions).not.toHaveBeenCalled();
  });

  it("returns 400 BAD_REQUEST when targetId is not a valid UUID", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/relations?targetId=invalid-id");
    const res = await relationsRouteModule.GET(req);

    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(formSubmissionServer.findInboundRelatedSubmissions).not.toHaveBeenCalled();
  });

  it("delegates valid targetId to findInboundRelatedSubmissions and returns 200 OK", async () => {
    const mockGroups: RelatedSubmissionsGroup[] = [
      {
        sourceForm: {
          id: "11111111-1111-4111-a111-111111111111",
          title: "관련 고객 요청",
          schemaDefinition: { primaryFieldId: "f_title", fields: [] },
        },
        submissions: [
          {
            id: "22222222-2222-4222-a222-222222222222",
            formId: "11111111-1111-4111-a111-111111111111",
            data: { f_title: "상담 1건" },
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            deletedAt: null,
          },
        ],
      },
    ];

    vi.mocked(formSubmissionServer.findInboundRelatedSubmissions).mockResolvedValue(mockGroups);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/relations?targetId=${VALID_TARGET_ID}`
    );
    const res = await relationsRouteModule.GET(req);

    expect(res.status).toBe(200);
    expect(formSubmissionServer.findInboundRelatedSubmissions).toHaveBeenCalledWith(
      VALID_TARGET_ID
    );
    const json = (await res.json()) as {
      success: boolean;
      data: Array<{ sourceForm: { id: string; title: string }; submissions: unknown[] }>;
    };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.sourceForm.title).toBe("관련 고객 요청");
    expect(json.data[0]?.submissions).toHaveLength(1);
  });

  it("converts unexpected repository errors into 500 INTERNAL_SERVER_ERROR JSON", async () => {
    vi.mocked(formSubmissionServer.findInboundRelatedSubmissions).mockRejectedValue(
      new Error("DB 조회 실패")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/v1/relations?targetId=${VALID_TARGET_ID}`
    );
    const res = await relationsRouteModule.GET(req);

    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json).toEqual({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "DB 조회 실패",
      },
    });
  });
});
