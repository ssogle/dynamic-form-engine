import { tool } from "ai";
import type { FormSubmission } from "@/entities/form-submission";
import {
  consumerDeleteSubmissionsInputSchema,
  consumerFillFieldsInputSchema,
  consumerNavigateInputSchema,
  consumerSubmitFormInputSchema,
  type ConsumerDeleteSubmissionsInput,
  type ConsumerFillFieldsInput,
  type ConsumerNavigateInput,
  type ConsumerSubmitFormInput,
} from "../../schema/navigator-tools.schema";
import type { NavigatorConsumerAction } from "../../types/navigator-action.types";

export {
  consumerDeleteSubmissionsInputSchema,
  consumerFillFieldsInputSchema,
  consumerNavigateInputSchema,
  consumerSubmitFormInputSchema,
};

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

/**
 * AI Consumer Navigator 전용 Vercel AI SDK 브라우저 제어 도구 카탈로그 생성 함수
 *
 * 화면 이동, 폼 필드 입력, 최종 제출, 그리고 기제출 응답 다건 소프트 삭제를 담당합니다.
 */
export function createConsumerTools(deps: ConsumerToolsDependencies) {
  const navigateTool = tool({
    description:
      "컨슈머 포털 내의 다른 화면으로 이동합니다. 특정 폼의 데이터 목록 페이지(/consumer/forms/[id]), 신규 작성 페이지(/consumer/forms/[id]/new), 단건 응답 상세 페이지(/consumer/forms/[id]/submissions/[submissionId]), 응답 수정 페이지(/consumer/forms/[id]/submissions/[submissionId]/edit), 전체 폼 메뉴(/consumer/forms) 등으로 이동할 때 호출합니다.",
    inputSchema: consumerNavigateInputSchema,
    execute: async ({ targetPath, reason }: ConsumerNavigateInput) => {
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
    execute: async ({ formId, fields, message }: ConsumerFillFieldsInput) => {
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
    execute: async ({ formId, confirmationMessage }: ConsumerSubmitFormInput) => {
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
    execute: async ({ submissionIds, reason }: ConsumerDeleteSubmissionsInput) => {
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
