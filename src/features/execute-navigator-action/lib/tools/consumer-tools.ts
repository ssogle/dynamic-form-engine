import { tool } from "ai";
import { z } from "zod";
import type { FormSubmission } from "@/entities/form-submission";
import type { NavigatorConsumerAction } from "../../types/navigator-action.types";

/**
 * 컨슈머 URL 경로 정규화 유틸리티
 */
export function normalizeConsumerPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

/**
 * 컨슈머 도구 카탈로그에서 사용할 데이터 의존성 인터페이스
 */
export interface ConsumerToolsDependencies {
  softDeleteSubmissionsByIds: (ids: string[]) => Promise<FormSubmission[]>;
}

// 1. navigate 입력 스키마
export const consumerNavigateInputSchema = z.object({
  targetPath: z
    .string()
    .describe(
      "이동할 대상 경로 (예: '/consumer/forms', '/consumer/forms/[id]', '/consumer/views')"
    ),
  reason: z.string().describe("사용자에게 안내할 이동 목적 또는 이유"),
});

// 2. fillFields 입력 스키마
export const consumerFillFieldsInputSchema = z.object({
  formId: z
    .uuid("폼 ID(UUID)는 필수입니다.")
    .optional()
    .describe("현재 입력 대상 폼의 ID (생략 시 현재 활성 폼)"),
  fields: z
    .record(z.string(), z.unknown())
    .describe("추출된 필드ID-값 쌍 (예: { f_applicant: '홍길동', f_experience: 5 })"),
  message: z.string().describe("필드 입력 후 사용자에게 어떤 내용이 채워졌는지 설명하는 메시지"),
});

// 3. submitForm 입력 스키마
export const consumerSubmitFormInputSchema = z.object({
  formId: z
    .uuid("폼 ID(UUID)는 필수입니다.")
    .optional()
    .describe("제출할 대상 폼의 ID (생략 시 현재 활성 폼)"),
  confirmationMessage: z.string().describe("제출 실행 전후 사용자에게 전달할 확인 및 감사 메시지"),
});

// 4. deleteSubmissions 입력 스키마 (다건/단건 통합 멀티 삭제)
export const consumerDeleteSubmissionsInputSchema = z.object({
  submissionIds: z
    .array(z.uuid())
    .min(1, "삭제할 응답 ID는 최소 1개 이상이어야 합니다.")
    .describe("삭제할 제출 응답 ID(UUID) 배열 (단일 응답 삭제 시에도 1개짜리 배열로 전달)"),
  reason: z.string().optional().describe("삭제 사유"),
});

/**
 * AI Consumer Navigator 전용 Vercel AI SDK 브라우저 제어 도구 카탈로그 생성 함수
 *
 * 화면 이동, 폼 필드 입력, 최종 제출, 그리고 기제출 응답 다건 소프트 삭제를 담당합니다.
 */
export function createConsumerTools(deps: ConsumerToolsDependencies) {
  const navigateTool = tool({
    description:
      "컨슈머 포털 내의 다른 화면으로 이동합니다. 특정 폼 작성 페이지(/consumer/forms/[id]), 폼 목록(/consumer/forms), 제출 응답 목록(/consumer/forms/[id]/submissions) 등으로 이동할 때 호출합니다.",
    inputSchema: consumerNavigateInputSchema,
    execute: async ({ targetPath, reason }: z.infer<typeof consumerNavigateInputSchema>) => {
      const normalized = normalizeConsumerPath(targetPath);
      const action: NavigatorConsumerAction = {
        type: "NAVIGATE",
        targetPath: normalized,
        message: reason || "해당 화면으로 이동합니다.",
      };
      return {
        success: true,
        targetPath: normalized,
        message: reason,
        clientAction: action,
      };
    },
  });

  const fillFieldsTool = tool({
    description:
      "엔드유저의 자연어 발화에서 입력값을 추출하여 현재 활성 폼의 지정 필드(field.id)에 자동으로 채워 넣거나, 기존 응답 수정 시 필드값을 변경합니다. 여러 필드를 한 번에 채울 수 있습니다.",
    inputSchema: consumerFillFieldsInputSchema,
    execute: async ({ formId, fields, message }: z.infer<typeof consumerFillFieldsInputSchema>) => {
      const action: NavigatorConsumerAction = {
        type: "FILL_FIELDS",
        formId,
        fields,
        message,
      };
      return {
        success: true,
        formId,
        fields,
        message,
        clientAction: action,
      };
    },
  });

  const submitFormTool = tool({
    description:
      "현재 작성 중인 폼의 입력을 완료하고 최종 제출을 실행하거나, 수정된 응답 저장을 발동합니다.",
    inputSchema: consumerSubmitFormInputSchema,
    execute: async ({
      formId,
      confirmationMessage,
    }: z.infer<typeof consumerSubmitFormInputSchema>) => {
      const action: NavigatorConsumerAction = {
        type: "SUBMIT_FORM",
        formId,
        message: confirmationMessage,
      };
      return {
        success: true,
        formId,
        message: confirmationMessage,
        clientAction: action,
      };
    },
  });

  const deleteSubmissionsTool = tool({
    description:
      "특정 폼의 제출 응답 내역들을 소프트 삭제합니다. 응답 목록 화면에서 단일 또는 복수의 응답을 삭제할 때 호출합니다.",
    inputSchema: consumerDeleteSubmissionsInputSchema,
    execute: async ({
      submissionIds,
      reason,
    }: z.infer<typeof consumerDeleteSubmissionsInputSchema>) => {
      const deleted = await deps.softDeleteSubmissionsByIds(submissionIds);
      const action: NavigatorConsumerAction = {
        type: "DELETE_SUBMISSIONS",
        deletedIds: deleted.map((s) => s.id),
        message: reason ?? "선택한 응답을 성공적으로 삭제했습니다.",
      };
      return {
        success: true,
        deletedIds: action.deletedIds,
        deletedCount: deleted.length,
        reason: reason ?? "사용자 요청에 의한 응답 삭제",
        clientAction: action,
      };
    },
  });

  return {
    navigate: navigateTool,
    fillFields: fillFieldsTool,
    submitForm: submitFormTool,
    deleteSubmissions: deleteSubmissionsTool,
  };
}
