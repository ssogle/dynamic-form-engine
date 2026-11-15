import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Form } from "@/entities/form";
import type { FormSubmission, PaginatedSubmissionsResponse } from "@/entities/form-submission";
import * as formServer from "@/entities/form/server";
import * as formSubmissionServer from "@/entities/form-submission/server";
import * as formsRouteModule from "./[[...route]]/route";
import { formsApp } from "./forms-app";

// 엔티티 서버 DB 함수들을 모킹하여 API 라우터, 미들웨어, 도메인 검증 계약을 순수하게 검증합니다.
vi.mock("@/entities/form/server", () => ({
  findActiveForms: vi.fn(),
  findPublishedForms: vi.fn(),
  findFormById: vi.fn(),
  insertForm: vi.fn(),
  updateFormById: vi.fn(),
  publishFormById: vi.fn(),
  softDeleteFormById: vi.fn(),
}));

vi.mock("@/entities/form-submission/server", () => ({
  findSubmissionsPaginated: vi.fn(),
  findSubmissionById: vi.fn(),
  insertSubmission: vi.fn(),
  updateSubmissionById: vi.fn(),
  softDeleteSubmissionById: vi.fn(),
}));

const VALID_FORM_ID = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_FORM_ID = "550e8400-e29b-41d4-a716-446655440099";
const VALID_SUBMISSION_ID = "660e8400-e29b-41d4-a716-446655440002";
const FIELD_ID = "770e8400-e29b-41d4-a716-446655440003";

const createMockForm = (overrides: Partial<Form> = {}): Form => ({
  id: VALID_FORM_ID,
  title: "고객 문의 설문",
  description: "문의 접수용 동적 폼",
  schemaDefinition: {
    primaryFieldId: FIELD_ID,
    fields: [
      {
        id: FIELD_ID,
        type: "text",
        label: "성함",
        description: "응답자 성함 입력 필드",
        required: true,
      },
    ],
  },
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

const createMockSubmission = (overrides: Partial<FormSubmission> = {}): FormSubmission => ({
  id: VALID_SUBMISSION_ID,
  formId: VALID_FORM_ID,
  data: { [FIELD_ID]: "홍길동" },
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

describe("formsApp (Hono Unified API Router)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/v1/forms", () => {
    it("returns active forms list by default", async () => {
      const mockForms = [createMockForm()];
      vi.mocked(formServer.findActiveForms).mockResolvedValue(mockForms);

      const res = await formsApp.request("/api/v1/forms");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { success: boolean; data: Array<{ id: string }> };
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0]?.id).toBe(VALID_FORM_ID);
      expect(formServer.findActiveForms).toHaveBeenCalledTimes(1);
      expect(formServer.findPublishedForms).not.toHaveBeenCalled();
    });

    it("returns only published forms when ?published=true is provided", async () => {
      const mockForms = [createMockForm()];
      vi.mocked(formServer.findPublishedForms).mockResolvedValue(mockForms);

      const res = await formsApp.request("/api/v1/forms?published=true");
      expect(res.status).toBe(200);

      expect(formServer.findPublishedForms).toHaveBeenCalledTimes(1);
      expect(formServer.findActiveForms).not.toHaveBeenCalled();
    });

    it("returns 500 INTERNAL_SERVER_ERROR JSON when DB query fails", async () => {
      vi.mocked(formServer.findActiveForms).mockRejectedValue(new Error("DB connection lost"));

      const res = await formsApp.request("/api/v1/forms");
      expect(res.status).toBe(500);

      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json).toEqual({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "DB connection lost",
        },
      });
    });
  });

  describe("POST /api/v1/forms", () => {
    const validPayload = {
      title: "신규 폼",
      description: "설명",
      schemaDefinition: {
        primaryFieldId: FIELD_ID,
        fields: [
          {
            id: FIELD_ID,
            type: "text",
            label: "이름",
            description: "사용자 이름 입력 필드",
            required: true,
          },
        ],
      },
    };

    it("creates a new form and returns 201 Created", async () => {
      const createdForm = createMockForm({ title: "신규 폼" });
      vi.mocked(formServer.insertForm).mockResolvedValue(createdForm);

      const res = await formsApp.request("/api/v1/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { success: boolean; data: { title: string } };
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("신규 폼");
      expect(formServer.insertForm).toHaveBeenCalledTimes(1);
    });

    it("strips system-managed fields before passing data to insertForm", async () => {
      const createdForm = createMockForm();
      vi.mocked(formServer.insertForm).mockResolvedValue(createdForm);

      await formsApp.request("/api/v1/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          id: OTHER_FORM_ID,
          publishedAt: "2020-01-01T00:00:00.000Z",
        }),
      });

      const insertedArg = vi.mocked(formServer.insertForm).mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(insertedArg).toBeDefined();
      expect(insertedArg.id).toBeUndefined();
      expect(insertedArg.publishedAt).toBeUndefined();
    });

    it("returns 400 BAD_REQUEST when schema validation fails", async () => {
      const res = await formsApp.request("/api/v1/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; details?: unknown };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BAD_REQUEST");
      expect(json.error.details).toBeDefined();
      expect(formServer.insertForm).not.toHaveBeenCalled();
    });

    it("returns 400 BAD_REQUEST on malformed JSON body", async () => {
      const res = await formsApp.request("/api/v1/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ malformed",
      });

      expect(res.status).toBe(400);
      expect(formServer.insertForm).not.toHaveBeenCalled();
    });
  });

  describe("GET / PATCH / DELETE /api/v1/forms/:id", () => {
    it("GET returns the form detail and queries findFormById exactly once", async () => {
      const form = createMockForm();
      vi.mocked(formServer.findFormById).mockResolvedValue(form);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { success: boolean; data: { id: string } };
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(VALID_FORM_ID);
      expect(formServer.findFormById).toHaveBeenCalledTimes(1);
      expect(formServer.findFormById).toHaveBeenCalledWith(VALID_FORM_ID);
    });

    it("returns 400 BAD_REQUEST on invalid UUID without hitting DB", async () => {
      const res = await formsApp.request("/api/v1/forms/invalid-uuid");
      expect(res.status).toBe(400);

      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.error.code).toBe("BAD_REQUEST");
      expect(formServer.findFormById).not.toHaveBeenCalled();
    });

    it("returns 404 NOT_FOUND when form does not exist", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(undefined);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}`);
      expect(res.status).toBe(404);

      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("PATCH partially updates an existing form and returns 200", async () => {
      const existing = createMockForm();
      const updated = createMockForm({ title: "수정된 제목" });
      vi.mocked(formServer.findFormById).mockResolvedValue(existing);
      vi.mocked(formServer.updateFormById).mockResolvedValue(updated);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "수정된 제목" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { title: string } };
      expect(json.data.title).toBe("수정된 제목");
      expect(formServer.updateFormById).toHaveBeenCalledWith(VALID_FORM_ID, {
        title: "수정된 제목",
      });
    });

    it("PATCH returns 400 BAD_REQUEST on malformed JSON body", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}`, {
        method: "PATCH",
        body: "{bad",
      });

      expect(res.status).toBe(400);
      expect(formServer.updateFormById).not.toHaveBeenCalled();
    });

    it("DELETE soft deletes an existing form and returns deleted form data", async () => {
      const existing = createMockForm();
      const deleted = createMockForm({ deletedAt: new Date("2026-01-03T00:00:00.000Z") });
      vi.mocked(formServer.findFormById).mockResolvedValue(existing);
      vi.mocked(formServer.softDeleteFormById).mockResolvedValue(deleted);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { id: string; deletedAt: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(VALID_FORM_ID);
      expect(json.data.deletedAt).toBeDefined();
      expect(formServer.softDeleteFormById).toHaveBeenCalledWith(VALID_FORM_ID);
    });
  });

  describe("POST /api/v1/forms/:id/publish", () => {
    it("publishes form when body is empty (defaults isPublished to true)", async () => {
      const draftForm = createMockForm({ publishedAt: null });
      const publishedForm = createMockForm();
      vi.mocked(formServer.findFormById).mockResolvedValue(draftForm);
      vi.mocked(formServer.publishFormById).mockResolvedValue(publishedForm);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/publish`, {
        method: "POST",
      });

      expect(res.status).toBe(200);
      expect(formServer.publishFormById).toHaveBeenCalledWith(VALID_FORM_ID, true);
    });

    it("unpublishes form even when no active fields remain", async () => {
      const formWithNoActiveFields = createMockForm({
        schemaDefinition: { primaryFieldId: FIELD_ID, fields: [] },
      });
      const unpublished = createMockForm({ publishedAt: null });
      vi.mocked(formServer.findFormById).mockResolvedValue(formWithNoActiveFields);
      vi.mocked(formServer.publishFormById).mockResolvedValue(unpublished);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: false }),
      });

      expect(res.status).toBe(200);
      expect(formServer.publishFormById).toHaveBeenCalledWith(VALID_FORM_ID, false);
    });

    it("returns 400 BAD_REQUEST when attempting to publish a form without active fields", async () => {
      const formWithDeletedFieldOnly = createMockForm({
        schemaDefinition: {
          primaryFieldId: FIELD_ID,
          fields: [
            {
              id: FIELD_ID,
              type: "text",
              label: "삭제된 필드",
              description: "소프트 삭제된 필드 설명",
              required: false,
              deletedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        },
      });
      vi.mocked(formServer.findFormById).mockResolvedValue(formWithDeletedFieldOnly);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });

      expect(res.status).toBe(400);
      expect(formServer.publishFormById).not.toHaveBeenCalled();
    });

    it("returns 400 BAD_REQUEST on malformed JSON or non-boolean isPublished", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());

      const badJsonRes = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/publish`, {
        method: "POST",
        body: "{bad",
      });
      expect(badJsonRes.status).toBe(400);

      const badTypeRes = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: "yes" }),
      });
      expect(badTypeRes.status).toBe(400);
      expect(formServer.publishFormById).not.toHaveBeenCalled();
    });
  });

  describe("GET / POST /api/v1/forms/:id/submissions", () => {
    it("GET validates query params and returns paginated submissions", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());
      const paginated: PaginatedSubmissionsResponse = {
        items: [createMockSubmission()],
        page: 2,
        limit: 10,
        totalCount: 15,
        totalPages: 2,
        hasMore: false,
      };
      vi.mocked(formSubmissionServer.findSubmissionsPaginated).mockResolvedValue(paginated);

      const res = await formsApp.request(
        `/api/v1/forms/${VALID_FORM_ID}/submissions?page=2&limit=10`
      );
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        success: boolean;
        data: PaginatedSubmissionsResponse;
      };
      expect(json.success).toBe(true);
      expect(json.data.page).toBe(2);
      expect(json.data.items).toHaveLength(1);
      expect(formSubmissionServer.findSubmissionsPaginated).toHaveBeenCalledWith(VALID_FORM_ID, {
        page: 2,
        limit: 10,
        sort: "createdAt:desc",
      });
    });

    it("GET returns 400 BAD_REQUEST for invalid query params", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/submissions?page=0`);
      expect(res.status).toBe(400);
      expect(formSubmissionServer.findSubmissionsPaginated).not.toHaveBeenCalled();
    });

    it("POST creates submission with dynamically validated and cleaned data (supports wrapped { data })", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());
      const created = createMockSubmission({ data: { [FIELD_ID]: "이순신" } });
      vi.mocked(formSubmissionServer.insertSubmission).mockResolvedValue(created);

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            [FIELD_ID]: "  이순신  ",
            unknownExtraField: "ignored",
          },
        }),
      });

      expect(res.status).toBe(201);
      expect(formSubmissionServer.insertSubmission).toHaveBeenCalledWith({
        formId: VALID_FORM_ID,
        data: { [FIELD_ID]: "이순신" },
      });
    });

    it("POST rejects submission to unpublished form with 400 BAD_REQUEST", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm({ publishedAt: null }));

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { [FIELD_ID]: "홍길동" } }),
      });

      expect(res.status).toBe(400);
      expect(formSubmissionServer.insertSubmission).not.toHaveBeenCalled();
    });

    it("POST returns 400 BAD_REQUEST when required field is missing", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());

      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; details?: Record<string, string> };
      };
      expect(json.error.code).toBe("BAD_REQUEST");
      expect(json.error.details?.[FIELD_ID]).toBeDefined();
      expect(formSubmissionServer.insertSubmission).not.toHaveBeenCalled();
    });
  });

  describe("GET / PATCH / DELETE /api/v1/forms/:id/submissions/:submissionId", () => {
    it("GET loads form and submission in parallel once each and returns submission detail", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());
      vi.mocked(formSubmissionServer.findSubmissionById).mockResolvedValue(createMockSubmission());

      const res = await formsApp.request(
        `/api/v1/forms/${VALID_FORM_ID}/submissions/${VALID_SUBMISSION_ID}`
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { id: string } };
      expect(json.data.id).toBe(VALID_SUBMISSION_ID);
      expect(formServer.findFormById).toHaveBeenCalledTimes(1);
      expect(formSubmissionServer.findSubmissionById).toHaveBeenCalledTimes(1);
    });

    it("returns 400 BAD_REQUEST when submissionId is invalid UUID without hitting DB", async () => {
      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/submissions/bad-sub-id`);

      expect(res.status).toBe(400);
      expect(formServer.findFormById).not.toHaveBeenCalled();
      expect(formSubmissionServer.findSubmissionById).not.toHaveBeenCalled();
    });

    it("returns 404 NOT_FOUND when submission belongs to a different form", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());
      vi.mocked(formSubmissionServer.findSubmissionById).mockResolvedValue(
        createMockSubmission({ formId: OTHER_FORM_ID })
      );

      const res = await formsApp.request(
        `/api/v1/forms/${VALID_FORM_ID}/submissions/${VALID_SUBMISSION_ID}`
      );

      expect(res.status).toBe(404);
    });

    it("PATCH validates and updates submission data", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());
      vi.mocked(formSubmissionServer.findSubmissionById).mockResolvedValue(createMockSubmission());
      vi.mocked(formSubmissionServer.updateSubmissionById).mockResolvedValue(
        createMockSubmission({ data: { [FIELD_ID]: "김유신" } })
      );

      const res = await formsApp.request(
        `/api/v1/forms/${VALID_FORM_ID}/submissions/${VALID_SUBMISSION_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [FIELD_ID]: "  김유신  ", extra: 1 } }),
        }
      );

      expect(res.status).toBe(200);
      expect(formSubmissionServer.updateSubmissionById).toHaveBeenCalledWith(VALID_SUBMISSION_ID, {
        data: { [FIELD_ID]: "김유신" },
      });
    });

    it("DELETE soft deletes submission and returns deleted submission data", async () => {
      vi.mocked(formServer.findFormById).mockResolvedValue(createMockForm());
      vi.mocked(formSubmissionServer.findSubmissionById).mockResolvedValue(createMockSubmission());
      vi.mocked(formSubmissionServer.softDeleteSubmissionById).mockResolvedValue(
        createMockSubmission({ deletedAt: new Date("2026-01-03T00:00:00.000Z") })
      );

      const res = await formsApp.request(
        `/api/v1/forms/${VALID_FORM_ID}/submissions/${VALID_SUBMISSION_ID}`,
        { method: "DELETE" }
      );

      expect(res.status).toBe(200);
      expect(formSubmissionServer.softDeleteSubmissionById).toHaveBeenCalledWith(
        VALID_SUBMISSION_ID
      );
    });
  });

  describe("Catch-All Route Handler & 404 Handling", () => {
    it("returns standard 404 NOT_FOUND JSON for unmatched nested routes", async () => {
      const res = await formsApp.request(`/api/v1/forms/${VALID_FORM_ID}/unknown/segment`);
      expect(res.status).toBe(404);

      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("exports only GET, POST, PATCH, DELETE from [[...route]]/route.ts and handles NextRequest", async () => {
      expect(typeof formsRouteModule.GET).toBe("function");
      expect(typeof formsRouteModule.POST).toBe("function");
      expect(typeof formsRouteModule.PATCH).toBe("function");
      expect(typeof formsRouteModule.DELETE).toBe("function");
      expect("PUT" in formsRouteModule).toBe(false);
      expect("OPTIONS" in formsRouteModule).toBe(false);

      vi.mocked(formServer.findActiveForms).mockResolvedValue([createMockForm()]);
      const req = new NextRequest("http://localhost:3000/api/v1/forms");
      const res = await formsRouteModule.GET(req);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: Array<{ id: string }> };
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });
  });
});
