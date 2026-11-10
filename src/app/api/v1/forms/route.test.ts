import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

/**
 * 데이터베이스 I/O 경계 모킹 (@/shared/db)
 * 실제 Supabase 네트워크 호출 없이 핸들러의 비즈니스 오케스트레이션 로직을 격리 검증합니다.
 */
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/shared/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db/server")>();
  return {
    ...actual,
    db: {
      select: () => mockSelect(),
      insert: (table: unknown) => mockInsert(table),
    },
  };
});

describe("Route Handler: /api/v1/forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Drizzle 체이닝 기본 모킹 설정 (select().from().where().orderBy())
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });

    // Drizzle 체이닝 기본 모킹 설정 (insert().values().returning())
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
  });

  describe("GET /api/v1/forms (폼 목록 조회)", () => {
    it("폼 목록을 성공적으로 조회하여 200 OK와 함께 반환해야 한다", async () => {
      const mockForms = [
        {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          title: "일일 업무 보고",
          description: "일일 업무를 기록하는 폼",
          schemaDefinition: { fields: [] },
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ];

      mockOrderBy.mockResolvedValueOnce(mockForms);

      const request = new NextRequest("http://localhost:3000/api/v1/forms");
      const response = await GET(request, {});

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    });

    it("published=true 쿼리 파라미터 전달 시 발행된 폼 목록을 필터링하여 반환해야 한다", async () => {
      const mockPublishedForms = [
        {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          title: "고객 피드백 설문",
          description: "발행된 설문",
          schemaDefinition: { fields: [] },
          publishedAt: new Date("2026-01-02T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      ];

      mockOrderBy.mockResolvedValueOnce(mockPublishedForms);

      const request = new NextRequest("http://localhost:3000/api/v1/forms?published=true");
      const response = await GET(request, {});

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("고객 피드백 설문");
    });
  });

  describe("POST /api/v1/forms (신규 폼 등록)", () => {
    it("유효한 폼 스키마 요청 시 201 Created와 함께 생성된 폼 데이터를 반환해야 한다", async () => {
      const validPayload = {
        title: "고객 만족도 조사",
        description: "고객 피드백 수집 목적",
        schemaDefinition: {
          fields: [
            {
              id: "q1",
              type: "text",
              label: "만족도 의견",
              required: true,
            },
          ],
        },
      };

      const createdForm = {
        id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        ...validPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValueOnce([createdForm]);

      const request = new NextRequest("http://localhost:3000/api/v1/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request, {});

      expect(response.status).toBe(201);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data.id).toBe("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");
      expect(json.data.title).toBe("고객 만족도 조사");
    });

    it("유효하지 않은 요청 본문(title 누락 등)인 경우 400 Bad Request를 반환해야 한다", async () => {
      const invalidPayload = {
        title: "",
        schemaDefinition: {},
      };

      const request = new NextRequest("http://localhost:3000/api/v1/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request, {});

      expect(response.status).toBe(400);
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BAD_REQUEST");
    });
  });
});
