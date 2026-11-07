import { describe, expect, it, vi } from "vitest";
import { createNavigatorTools } from "./navigator-tools";
import { type CoreFormField, type Form, type InsertForm, type UpdateForm } from "@/entities/form";

describe("Navigator Tools Catalog (features/execute-navigator-action)", () => {
  const mockForm: Form = {
    id: "form-1",
    slug: "customer-feedback",
    title: "고객 피드백 설문",
    description: "고객 의견 수렴 폼",
    schemaDefinition: {
      fields: [
        {
          id: "field-1",
          name: "customerName",
          label: "고객명",
          type: "text",
          required: true,
        },
      ],
    },
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    publishedAt: null,
    deletedAt: null,
  };

  const mockDeps = {
    findActiveForms: vi.fn(async (): Promise<Form[]> => [mockForm]),
    findFormBySlug: vi.fn(async (slug: string): Promise<Form | undefined> =>
      slug === mockForm.slug ? mockForm : undefined
    ),
    insertForm: vi.fn(async (input: InsertForm): Promise<Form> => ({
      id: "new-form-id",
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      schemaDefinition: input.schemaDefinition ?? { fields: [] },
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      publishedAt: null,
      deletedAt: null,
    })),
    updateFormById: vi.fn(async (id: string, updates: UpdateForm): Promise<Form> => ({
      ...mockForm,
      ...updates,
      id,
      slug: updates.slug ?? mockForm.slug,
      title: updates.title ?? mockForm.title,
      description: updates.description ?? mockForm.description,
      schemaDefinition: updates.schemaDefinition ?? mockForm.schemaDefinition,
      createdAt: mockForm.createdAt,
      updatedAt: new Date("2026-01-01"),
      publishedAt: updates.publishedAt !== undefined ? updates.publishedAt : mockForm.publishedAt,
      deletedAt: mockForm.deletedAt,
    })),
    softDeleteFormById: vi.fn(async (id: string): Promise<Form | undefined> => ({
      ...mockForm,
      id,
      deletedAt: new Date(),
    })),
    softDeleteFormsBySlugs: vi.fn(async (slugs: string[]): Promise<Form[]> =>
      slugs.map((slug) => ({ ...mockForm, slug, deletedAt: new Date() }))
    ),
  };

  const defaultExecutionOptions = {
    toolCallId: "call-test",
    messages: [],
    context: {},
  };

  it("핵심 도구(navigate, createForm, updateSchema, listForms, deleteForm, deleteForms, publishForm)가 정의되어 있어야 한다", () => {
    const tools = createNavigatorTools(mockDeps);

    expect(tools.navigate).toBeDefined();
    expect(tools.createForm).toBeDefined();
    expect(tools.updateSchema).toBeDefined();
    expect(tools.listForms).toBeDefined();
    expect(tools.deleteForm).toBeDefined();
    expect(tools.deleteForms).toBeDefined();
    expect(tools.publishForm).toBeDefined();
  });

  describe("navigate 도구", () => {
    it("targetPath를 전달받아 라우팅 이동 결과를 반환해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = await tools.navigate.execute!(
        { targetPath: "/builder/forms" },
        defaultExecutionOptions
      );

      expect(result).toEqual({
        success: true,
        targetPath: "/builder/forms",
      });
    });
  });

  describe("listForms 도구", () => {
    it("등록된 폼 목록을 조회하여 간략한 요약 목록을 반환해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = (await tools.listForms.execute!({}, defaultExecutionOptions)) as {
        success: boolean;
        forms: Array<{ slug: string; title: string; fieldCount: number }>;
      };

      expect(mockDeps.findActiveForms).toHaveBeenCalled();
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0]).toEqual({
        slug: "customer-feedback",
        title: "고객 피드백 설문",
        fieldCount: 1,
      });
    });
  });

  describe("createForm 도구", () => {
    it("새로운 폼을 생성하고 sanitized 슬러그로 DB에 저장해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const newField: CoreFormField = {
        id: "f1",
        name: "email",
        label: "이메일",
        type: "text",
        required: true,
      };

      const result = await tools.createForm.execute!(
        {
          slug: "user-survey",
          title: "사용자 설문",
          description: "간단 설문",
          fields: [newField],
        },
        defaultExecutionOptions
      );

      expect(mockDeps.insertForm).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "user-survey",
          title: "사용자 설문",
          schemaDefinition: { fields: [newField] },
        })
      );
      expect(result).toEqual({
        success: true,
        slug: "user-survey",
        title: "사용자 설문",
        fieldCount: 1,
      });
    });
  });

  describe("updateSchema 도구", () => {
    it("ADD_FIELD 작업 시 기존 폼에 새 필드를 추가하여 DB를 갱신해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const addedField: CoreFormField = {
        id: "f2",
        name: "phone",
        label: "연락처",
        type: "text",
        required: false,
      };

      const result = (await tools.updateSchema.execute!(
        {
          formSlug: "customer-feedback",
          operation: "ADD_FIELD",
          fieldData: addedField,
        },
        defaultExecutionOptions
      )) as {
        success: boolean;
        operation: string;
      };

      expect(mockDeps.findFormBySlug).toHaveBeenCalledWith("customer-feedback");
      expect(mockDeps.updateFormById).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({
          schemaDefinition: {
            fields: expect.arrayContaining([expect.objectContaining({ name: "phone" })]),
          },
        })
      );
      expect(result.success).toBe(true);
      expect(result.operation).toBe("ADD_FIELD");
    });

    it("존재하지 않는 폼 슬러그 수정 요청 시 실패 결과를 안전하게 반환해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = (await tools.updateSchema.execute!(
        {
          formSlug: "non-existent-slug",
          operation: "ADD_FIELD",
        },
        defaultExecutionOptions
      )) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("폼을 찾을 수 없습니다");
    });
  });

  describe("deleteForm 도구", () => {
    it("기존 폼 슬러그로 소프트 삭제를 실행하고 결과를 반환해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = (await tools.deleteForm.execute!(
        { formSlug: "customer-feedback" },
        defaultExecutionOptions
      )) as {
        success: boolean;
        formSlug: string;
        title: string;
      };

      expect(mockDeps.findFormBySlug).toHaveBeenCalledWith("customer-feedback");
      expect(mockDeps.softDeleteFormById).toHaveBeenCalledWith("form-1");
      expect(result).toEqual({
        success: true,
        formSlug: "customer-feedback",
        title: "고객 피드백 설문",
      });
    });
  });

  describe("deleteForms 도구 (일괄 배치 삭제)", () => {
    it("여러 폼 슬러그를 한 번에 전달하여 일괄 소프트 삭제를 실행해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = (await tools.deleteForms.execute!(
        { formSlugs: ["form-a", "form-b"] },
        defaultExecutionOptions
      )) as {
        success: boolean;
        deletedCount: number;
        deletedSlugs: string[];
      };

      expect(mockDeps.softDeleteFormsBySlugs).toHaveBeenCalledWith(["form-a", "form-b"]);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.deletedSlugs).toEqual(["form-a", "form-b"]);
    });
  });

  describe("publishForm 도구 (발행/초안 제어)", () => {
    it("isPublished: true 전달 시 publishedAt을 현재 일시로 갱신해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = (await tools.publishForm.execute!(
        { formSlug: "customer-feedback", isPublished: true },
        defaultExecutionOptions
      )) as {
        success: boolean;
        formSlug: string;
        isPublished: boolean;
      };

      expect(mockDeps.findFormBySlug).toHaveBeenCalledWith("customer-feedback");
      expect(mockDeps.updateFormById).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({
          publishedAt: expect.any(Date),
        })
      );
      expect(result.success).toBe(true);
      expect(result.isPublished).toBe(true);
    });

    it("isPublished: false 전달 시 publishedAt을 null로 갱신하여 초안 상태로 되돌려야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const result = (await tools.publishForm.execute!(
        { formSlug: "customer-feedback", isPublished: false },
        defaultExecutionOptions
      )) as {
        success: boolean;
        isPublished: boolean;
      };

      expect(mockDeps.updateFormById).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({
          publishedAt: null,
        })
      );
      expect(result.isPublished).toBe(false);
    });
  });

  describe("updateSchema 도구 - SET_ALL_FIELDS (선언적 전체 교체)", () => {
    it("새 필드 목록을 전달하면 누락된 기존 필드는 deletedAt을 부여하여 소프트 삭제 보존해야 한다", async () => {
      const tools = createNavigatorTools(mockDeps);
      const newFields = [
        {
          id: "field-deadline",
          name: "deadline",
          label: "마감일",
          type: "text" as const,
          required: false,
        },
      ];

      const result = (await tools.updateSchema.execute!(
        {
          formSlug: "customer-feedback",
          operation: "SET_ALL_FIELDS",
          fields: newFields,
        },
        defaultExecutionOptions
      )) as {
        success: boolean;
        fieldCount: number;
      };

      expect(mockDeps.updateFormById).toHaveBeenCalledWith(
        "form-1",
        expect.objectContaining({
          schemaDefinition: {
            fields: expect.arrayContaining([
              expect.objectContaining({ id: "field-deadline" }),
              expect.objectContaining({ id: "field-1", deletedAt: expect.any(String) }),
            ]),
          },
        })
      );
      expect(result.success).toBe(true);
      expect(result.fieldCount).toBe(1); // 활성 필드 수는 1개
    });
  });
});
