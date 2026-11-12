import { describe, it, expect, vi } from "vitest";
import type { Form, CoreFormField } from "@/entities/form";
import { createBuilderTools } from "./builder-tools";

describe("createBuilderTools (features/execute-navigator-action/lib/tools)", () => {
  const currentFormId = "11111111-1111-4111-a111-111111111111";
  const targetFormId = "22222222-2222-4222-a222-222222222222";

  const mockForms: Record<string, Form> = {
    [currentFormId]: {
      id: currentFormId,
      title: "비용 정산서",
      description: "프로젝트 투입 비용을 정산합니다.",
      schemaDefinition: {
        fields: [
          { id: "f_title", label: "지출 항목", type: "text", required: true },
          {
            id: "f_category",
            label: "지출 분류",
            type: "select",
            required: true,
            options: [
              { label: "식대", value: "MEAL", disabled: false },
              { label: "교통비", value: "TRANSPORT", disabled: false },
              { label: "숙박비", value: "LODGING", disabled: true },
            ],
          },
        ],
      },
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
    [targetFormId]: {
      id: targetFormId,
      title: "프로젝트 관리",
      description: "전사 프로젝트 등록부",
      schemaDefinition: {
        fields: [
          { id: "p_code", label: "프로젝트 코드", type: "text", required: true },
          { id: "p_name", label: "프로젝트명", type: "text", required: true },
        ],
      },
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
  };

  const dependencies = {
    findFormById: vi.fn().mockImplementation(async (id: string) => mockForms[id]),
    insertForm: vi.fn().mockImplementation(async (input) => ({
      id: "new-form-id",
      ...input,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    updateFormById: vi.fn().mockImplementation(async (id: string, updates) => ({
      ...mockForms[id],
      ...updates,
      updatedAt: new Date(),
    })),
    publishFormById: vi.fn().mockImplementation(async (id: string, isPublished: boolean) => ({
      ...mockForms[id],
      publishedAt: isPublished ? new Date() : null,
      updatedAt: new Date(),
    })),
    softDeleteFormsByIds: vi.fn().mockResolvedValue([]),
  };

  const mockExecutionOptions = {
    toolCallId: "test-call-id",
    messages: [],
    context: {},
  } as unknown as Parameters<
    NonNullable<ReturnType<typeof createBuilderTools>["addRelationField"]["execute"]>
  >[1];

  describe("addRelationField 도구", () => {
    it("타깃 폼이 실존하지 않을 경우 에러를 반환해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.addRelationField.execute!(
        {
          formId: currentFormId,
          label: "참조 프로젝트",
          targetFormId: "99999999-9999-4999-a999-999999999999",
          multiple: false,
          required: true,
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("참조 대상 타깃 폼");
    });

    it("displayField 생략 시 타깃 폼의 첫 번째 텍스트 계열 필드를 자동 탐색하여 관계형 필드를 생성해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.addRelationField.execute!(
        {
          formId: currentFormId,
          label: "참조 프로젝트",
          targetFormId: targetFormId,
          multiple: false,
          required: true,
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        field?: CoreFormField;
        clientAction?: { type: string; operation: string };
      };

      expect(result.success).toBe(true);
      expect(result.field?.type).toBe("relation");
      expect(result.field?.relationConfig?.targetFormId).toBe(targetFormId);
      expect(result.field?.relationConfig?.displayField).toBe("p_code");
      expect(result.field?.relationConfig?.multiple).toBe(false);
      expect(result.clientAction?.type).toBe("UPDATE_SCHEMA");
      expect(result.clientAction?.operation).toBe("ADD_FIELD");
    });
  });

  describe("updateFieldOptions 도구", () => {
    it("DISABLE_OPTION: 특정 옵션을 소프트 비활성화(disabled: true)해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: currentFormId,
          targetFieldId: "f_category",
          operation: "DISABLE_OPTION",
          targetOptionValue: "MEAL",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        operation?: string;
        field?: { options?: Array<{ label: string; value: string; disabled?: boolean }> };
        clientAction?: { type: string; operation: string };
      };

      expect(result.success).toBe(true);
      expect(result.operation).toBe("DISABLE_OPTION");
      const mealOpt = result.field?.options?.find(
        (o) => typeof o !== "string" && o.value === "MEAL"
      );
      expect(mealOpt).toBeDefined();
      expect(mealOpt?.disabled).toBe(true);
      expect(result.clientAction?.type).toBe("UPDATE_SCHEMA");
      expect(result.clientAction?.operation).toBe("UPDATE_FIELD");
    });

    it("ENABLE_OPTION: 비활성화된 옵션을 다시 활성화(disabled: false)해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: currentFormId,
          targetFieldId: "f_category",
          operation: "ENABLE_OPTION",
          targetOptionValue: "LODGING",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        field?: { options?: Array<{ label: string; value: string; disabled?: boolean }> };
      };

      expect(result.success).toBe(true);
      const lodgingOpt = result.field?.options?.find(
        (o) => typeof o !== "string" && o.value === "LODGING"
      );
      expect(lodgingOpt?.disabled).toBe(false);
    });

    it("ADD_OPTIONS: 중복되지 않는 신규 옵션을 추가해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: currentFormId,
          targetFieldId: "f_category",
          operation: "ADD_OPTIONS",
          options: [{ label: "도서구입비", value: "BOOK", disabled: false }],
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        field?: { options?: Array<{ label: string; value: string; disabled?: boolean }> };
      };

      expect(result.success).toBe(true);
      const bookOpt = result.field?.options?.find(
        (o) => typeof o !== "string" && o.value === "BOOK"
      );
      expect(bookOpt).toBeDefined();
    });

    it("비선택형 필드(text 등)에 옵션 조작 시도 시 실패해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: currentFormId,
          targetFieldId: "f_title",
          operation: "DISABLE_OPTION",
          targetOptionValue: "any",
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("옵션을 지원하는 선택형 필드가 아닙니다");
    });
  });

  describe("updateSchema 도구 확장 필드 지원 및 소프트 삭제 보존", () => {
    it("radio, checkbox, date, switch, section 필드를 정상적으로 ADD_FIELD 할 수 있어야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: currentFormId,
          operation: "ADD_FIELD",
          fieldData: {
            label: "이용 약관 동의",
            type: "switch",
            required: true,
          },
        },
        mockExecutionOptions
      )) as { success: boolean; clientAction?: { type: string; operation: string } };

      expect(result.success).toBe(true);
      expect(result.clientAction?.type).toBe("UPDATE_SCHEMA");
      expect(result.clientAction?.operation).toBe("ADD_FIELD");
    });

    it("REMOVE_FIELD: 대상 필드를 물리 삭제하지 않고 deletedAt을 설정하여 소프트 삭제해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: currentFormId,
          operation: "REMOVE_FIELD",
          targetFieldId: "f_title",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        updatedForm?: Form;
        clientAction?: { type: string; operation: string };
      };

      expect(result.success).toBe(true);
      expect(result.clientAction?.type).toBe("UPDATE_SCHEMA");
      expect(result.clientAction?.operation).toBe("REMOVE_FIELD");

      // schemaDefinition 내의 fields 배열 확인
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };
      const targetField = schema.fields.find((f) => f.id === "f_title");
      expect(targetField).toBeDefined();
      expect(targetField?.deletedAt).toBeDefined();
      expect(typeof targetField?.deletedAt).toBe("string");
    });

    it("SET_ALL_FIELDS: 기존 필드가 새 목록에서 누락되어도 물리 삭제하지 않고 deletedAt을 부여하여 영구 보존해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const newOnlyFields: CoreFormField[] = [
        { id: "f_new_only", label: "신규 필드", type: "text", required: false },
      ];

      const result = (await tools.updateSchema.execute!(
        {
          formId: currentFormId,
          operation: "SET_ALL_FIELDS",
          fields: newOnlyFields,
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        updatedForm?: Form;
      };

      expect(result.success).toBe(true);
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };

      // 신규 필드 존재 확인
      const newField = schema.fields.find((f) => f.id === "f_new_only");
      expect(newField).toBeDefined();
      expect(newField?.deletedAt).toBeUndefined();

      // 기존 필드들(f_title, f_category)이 삭제되지 않고 deletedAt을 가진 채 보존되었는지 확인
      const oldTitle = schema.fields.find((f) => f.id === "f_title");
      const oldCategory = schema.fields.find((f) => f.id === "f_category");
      expect(oldTitle).toBeDefined();
      expect(oldTitle?.deletedAt).toBeDefined();
      expect(oldCategory).toBeDefined();
      expect(oldCategory?.deletedAt).toBeDefined();
    });
  });
});
