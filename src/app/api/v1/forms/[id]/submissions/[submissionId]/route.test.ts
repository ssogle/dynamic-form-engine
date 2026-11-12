import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "./route";

// Drizzle 서버 모킹
const mockFindFormById = vi.fn();
const mockFindSubmissionById = vi.fn();
const mockUpdateSubmissionById = vi.fn();
const mockSoftDeleteSubmissionById = vi.fn();

vi.mock("@/entities/form/server", () => ({
  findFormById: (id: string) => mockFindFormById(id),
}));

vi.mock("@/entities/form-submission/server", () => ({
  findSubmissionById: (id: string) => mockFindSubmissionById(id),
  updateSubmissionById: (id: string, data: unknown) => mockUpdateSubmissionById(id, data),
  softDeleteSubmissionById: (id: string) => mockSoftDeleteSubmissionById(id),
}));

describe("Route Handler: /api/v1/forms/[id]/submissions/[submissionId]", () => {
  const formId = "00000000-0000-0000-0000-000000000001";
  const submissionId = "sub-uuid-1234";
  const mockContext = {
    params: Promise.resolve({ id: formId, submissionId }),
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

  const mockSubmission = {
    id: submissionId,
    formId,
    data: { applicantName: "홍길동", yearsOfExperience: 3 },
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFormById.mockResolvedValue(mockForm);
  });

  describe("GET /api/v1/forms/[id]/submissions/[submissionId] (단건 응답 조회)", () => {
    it("존재하지 않는 응답 ID인 경우 404 Not Found를 반환해야 한다", async () => {
      mockFindSubmissionById.mockResolvedValueOnce(undefined);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`
      );
      const response = await GET(request, mockContext);

      expect(response.status).toBe(404);
    });

    it("응답의 formId가 경로의 id와 일치하지 않는 경우 404 Not Found를 반환해야 한다", async () => {
      mockFindSubmissionById.mockResolvedValueOnce({
        ...mockSubmission,
        formId: "other-form-id",
      });

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`
      );
      const response = await GET(request, mockContext);

      expect(response.status).toBe(404);
    });

    it("유효한 응답인 경우 200 OK와 함께 응답 데이터를 반환해야 한다", async () => {
      mockFindSubmissionById.mockResolvedValueOnce(mockSubmission);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`
      );
      const response = await GET(request, mockContext);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(submissionId);
    });
  });

  describe("PATCH /api/v1/forms/[id]/submissions/[submissionId] (응답 수정)", () => {
    it("수정 데이터 유효성 검사 실패 시 400 Bad Request를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(mockForm);
      mockFindSubmissionById.mockResolvedValueOnce(mockSubmission);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { applicantName: "" } }),
        }
      );
      const response = await PATCH(request, mockContext);

      expect(response.status).toBe(400);
    });

    it("유효한 데이터로 수정 시 200 OK와 함께 수정된 응답 데이터를 반환해야 한다", async () => {
      mockFindFormById.mockResolvedValueOnce(mockForm);
      mockFindSubmissionById.mockResolvedValueOnce(mockSubmission);

      const updatedRecord = {
        ...mockSubmission,
        data: { applicantName: "홍길동", yearsOfExperience: 5 },
        updatedAt: new Date("2026-01-05T00:00:00Z"),
      };
      mockUpdateSubmissionById.mockResolvedValueOnce(updatedRecord);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: { applicantName: "홍길동", yearsOfExperience: 5 },
          }),
        }
      );
      const response = await PATCH(request, mockContext);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.data.yearsOfExperience).toBe(5);
    });
  });

  describe("DELETE /api/v1/forms/[id]/submissions/[submissionId] (응답 소프트 삭제)", () => {
    it("존재하지 않는 응답인 경우 404 Not Found를 반환해야 한다", async () => {
      mockFindSubmissionById.mockResolvedValueOnce(undefined);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`,
        { method: "DELETE" }
      );
      const response = await DELETE(request, mockContext);

      expect(response.status).toBe(404);
    });

    it("정상적으로 소프트 삭제된 경우 200 OK를 반환해야 한다", async () => {
      mockFindSubmissionById.mockResolvedValueOnce(mockSubmission);
      const deletedRecord = {
        ...mockSubmission,
        deletedAt: new Date("2026-01-06T00:00:00Z"),
      };
      mockSoftDeleteSubmissionById.mockResolvedValueOnce(deletedRecord);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/forms/${formId}/submissions/${submissionId}`,
        { method: "DELETE" }
      );
      const response = await DELETE(request, mockContext);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(mockSoftDeleteSubmissionById).toHaveBeenCalledWith(submissionId);
    });
  });
});
