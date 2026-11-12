import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockFindFormById = vi.fn();
const mockPublishFormById = vi.fn();

vi.mock("@/entities/form/server", () => ({
  findFormById: (id: string) => mockFindFormById(id),
  publishFormById: (id: string, isPublished: boolean) => mockPublishFormById(id, isPublished),
}));

describe("Route Handler: POST /api/v1/forms/[id]/publish", () => {
  const formId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validContext = { params: Promise.resolve({ id: formId }) };

  const sampleActiveForm = {
    id: formId,
    title: "개발자 채용 지원서",
    description: "멋진 팀에 합류하세요.",
    schemaDefinition: {
      fields: [
        {
          id: "f1",
          type: "text",
          label: "이름",
          required: true,
          description: "지원자의 성명을 입력합니다.",
        },
      ],
    },
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("활성 필드가 있는 폼을 정상적으로 발행(isPublished: true)해야 한다", async () => {
    mockFindFormById.mockResolvedValueOnce(sampleActiveForm);
    const publishedForm = {
      ...sampleActiveForm,
      publishedAt: new Date("2026-11-10T09:30:00Z"),
    };
    mockPublishFormById.mockResolvedValueOnce(publishedForm);

    const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/publish`, {
      method: "POST",
      body: JSON.stringify({ isPublished: true }),
    });

    const response = await POST(request, validContext);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.publishedAt).toBeDefined();
    expect(mockPublishFormById).toHaveBeenCalledWith(formId, true);
  });

  it("요청 본문이 비어있으면 기본값(isPublished: true)으로 발행해야 한다", async () => {
    mockFindFormById.mockResolvedValueOnce(sampleActiveForm);
    const publishedForm = {
      ...sampleActiveForm,
      publishedAt: new Date("2026-11-10T09:30:00Z"),
    };
    mockPublishFormById.mockResolvedValueOnce(publishedForm);

    const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/publish`, {
      method: "POST",
    });

    const response = await POST(request, validContext);
    expect(response.status).toBe(200);
    expect(mockPublishFormById).toHaveBeenCalledWith(formId, true);
  });

  it("isPublished: false 전달 시 초안 상태로 회수해야 한다", async () => {
    mockFindFormById.mockResolvedValueOnce({
      ...sampleActiveForm,
      publishedAt: new Date("2026-11-10T09:30:00Z"),
    });
    mockPublishFormById.mockResolvedValueOnce({
      ...sampleActiveForm,
      publishedAt: null,
    });

    const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/publish`, {
      method: "POST",
      body: JSON.stringify({ isPublished: false }),
    });

    const response = await POST(request, validContext);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.publishedAt).toBeNull();
    expect(mockPublishFormById).toHaveBeenCalledWith(formId, false);
  });

  it("활성 필드가 없는 빈 폼을 발행하려 하면 400 Bad Request를 반환해야 한다", async () => {
    const emptyForm = {
      ...sampleActiveForm,
      schemaDefinition: { fields: [] },
    };
    mockFindFormById.mockResolvedValueOnce(emptyForm);

    const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/publish`, {
      method: "POST",
      body: JSON.stringify({ isPublished: true }),
    });

    const response = await POST(request, validContext);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain("최소 1개 이상의 필드");
    expect(mockPublishFormById).not.toHaveBeenCalled();
  });

  it("존재하지 않거나 삭제된 폼인 경우 404 Not Found를 반환해야 한다", async () => {
    mockFindFormById.mockResolvedValueOnce(undefined);

    const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/publish`, {
      method: "POST",
      body: JSON.stringify({ isPublished: true }),
    });

    const response = await POST(request, validContext);
    expect(response.status).toBe(404);
    expect(mockPublishFormById).not.toHaveBeenCalled();
  });

  it("유효하지 않은 JSON 본문이 전달되면 400 Bad Request를 반환해야 한다", async () => {
    const request = new NextRequest(`http://localhost:3000/api/v1/forms/${formId}/publish`, {
      method: "POST",
      body: "{ invalid json ...",
    });

    const response = await POST(request, validContext);
    expect(response.status).toBe(400);
  });
});
