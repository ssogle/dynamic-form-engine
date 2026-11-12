import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

// Drizzle 서버 모킹
const mockFindFormById = vi.fn();
const mockFindSubmissionsPaginated = vi.fn();
const mockInsertSubmission = vi.fn();

vi.mock("@/entities/form/server", () => ({
  findFormById: (id: string) => mockFindFormById(id),
}));

vi.mock("@/entities/form-submission/server", () => ({
  findSubmissionsPaginated: (formId: string, options: unknown) =>
    mockFindSubmissionsPaginated(formId, options),
  insertSubmission: (data: unknown) => mockInsertSubmission(data),
}));

describe("Route Handler: /api/v1/forms/[id]/submissions", () => {
  const formId = "00000000-0000-0000-0000-000000000001";
  const mockContext = {
    params: Promise.resolve({ id: formId }),
  };

  const mockForm = {
    id: formId,
    title: "개발자 채용 지원서",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    schemaDefinition: {
      fields: [
        {
          id: "applicantName",
          label: "지원자 이름",
          type: "text",
          required: true,
          description: "지원자의 성명을 입력합니다.",
        },
        {
          id: "yearsOfExperience",
          label: "경력 연수",
          type: "number",
          required: true,
          description: "관련 실무 경력 연차를 입력합니다.",
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFormById.mockResolvedValue(mockForm);
  });

  describe("GET /api/v1/forms/[id]/submissions (응답 목록 조회)", () => {
    it("존재하지 않는 폼 ID로 조회 시 404 Not Found를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(undefined);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/submissions`);
      const response = await GET(request, mockContext);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("폼이 존재하는 경우 해당 폼의 페이지네이션 응답과 함께 200 OK를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(mockForm);
      const mockPaginatedResult = {
        items: [
          {
            id: "sub-1",
            formId,
            data: { applicantName: "홍길동", yearsOfExperience: 5 },
            createdAt: new Date("2026-01-02T00:00:00Z"),
          },
        ],
        page: 1,
        limit: 20,
        totalCount: 1,
        totalPages: 1,
        hasMore: false,
      };
      mockFindSubmissionsPaginated.mockResolvedValueOnce(mockPaginatedResult);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions?page=1&limit=20&sort=f_exp:desc&filters={"f_applicant":"홍길동"}`
      );
      const response = await GET(request, mockContext);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].id).toBe("sub-1");
      expect(json.data.page).toBe(1);
      expect(json.data.totalCount).toBe(1);
      expect(mockFindSubmissionsPaginated).toHaveBeenCalledWith(formId, {
        page: 1,
        limit: 20,
        sort: "f_exp:desc",
        filters: '{"f_applicant":"홍길동"}',
      });
    });

    it("ids 쿼리 파라미터가 전달되면 findSubmissionsPaginated에 ids 필터 옵션을 전달해야 한다", async () => {
      const targetSubId1 = "11111111-1111-4111-a111-111111111111";
      const targetSubId2 = "22222222-2222-4222-a222-222222222222";
      mockFindFormById.mockResolvedValueOnce(mockForm);
      mockFindSubmissionsPaginated.mockResolvedValueOnce({
        items: [
          {
            id: targetSubId1,
            formId,
            data: { applicantName: "김철수" },
            createdAt: new Date("2026-01-02T00:00:00Z"),
          },
        ],
        page: 1,
        limit: 20,
        totalCount: 1,
        totalPages: 1,
        hasMore: false,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions?ids=${targetSubId1},${targetSubId2}`
      );
      const response = await GET(request, mockContext);

      expect(response.status).toBe(200);
      expect(mockFindSubmissionsPaginated).toHaveBeenCalledWith(formId, {
        page: 1,
        limit: 20,
        sort: "createdAt:desc",
        ids: `${targetSubId1},${targetSubId2}`,
      });
    });

    it("유효하지 않은 쿼리 파라미터가 들어온 경우 400 Bad Request를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(mockForm);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions?page=0`
      );
      const response = await GET(request, mockContext);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("POST /api/v1/forms/[id]/submissions (신규 응답 제출)", () => {
    it("존재하지 않는 폼 ID인 경우 404 Not Found를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(undefined);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { applicantName: "홍길동" } }),
      });
      const response = await POST(request, mockContext);

      expect(response.status).toBe(404);
    });

    it("아직 발행되지 않은(publishedAt IS NULL) 폼인 경우 400 Bad Request를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce({
        ...mockForm,
        publishedAt: null,
      });

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { applicantName: "홍길동", yearsOfExperience: 3 } }),
      });
      const response = await POST(request, mockContext);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.message).toContain("발행되지 않은 폼");
    });

    it("필수 입력 필드가 누락된 경우 400 Bad Request와 세부 필드 에러를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(mockForm);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { applicantName: "" } }),
      });
      const response = await POST(request, mockContext);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.details).toBeDefined();
      expect(json.error.details.applicantName).toContain("필수 입력");
    });

    it("유효한 데이터 제출 시 201 Created와 함께 생성된 응답 데이터를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(mockForm);
      const createdRecord = {
        id: "sub-100",
        formId,
        data: { applicantName: "이순신", yearsOfExperience: 10 },
        createdAt: new Date("2026-01-03T00:00:00Z"),
      };
      mockInsertSubmission.mockResolvedValueOnce(createdRecord);

      const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { applicantName: "이순신", yearsOfExperience: "10" },
        }),
      });
      const response = await POST(request, mockContext);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("sub-100");
      expect(mockInsertSubmission).toHaveBeenCalledWith({
        formId,
        data: { applicantName: "이순신", yearsOfExperience: 10 },
      });
    });
  });
});
