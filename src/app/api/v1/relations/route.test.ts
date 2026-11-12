import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/shared/db/server", () => ({
  db: {
    select: () => mockSelect(),
  },
}));

describe("Route Handler: GET /api/v1/relations", () => {
  const targetId = "11111111-1111-4111-a111-111111111111";
  const sourceFormId = "22222222-2222-4222-a222-222222222222";
  const sourceSubmissionId = "33333333-3333-4333-a333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("targetId가 누락되었거나 UUID 형식이 아닌 경우 400 에러를 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/v1/relations");
    const response = await GET(req, {});

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: { message: string } };
    expect(body.success).toBe(false);
    expect(body.error.message).toContain("올바른 targetId(UUID)");
  });

  it("연결된 엣지가 없을 경우 빈 배열을 반환해야 한다", async () => {
    // 1단계 엣지 조회 결과 빈 배열
    mockWhere.mockResolvedValueOnce([]);

    const req = new NextRequest(`http://localhost/api/v1/relations?targetId=${targetId}`);
    const response = await GET(req, {});

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("역방향 관계 엣지가 존재하면 소스 폼별로 그룹화하여 200 OK를 반환해야 한다", async () => {
    const mockEdges = [
      {
        sourceId: sourceSubmissionId,
        targetId,
        fieldId: "f_rel",
        createdAt: new Date(),
      },
    ];

    const mockSubmissions = [
      {
        id: sourceSubmissionId,
        formId: sourceFormId,
        data: { cost: 50000, desc: "식대" },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    const mockForms = [
      {
        id: sourceFormId,
        title: "비용 청구서",
        schemaDefinition: { fields: [] },
      },
    ];

    // Phase 1: edges 조회
    mockWhere.mockResolvedValueOnce(mockEdges);
    // Phase 2: sourceSubmissions 조회
    mockWhere.mockResolvedValueOnce(mockSubmissions);
    // Phase 2: sourceForms 조회
    mockWhere.mockResolvedValueOnce(mockForms);

    const req = new NextRequest(`http://localhost/api/v1/relations?targetId=${targetId}`);
    const response = await GET(req, {});

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: Array<{
        sourceForm: { id: string; title: string };
        submissions: Array<{ id: string }>;
      }>;
    };

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.sourceForm.title).toBe("비용 청구서");
    expect(body.data[0]?.submissions).toHaveLength(1);
    expect(body.data[0]?.submissions[0]?.id).toBe(sourceSubmissionId);
  });
});
