import { describe, it, expect, vi } from "vitest";
import type { Form, CoreFormField } from "@/entities/form";
import {
  createBuilderTools,
  createFormInputSchema,
  updateSchemaInputSchema,
  addRelationFieldInputSchema,
  updateFieldOptionsInputSchema,
} from "./builder-tools";

describe("createBuilderTools (features/execute-navigator-action/lib/tools)", () => {
  const currentFormId = "11111111-1111-4111-a111-111111111111";
  const targetFormId = "22222222-2222-4222-a222-222222222222";
  const draftFormId = "33333333-3333-4333-a333-333333333333";
  const unpublishedWithSubsFormId = "44444444-4444-4444-a444-444444444444";

  const mockForms: Record<string, Form> = {
    [currentFormId]: {
      id: currentFormId,
      title: "비용 정산서",
      description: "프로젝트 투입 비용을 정산합니다.",
      schemaDefinition: {
        fields: [
          {
            id: "f_title",
            label: "지출 항목",
            type: "text",
            required: true,
            description: "정산할 지출 항목명을 입력합니다.",
          },
          {
            id: "f_category",
            label: "지출 분류",
            type: "select",
            required: true,
            description: "경비의 회계 분류를 선택합니다.",
            options: [
              {
                label: "식대",
                value: "MEAL",
                description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
                disabled: false,
              },
              {
                label: "교통비",
                value: "TRANSPORT",
                description: "외근 및 출장에 따른 대중교통/택시 이용 요금입니다.",
                disabled: false,
              },
              {
                label: "숙박비",
                value: "LODGING",
                description: "지방 출장 시 숙소 예약 비용입니다.",
                disabled: true,
              },
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
          {
            id: "p_code",
            label: "프로젝트 코드",
            type: "text",
            required: true,
            description: "사내 프로젝트 식별 코드를 입력합니다.",
          },
          {
            id: "p_name",
            label: "프로젝트명",
            type: "text",
            required: true,
            description: "프로젝트의 공식 명칭을 입력합니다.",
          },
        ],
      },
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
    [draftFormId]: {
      id: draftFormId,
      title: "신규 초안 설문",
      description: "아직 한 번도 발행되지 않은 초기 빌드 폼",
      schemaDefinition: {
        fields: [
          {
            id: "d_title",
            label: "제목",
            type: "text",
            required: true,
            description: "설문 응답의 대표 제목을 입력합니다.",
          },
          {
            id: "d_priority",
            label: "우선순위",
            type: "radio",
            required: true,
            description: "요청 처리의 긴급도 등급을 선택합니다.",
            options: [
              {
                label: "높음",
                value: "HIGH",
                description: "당일 내 즉각적인 처리가 필요한 최우선 요청입니다.",
                disabled: false,
              },
              {
                label: "보통",
                value: "MEDIUM",
                description: "일반적인 업무 일정 내에 처리하는 표준 요청입니다.",
                disabled: false,
              },
              {
                label: "낮음",
                value: "LOW",
                description: "긴급성이 낮아 후순위로 처리 가능한 요청입니다.",
                disabled: false,
              },
            ],
          },
        ],
      },
      publishedAt: null,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
    [unpublishedWithSubsFormId]: {
      id: unpublishedWithSubsFormId,
      title: "발행 취소된 응답 보유 폼",
      description: "발행 후 응답이 쌓인 상태에서 초안 회수된 폼",
      schemaDefinition: {
        fields: [
          {
            id: "u_title",
            label: "요청명",
            type: "text",
            required: true,
            description: "업무 요청의 제목을 입력합니다.",
          },
          {
            id: "u_status",
            label: "상태",
            type: "select",
            required: true,
            description: "요청의 현재 진행 상태를 선택합니다.",
            options: [
              {
                label: "대기",
                value: "PENDING",
                description: "담당자 배정 또는 검토가 아직 시작되지 않은 상태입니다.",
                disabled: false,
              },
              {
                label: "완료",
                value: "DONE",
                description: "모든 검토 및 처리 절차가 최종 종료된 상태입니다.",
                disabled: false,
              },
            ],
          },
        ],
      },
      publishedAt: null,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
  };

  const dependencies = {
    findFormById: vi.fn().mockImplementation(async (id: string) => mockForms[id]),
    hasSubmissionsByFormId: vi
      .fn()
      .mockImplementation(async (formId: string) => formId === unpublishedWithSubsFormId),
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
    it("addRelationFieldInputSchema는 description이 누락되거나 공백만 있으면 파싱에 실패해야 한다", () => {
      const missingDesc = addRelationFieldInputSchema.safeParse({
        formId: currentFormId,
        label: "참조 프로젝트",
        targetFormId: targetFormId,
        multiple: false,
        required: true,
      });
      const blankDesc = addRelationFieldInputSchema.safeParse({
        formId: currentFormId,
        label: "참조 프로젝트",
        description: "   ",
        targetFormId: targetFormId,
        multiple: false,
        required: true,
      });

      expect(missingDesc.success).toBe(false);
      expect(blankDesc.success).toBe(false);
    });

    it("타깃 폼이 실존하지 않을 경우 에러를 반환해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.addRelationField.execute!(
        {
          formId: currentFormId,
          label: "참조 프로젝트",
          description: "비용 정산이 귀속되는 대상 프로젝트를 연결합니다.",
          targetFormId: "99999999-9999-4999-a999-999999999999",
          multiple: false,
          required: true,
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("참조 대상 타깃 폼");
    });

    it("displayField 생략 시 타깃 폼의 첫 번째 텍스트 계열 필드를 자동 탐색하고 명시된 description으로 관계형 필드를 생성해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.addRelationField.execute!(
        {
          formId: currentFormId,
          label: "참조 프로젝트",
          description: "비용 정산이 귀속되는 대상 프로젝트를 연결합니다.",
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
      expect(result.field?.description).toBe("비용 정산이 귀속되는 대상 프로젝트를 연결합니다.");
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
          options: [
            {
              label: "도서구입비",
              value: "BOOK",
              description: "직무 역량 개발을 위한 기술 서적 구입 비용입니다.",
              disabled: false,
            },
          ],
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
    it("radio, checkbox, date, switch 필드를 정상적으로 ADD_FIELD 할 수 있어야 하며 section 타입은 거부해야 한다", async () => {
      const invalidSection = updateSchemaInputSchema.safeParse({
        formId: currentFormId,
        operation: "ADD_FIELD",
        fieldData: {
          label: "구획",
          type: "section",
          description: "구획선",
        },
      });
      expect(invalidSection.success).toBe(false);

      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: currentFormId,
          operation: "ADD_FIELD",
          fieldData: {
            label: "이용 약관 동의",
            type: "switch",
            required: true,
            description: "서비스 이용 약관 동의 여부를 선택합니다.",
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
        {
          id: "f_new_only",
          label: "신규 필드",
          type: "text",
          required: false,
          description: "새로 추가된 단일 텍스트 필드입니다.",
        },
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

    it("발행된 폼(currentFormId)에서 MODIFY_FIELD로 options 수정 시 누락된 기존 옵션은 disabled: true로 보존되어야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: currentFormId,
          operation: "MODIFY_FIELD",
          targetFieldId: "f_category",
          fieldData: {
            options: [
              {
                label: "식대",
                value: "MEAL",
                description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
                disabled: false,
              },
              {
                label: "도서비",
                value: "BOOK",
                description: "직무 관련 서적 구매 지출 시 선택합니다.",
                disabled: false,
              },
            ],
          },
        },
        mockExecutionOptions
      )) as { success: boolean; updatedForm?: Form };

      expect(result.success).toBe(true);
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };
      const categoryField = schema.fields.find((f) => f.id === "f_category");

      expect(categoryField?.options).toEqual(
        expect.arrayContaining([
          {
            label: "식대",
            value: "MEAL",
            description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
            disabled: false,
          },
          {
            label: "도서비",
            value: "BOOK",
            description: "직무 관련 서적 구매 지출 시 선택합니다.",
            disabled: false,
          },
          {
            label: "교통비",
            value: "TRANSPORT",
            description: "외근 및 출장에 따른 대중교통/택시 이용 요금입니다.",
            disabled: true,
          },
          {
            label: "숙박비",
            value: "LODGING",
            description: "지방 출장 시 숙소 예약 비용입니다.",
            disabled: true,
          },
        ])
      );
    });

    it("발행된 폼(currentFormId)에서 SET_ALL_FIELDS로 선택형 필드의 options 축소 전달 시 누락된 기존 옵션은 disabled: true로 보존되어야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: currentFormId,
          operation: "SET_ALL_FIELDS",
          fields: [
            {
              id: "f_title",
              label: "지출 항목",
              type: "text",
              required: true,
              description: "정산할 지출 항목명을 입력합니다.",
            },
            {
              id: "f_category",
              label: "지출 분류",
              type: "select",
              required: true,
              description: "경비의 회계 분류를 선택합니다.",
              options: [
                {
                  label: "식대",
                  value: "MEAL",
                  description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
                  disabled: false,
                },
              ],
            },
          ],
        },
        mockExecutionOptions
      )) as { success: boolean; updatedForm?: Form };

      expect(result.success).toBe(true);
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };
      const categoryField = schema.fields.find((f) => f.id === "f_category");

      expect(categoryField?.options).toEqual(
        expect.arrayContaining([
          {
            label: "식대",
            value: "MEAL",
            description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
            disabled: false,
          },
          {
            label: "교통비",
            value: "TRANSPORT",
            description: "외근 및 출장에 따른 대중교통/택시 이용 요금입니다.",
            disabled: true,
          },
          {
            label: "숙박비",
            value: "LODGING",
            description: "지방 출장 시 숙소 예약 비용입니다.",
            disabled: true,
          },
        ])
      );
    });

    it("미발행 초안 폼(draftFormId, 응답 0건)에서 REMOVE_FIELD 실행 시 필드를 물리 삭제해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: draftFormId,
          operation: "REMOVE_FIELD",
          targetFieldId: "d_title",
        },
        mockExecutionOptions
      )) as { success: boolean; updatedForm?: Form };

      expect(result.success).toBe(true);
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };
      expect(schema.fields.find((f) => f.id === "d_title")).toBeUndefined();
      expect(schema.fields).toHaveLength(1);
    });

    it("미발행 초안 폼(draftFormId, 응답 0건)에서 SET_ALL_FIELDS 실행 시 누락된 기존 필드를 물리 삭제해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: draftFormId,
          operation: "SET_ALL_FIELDS",
          fields: [
            {
              id: "d_new",
              label: "새 필드",
              type: "text",
              required: false,
              description: "초안 폼의 신규 텍스트 필드입니다.",
            },
          ],
        },
        mockExecutionOptions
      )) as { success: boolean; updatedForm?: Form };

      expect(result.success).toBe(true);
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };
      expect(schema.fields).toHaveLength(1);
      expect(schema.fields[0]?.id).toBe("d_new");
    });

    it("발행 취소되었더라도 기제출 응답이 존재하는 폼(unpublishedWithSubsFormId)에서는 REMOVE_FIELD 시 소프트 삭제(deletedAt)로 보존해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateSchema.execute!(
        {
          formId: unpublishedWithSubsFormId,
          operation: "REMOVE_FIELD",
          targetFieldId: "u_title",
        },
        mockExecutionOptions
      )) as { success: boolean; updatedForm?: Form };

      expect(result.success).toBe(true);
      const schema = result.updatedForm?.schemaDefinition as { fields: CoreFormField[] };
      const removedField = schema.fields.find((f) => f.id === "u_title");
      expect(removedField).toBeDefined();
      expect(removedField?.deletedAt).toBeDefined();
    });
  });

  describe("발행 전/후 옵션 삭제 보호 및 스키마 단일화 검증", () => {
    it("createFormInputSchema 및 updateSchemaInputSchema는 options에 문자열 배열이 들어오면 거부하고 SelectOption[]만 허용해야 한다", () => {
      const invalidCreate = createFormInputSchema.safeParse({
        title: "테스트 폼",
        fields: [
          {
            id: "f_1",
            label: "분류",
            type: "select",
            description: "항목 분류를 선택합니다.",
            options: ["A", "B"],
          },
        ],
      });
      expect(invalidCreate.success).toBe(false);

      const invalidUpdate = updateSchemaInputSchema.safeParse({
        formId: currentFormId,
        operation: "ADD_FIELD",
        fieldData: {
          id: "f_2",
          label: "우선순위",
          type: "radio",
          description: "처리 우선순위를 선택합니다.",
          options: ["상", "중", "하"],
        },
      });
      expect(invalidUpdate.success).toBe(false);

      const validCreate = createFormInputSchema.safeParse({
        title: "테스트 폼",
        fields: [
          {
            id: "f_1",
            label: "분류",
            type: "select",
            description: "항목 분류를 선택합니다.",
            options: [
              {
                label: "옵션 A",
                value: "A",
                description: "첫 번째 분류 옵션에 해당할 때 선택합니다.",
              },
              {
                label: "옵션 B",
                value: "B",
                description: "두 번째 분류 옵션에 해당할 때 선택합니다.",
              },
            ],
          },
        ],
      });
      expect(validCreate.success).toBe(true);

      const invalidOptionDescription = createFormInputSchema.safeParse({
        title: "테스트",
        description: "설명",
        fields: [
          {
            id: "f_1",
            label: "분류",
            type: "select",
            description: "항목 분류를 선택합니다.",
            options: [{ label: "옵션 A", value: "A" }],
          },
        ],
      });
      expect(invalidOptionDescription.success).toBe(false);

      const invalidFieldOptionsSchema = updateFieldOptionsInputSchema.safeParse({
        formId: currentFormId,
        targetFieldId: "f_category",
        operation: "ADD_OPTIONS",
        options: [{ label: "신규", value: "NEW", description: "   " }],
      });
      expect(invalidFieldOptionsSchema.success).toBe(false);
    });

    it("발행된 폼(currentFormId)에서 REMOVE_OPTION 호출 시 물리 삭제를 차단하고 에러를 반환해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: currentFormId,
          targetFieldId: "f_category",
          operation: "REMOVE_OPTION",
          targetOptionValue: "MEAL",
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("DISABLE_OPTION");
    });

    it("발행 취소되었더라도 기제출 응답이 존재하는 폼(unpublishedWithSubsFormId)에서는 REMOVE_OPTION을 차단해야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: unpublishedWithSubsFormId,
          targetFieldId: "u_status",
          operation: "REMOVE_OPTION",
          targetOptionValue: "PENDING",
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("DISABLE_OPTION");
    });

    it("미발행 초안 폼(draftFormId, 응답 0건)에서는 REMOVE_OPTION으로 옵션을 물리 삭제할 수 있어야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: draftFormId,
          targetFieldId: "d_priority",
          operation: "REMOVE_OPTION",
          targetOptionValue: "LOW",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        field?: CoreFormField;
      };

      expect(result.success).toBe(true);
      expect(result.field?.options).toEqual([
        {
          label: "높음",
          value: "HIGH",
          description: "당일 내 즉각적인 처리가 필요한 최우선 요청입니다.",
          disabled: false,
        },
        {
          label: "보통",
          value: "MEDIUM",
          description: "일반적인 업무 일정 내에 처리하는 표준 요청입니다.",
          disabled: false,
        },
      ]);
    });

    it("발행된 폼(currentFormId)에서 SET_OPTIONS 시 누락된 기존 옵션은 disabled: true로 보존 병합되어야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: currentFormId,
          targetFieldId: "f_category",
          operation: "SET_OPTIONS",
          options: [
            {
              label: "식대",
              value: "MEAL",
              description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
              disabled: false,
            },
          ],
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        field?: CoreFormField;
      };

      expect(result.success).toBe(true);
      expect(result.field?.options).toEqual(
        expect.arrayContaining([
          {
            label: "식대",
            value: "MEAL",
            description: "업무 관련 식사 및 다과 지출 시 선택합니다.",
            disabled: false,
          },
          {
            label: "교통비",
            value: "TRANSPORT",
            description: "외근 및 출장에 따른 대중교통/택시 이용 요금입니다.",
            disabled: true,
          },
          {
            label: "숙박비",
            value: "LODGING",
            description: "지방 출장 시 숙소 예약 비용입니다.",
            disabled: true,
          },
        ])
      );
    });

    it("미발행 초안 폼(draftFormId, 응답 0건)에서는 SET_OPTIONS 시 새 옵션 목록으로 깔끔하게 교체되어야 한다", async () => {
      const tools = createBuilderTools(dependencies);
      const result = (await tools.updateFieldOptions.execute!(
        {
          formId: draftFormId,
          targetFieldId: "d_priority",
          operation: "SET_OPTIONS",
          options: [
            {
              label: "긴급",
              value: "URGENT",
              description: "즉시 장애 대응이 필요한 최상위 긴급 등급입니다.",
              disabled: false,
            },
          ],
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        field?: CoreFormField;
      };

      expect(result.success).toBe(true);
      expect(result.field?.options).toEqual([
        {
          label: "긴급",
          value: "URGENT",
          description: "즉시 장애 대응이 필요한 최상위 긴급 등급입니다.",
          disabled: false,
        },
      ]);
    });
  });
});
