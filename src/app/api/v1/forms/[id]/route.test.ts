import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "./route";

/**
 * 데이터베이스 I/O 경계 모킹 (@/shared/db)
 */
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLimit = vi.fn();

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/shared/db", () => ({
  db: {
    select: () => mockSelect(),
    update: (table: unknown) => mockUpdate(table),
  },
}));

describe("Route Handler: /api/v1/forms/[id]", () => {
  const formId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeEach(() => {
    vi.clearAllMocks();

    // Drizzle 체이닝 기본 모킹 설정
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe("GET /api/v1/forms/[id] (폼 단건 상세 조회)", () => {
    const sampleForm = {
      id: formId,
      slug: "daily-report",
      title: "일일 업무 보고",
      description: "업무 보고용 폼입니다.",
      schemaDefinition: { fields: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    it("유효한 UUID ID로 조회 시 200 OK와 함께 폼 데이터를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}`);
      const response = await GET(request, {
        params: Promise.resolve({ id: formId }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe("daily-report");
    });

    it("유효한 slug로 조회 시 200 OK와 함께 폼 데이터를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);

      const request = new NextRequest("http://localhost:3000/api/v1/forms/daily-report");
      const response = await GET(request, {
        params: Promise.resolve({ id: "daily-report" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("일일 업무 보고");
    });

    it("존재하지 않거나 삭제된 폼 조회 시 404 Not Found를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const request = new NextRequest("http://localhost:3000/api/v1/forms/non-existent");
      const response = await GET(request, {
        params: Promise.resolve({ id: "non-existent" }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/forms/[id] (폼 정보 수정)", () => {
    it("유효한 수정 요청 시 200 OK와 함께 수정된 폼을 반환해야 한다", async () => {
      const updatedForm = {
        id: formId,
        slug: "daily-report",
        title: "수정된 일일 업무 보고",
        description: "수정된 설명",
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockReturning.mockResolvedValueOnce([updatedForm]);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "수정된 일일 업무 보고" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: formId }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data.title).toBe("수정된 일일 업무 보고");
    });

    it("존재하지 않거나 이미 삭제된 폼을 수정하려 하면 404 Not Found를 반환해야 한다", async () => {
      mockReturning.mockResolvedValueOnce([]); // 일치하는 레코드 없음

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "수정 시도" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: formId }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /api/v1/forms/[id] (폼 소프트 삭제)", () => {
    it("소프트 삭제 성공 시 deletedAt이 기록된 폼을 200 OK와 함께 반환해야 한다", async () => {
      const deletedForm = {
        id: formId,
        slug: "daily-report",
        title: "삭제 대상 폼",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      mockReturning.mockResolvedValueOnce([deletedForm]);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}`, {
        method: "DELETE",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: formId }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data.id).toBe(formId);
      expect(json.data.deletedAt).not.toBeNull();
    });

    it("존재하지 않거나 이미 삭제된 폼을 삭제하려 하면 404 Not Found를 반환해야 한다", async () => {
      mockReturning.mockResolvedValueOnce([]); // 대상 없음

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}`, {
        method: "DELETE",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: formId }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });
});
