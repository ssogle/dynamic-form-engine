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
    queryFormSubmissionsForAnalysis: vi.fn(),
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

    it("대시보드(/consumer) 등 다른 화면에서도 원격 폼의 relation op:'in' 필터 및 정렬을 적용해 NAVIGATE 액션을 반환해야 한다", async () => {
      const tools = createConsumerTools({
        ...baseDeps,
        currentPath: "/consumer",
      });

      const res = (await tools.applySubmissionListQuery.execute!(
        {
          formId,
          filters: [{ fieldId: "f_project", op: "in", values: [targetRecordId] }],
          sort: [{ id: "f_amount", desc: false }],
          reason: "대시보드에서 특정 프로젝트 지출 내역을 금액 낮은 순으로 엽니다.",
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
      expect(res.targetPath).toContain("sort=f_amount%3Aasc");
      expect(res.clientAction?.type).toBe("NAVIGATE");
    });
  });

  describe("searchSubmissions", () => {
    it("발행된 폼 조회 시 limit+1로 쿼리하고 결과 개수가 limit 이내이면 hasMore: false를 반환해야 한다", async () => {
      baseDeps.queryFormSubmissionsForAnalysis.mockResolvedValueOnce({
        data: {
          formId,
          formTitle: publishedForm.title,
          dateAxis: "createdAt",
          totalReturned: 1,
          records: [
            {
              id: targetRecordId,
              createdAt: new Date("2026-11-19T01:00:00.000Z"),
              values: { "지출 항목": "팀 점심", 금액: 25000, 분류: "식대" },
            },
          ],
        },
        error: null,
      });

      const tools = createConsumerTools(baseDeps);
      const res = (await tools.searchSubmissions.execute!(
        {
          formId,
          startDate: "2026-11-19",
          endDate: "2026-11-19",
          sortOrder: "desc",
          limit: 10,
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        data?: { totalReturned: number; hasMore: boolean; records: Array<{ id: string }> };
      };

      expect(baseDeps.queryFormSubmissionsForAnalysis).toHaveBeenCalledWith({
        formId,
        dateFieldId: undefined,
        startDate: "2026-11-19",
        endDate: "2026-11-19",
        timezone: "Asia/Seoul",
        filters: undefined,
        sortOrder: "desc",
        limit: 11,
      });
      expect(res.success).toBe(true);
      expect(res.data?.totalReturned).toBe(1);
      expect(res.data?.hasMore).toBe(false);
      expect(res.data?.records[0]?.id).toBe(targetRecordId);
    });

    it("조회된 행이 limit을 초과하면 limit건만 잘라 반환하고 hasMore: true를 설정해야 한다", async () => {
      baseDeps.queryFormSubmissionsForAnalysis.mockResolvedValueOnce({
        data: {
          formId,
          formTitle: publishedForm.title,
          dateAxis: "createdAt",
          totalReturned: 3,
          records: [
            { id: "r1", createdAt: new Date(), values: { "지출 항목": "1건" } },
            { id: "r2", createdAt: new Date(), values: { "지출 항목": "2건" } },
            { id: "r3", createdAt: new Date(), values: { "지출 항목": "3건" } },
          ],
        },
        error: null,
      });

      const tools = createConsumerTools(baseDeps);
      const res = (await tools.searchSubmissions.execute!(
        {
          formId,
          sortOrder: "desc",
          limit: 2,
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        data?: { totalReturned: number; hasMore: boolean; records: Array<{ id: string }> };
      };

      expect(res.success).toBe(true);
      expect(res.data?.totalReturned).toBe(2);
      expect(res.data?.hasMore).toBe(true);
      expect(res.data?.records.map((r) => r.id)).toEqual(["r1", "r2"]);
    });

    it("미발행 폼(publishedAt: null) 조회 시 queryFormSubmissionsForAnalysis를 호출하지 않고 거부해야 한다", async () => {
      baseDeps.findFormById.mockResolvedValueOnce({
        ...publishedForm,
        publishedAt: null,
      });

      const tools = createConsumerTools(baseDeps);
      const res = (await tools.searchSubmissions.execute!(
        {
          formId,
          sortOrder: "desc",
          limit: 20,
        },
        mockExecutionOptions
      )) as { success: boolean; error?: string };

      expect(res.success).toBe(false);
      expect(res.error).toContain("발행된 대상 폼");
      expect(baseDeps.queryFormSubmissionsForAnalysis).not.toHaveBeenCalled();
    });
  });

  describe("HITL 사전 승인 게이트 (submitForm, deleteSubmissions)", () => {
    it("requireConfirmation: true일 때 submitForm은 검증 실패 시 승인 카드 없이 즉시 거부해야 한다", async () => {
      const tools = createConsumerTools({
        ...baseDeps,
        requireConfirmation: true,
        currentPath: `/consumer/forms/${formId}/new`,
      });

      const res = (await tools.submitForm.execute!(
        {
          formId,
          confirmationMessage: "제출을 완료합니다.",
        },
        mockExecutionOptions
      )) as {
        success: boolean;
        requiresConfirmation?: boolean;
        fieldErrors?: Record<string, string>;
      };

      expect(res.success).toBe(false);
      expect(res.requiresConfirmation).toBeUndefined();
      expect(res.fieldErrors).toBeDefined();
    });

    it("requireConfirmation: true일 때 신규 작성(/new) submitForm은 SUBMIT_FORM 없이 PENDING_CONFIRMATION을 반환해야 한다", async () => {
      const tools = createConsumerTools({
        ...baseDeps,
        requireConfirmation: true,
        currentPath: `/consumer/forms/${formId}/new`,
        initialDraftValues: {
          f_title: "팀 점심 식대",
          f_amount: 25000,
          f_category: ["MEAL"],
        },
      });

      const res = (await tools.submitForm.execute!(
        {
          formId,
          confirmationMessage: "응답을 제출합니다.",
        },
        mockExecutionOptions
      )) as {
        requiresConfirmation?: boolean;
        status?: string;
        clientAction?: unknown;
        pendingConfirmation?: { toolName: string; title: string; targetIds: string[] };
      };

      expect(res.requiresConfirmation).toBe(true);
      expect(res.status).toBe("PENDING_CONFIRMATION");
      expect(res.clientAction).toBeUndefined();
      expect(res.pendingConfirmation?.toolName).toBe("submitForm");
      expect(res.pendingConfirmation?.title).toContain("응답 제출");
      expect(res.pendingConfirmation?.targetIds).toEqual([formId]);
    });

    it("requireConfirmation: true일 때 수정(/edit) submitForm은 수정 저장 안내로 PENDING_CONFIRMATION을 반환해야 한다", async () => {
      const tools = createConsumerTools({
        ...baseDeps,
        requireConfirmation: true,
        currentPath: `/consumer/forms/${formId}/submissions/${targetRecordId}/edit`,
        initialDraftValues: {
          f_title: "팀 회식 식대",
          f_amount: 42000,
          f_category: ["MEAL"],
        },
      });

      const res = (await tools.submitForm.execute!(
        {
          formId,
          confirmationMessage: "수정 내용을 저장합니다.",
        },
        mockExecutionOptions
      )) as {
        requiresConfirmation?: boolean;
        status?: string;
        clientAction?: unknown;
        pendingConfirmation?: { toolName: string; title: string; description: string };
      };

      expect(res.requiresConfirmation).toBe(true);
      expect(res.status).toBe("PENDING_CONFIRMATION");
      expect(res.clientAction).toBeUndefined();
      expect(res.pendingConfirmation?.toolName).toBe("submitForm");
      expect(res.pendingConfirmation?.title).toContain("수정 응답 저장");
      expect(res.pendingConfirmation?.description).toContain("수정 내용");
    });

    it("requireConfirmation: true일 때 deleteSubmissions는 DB 삭제 없이 PENDING_CONFIRMATION을 반환해야 한다", async () => {
      const tools = createConsumerTools({
        ...baseDeps,
        requireConfirmation: true,
      });

      const res = (await tools.deleteSubmissions.execute!(
        {
          submissionIds: [targetRecordId],
          reason: "중복 제출 삭제",
        },
        mockExecutionOptions
      )) as {
        requiresConfirmation?: boolean;
        status?: string;
        pendingConfirmation?: { toolName: string; targetIds: string[] };
      };

      expect(res.requiresConfirmation).toBe(true);
      expect(res.status).toBe("PENDING_CONFIRMATION");
      expect(res.pendingConfirmation?.toolName).toBe("deleteSubmissions");
      expect(res.pendingConfirmation?.targetIds).toEqual([targetRecordId]);
      expect(baseDeps.softDeleteSubmissionsByIds).not.toHaveBeenCalled();
    });
  });
});
