import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Form } from "@/entities/form";
import { createConsumerTools } from "./consumer-tools";

describe("createConsumerTools (features/execute-navigator-action/lib/tools)", () => {
  const formId = "11111111-1111-4111-a111-111111111111";
  const targetRecordId = "99999999-9999-4999-a999-999999999999";

  const publishedForm: Form = {
    id: formId,
    title: "비용 정산서",
    description: "법인카드 지출 내역",
    schemaDefinition: {
      primaryFieldId: "f_title",
      fields: [
        {
          id: "f_title",
          label: "지출 항목",
          type: "text",
          required: true,
          description: "지출 내용",
        },
        {
          id: "f_amount",
          label: "금액",
          type: "number",
          required: true,
          description: "지출 금액",
        },
        {
          id: "f_category",
          label: "분류",
          type: "select",
          multiple: false,
          required: true,
          description: "지출 분류",
          options: [
            { label: "식대", value: "MEAL", description: "식사 비용", disabled: false },
            { label: "교통비", value: "TAXI", description: "이동 비용", disabled: false },
            { label: "폐기분류", value: "OLD", description: "비활성 옵션", disabled: true },
          ],
        },
        {
          id: "f_project",
          label: "관련 프로젝트",
          type: "relation",
          required: false,
          description: "귀속 프로젝트",
          relationConfig: {
            targetFormId: "22222222-2222-4222-a222-222222222222",
            multiple: false,
          },
        },
      ],
    },
    publishedAt: new Date("2026-11-01T00:00:00.000Z"),
    version: 1,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    deletedAt: null,
  };

  const mockExecutionOptions = {
    toolCallId: "test-call-id",
    messages: [],
    context: {},
  } as unknown as Parameters<
    NonNullable<ReturnType<typeof createConsumerTools>["fillFields"]["execute"]>
  >[1];

  const baseDeps = {
    findFormById: vi.fn().mockResolvedValue(publishedForm),
    softDeleteSubmissionsByIds: vi.fn().mockResolvedValue([]),
    currentFormId: formId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    baseDeps.findFormById.mockResolvedValue(publishedForm);
  });

  describe("fillFields", () => {
    it("선택형(select) 필드에 옵션 라벨('식대')이 전달되면 불변 코드 배열(['MEAL'])로 정규화해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const res = (await tools.fillFields.execute!(
        {
          formId,
          fields: {
            f_title: "팀 점심",
            f_category: "식대",
          },
          message: "식대 항목을 채웠습니다.",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        fields?: Record<string, unknown>;
        clientAction?: { type: string; fields: Record<string, unknown> };
      };

      expect(res.success).toBe(true);
      expect(res.fields).toEqual({
        f_title: "팀 점심",
        f_category: ["MEAL"],
      });
      expect(res.clientAction?.type).toBe("FILL_FIELDS");
    });

    it("존재하지 않거나 비활성화된 옵션('폐기분류')이 전달되면 거부해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const res = (await tools.fillFields.execute!(
        {
          formId,
          fields: {
            f_category: "폐기분류",
          },
          message: "입력",
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(res.success).toBe(false);
      expect(res.error).toContain("허용되지 않은 선택지");
    });

    it("관계형(relation) 필드에 UUID가 아닌 일반 문자열이 전달되면 거부하고 UUID 시 통과해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const invalidRel = (await tools.fillFields.execute!(
        {
          formId,
          fields: {
            f_project: "차세대 ERP 프로젝트",
          },
          message: "입력",
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(invalidRel.success).toBe(false);
      expect(invalidRel.error).toContain("UUID");

      const validRel = (await tools.fillFields.execute!(
        {
          formId,
          fields: {
            f_project: targetRecordId,
          },
          message: "프로젝트 연결",
        },
        mockExecutionOptions
      )) as { success: boolean; fields?: Record<string, unknown> };

      expect(validRel.success).toBe(true);
      expect(validRel.fields?.f_project).toEqual([targetRecordId]);
    });
  });

  describe("submitForm 선검증", () => {
    it("필수 필드가 채워지지 않은 상태에서 submitForm 호출 시 success: false와 fieldErrors를 반환해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const res = (await tools.submitForm.execute!(
        {
          formId,
          confirmationMessage: "제출합니다.",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        error?: string;
        fieldErrors?: Record<string, string>;
        clientAction?: unknown;
      };

      expect(res.success).toBe(false);
      expect(res.error).toContain("필수 입력");
      expect(res.fieldErrors).toHaveProperty("f_title");
      expect(res.fieldErrors).toHaveProperty("f_amount");
      expect(res.clientAction).toBeUndefined();
    });

    it("동일 턴 내 fillFields로 필수값을 채우거나 initialDraftValues와 합산해 유효하면 SUBMIT_FORM을 반환해야 한다", async () => {
      const tools = createConsumerTools({
        ...baseDeps,
        initialDraftValues: { f_title: "팀 야근 식대" },
      });

      await tools.fillFields.execute!(
        {
          formId,
          fields: {
            f_amount: 35000,
            f_category: "MEAL",
          },
          message: "금액과 분류를 입력했습니다.",
        },
        mockExecutionOptions
      );

      const submitRes = (await tools.submitForm.execute!(
        {
          formId,
          confirmationMessage: "제출을 완료합니다.",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        clientAction?: { type: string; formId: string };
      };

      expect(submitRes.success).toBe(true);
      expect(submitRes.clientAction).toEqual({
        type: "SUBMIT_FORM",
        formId,
        message: "제출을 완료합니다.",
      });
    });
  });

  describe("applySubmissionListQuery", () => {
    it("유효한 필터·기간·정렬 조건을 전달하면 쿼리스트링이 조립된 NAVIGATE 액션을 반환해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const res = (await tools.applySubmissionListQuery.execute!(
        {
          formId,
          filters: [{ fieldId: "f_category", op: "in", values: ["MEAL"] }],
          sort: [{ id: "f_amount", desc: true }],
          reason: "식대 항목을 금액 높은 순으로 조회합니다.",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        targetPath?: string;
        clientAction?: { type: string; targetPath: string };
      };

      expect(res.success).toBe(true);
      expect(res.targetPath).toContain(`/consumer/forms/${formId}?`);
      expect(res.targetPath).toContain("filters=");
      expect(res.targetPath).toContain("sort=f_amount%3Adesc");
      expect(res.clientAction?.type).toBe("NAVIGATE");
    });

    it("reset: true 전달 시 쿼리스트링이 제거된 기본 폼 목록 경로로 NAVIGATE 해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const res = (await tools.applySubmissionListQuery.execute!(
        {
          formId,
          reset: true,
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        targetPath?: string;
      };

      expect(res.success).toBe(true);
      expect(res.targetPath).toBe(`/consumer/forms/${formId}`);
    });

    it("스키마에 없는 정렬 컬럼을 지정하면 success: false를 반환해야 한다", async () => {
      const tools = createConsumerTools(baseDeps);

      const res = (await tools.applySubmissionListQuery.execute!(
        {
          formId,
          sort: [{ id: "non_existent_col", desc: true }],
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(res.success).toBe(false);
      expect(res.error).toContain("존재하지 않습니다");
    });
  });
});
