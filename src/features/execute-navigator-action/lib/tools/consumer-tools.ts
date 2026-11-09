import { tool } from "ai";
import { z } from "zod";
import type { Form } from "@/entities/form";
import { sanitizeSlug } from "./builder-tools";

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
  findPublishedForms: () => Promise<Form[]>;
  findFormBySlug: (slug: string) => Promise<Form | undefined>;
}

// 1. navigate 입력 스키마
export const consumerNavigateInputSchema = z.object({
  targetPath: z
    .string()
    .describe(
      "이동할 대상 경로 (예: '/consumer/forms', '/consumer/forms/developer-hire', '/consumer/views')"
    ),
  reason: z.string().describe("사용자에게 안내할 이동 목적 또는 이유"),
});

// 2. listForms 입력 스키마
export const consumerListFormsInputSchema = z.object({
  keyword: z
    .string()
    .optional()
    .describe("검색할 폼 제목이나 설명 키워드 (생략 시 전체 목록 조회)"),
});

// 3. fillFields 입력 스키마
export const consumerFillFieldsInputSchema = z.object({
  formSlug: z.string().describe("현재 입력 대상 폼의 슬러그"),
  fields: z
    .record(z.string(), z.unknown())
    .describe("추출된 필드명-값 쌍 (예: { applicantName: '홍길동', yearsOfExperience: 5 })"),
  message: z.string().describe("필드 입력 후 사용자에게 어떤 내용이 채워졌는지 설명하는 메시지"),
});

// 4. submitForm 입력 스키마
export const consumerSubmitFormInputSchema = z.object({
  formSlug: z.string().describe("제출할 대상 폼의 슬러그"),
  confirmationMessage: z.string().describe("제출 실행 전후 사용자에게 전달할 확인 및 감사 메시지"),
});

/**
 * AI Consumer Navigator 전용 Vercel AI SDK 도구 카탈로그 생성 팩토리 함수
 */
export function createConsumerTools(deps: ConsumerToolsDependencies) {
  const navigateTool = tool({
    description:
      "컨슈머 포털 내의 다른 화면으로 이동합니다. 특정 폼 작성 페이지(/consumer/forms/[slug]), 폼 목록(/consumer/forms), 제출 응답 목록(/consumer/forms/[slug]/submissions) 등으로 이동할 때 호출합니다.",
    inputSchema: consumerNavigateInputSchema,
    execute: async ({ targetPath, reason }: z.infer<typeof consumerNavigateInputSchema>) => {
      const normalized = normalizeConsumerPath(targetPath);
      return {
        success: true,
        targetPath: normalized,
        message: reason,
      };
    },
  });

  const listFormsTool = tool({
    description:
      "현재 일반 응답자(컨슈머)가 참여할 수 있는 발행된 공개 폼 목록을 조회합니다. 사용자가 어떤 설문/신청서가 있는지 물어보거나 특정 주제의 폼을 찾을 때 호출합니다.",
    inputSchema: consumerListFormsInputSchema,
    execute: async ({ keyword }: z.infer<typeof consumerListFormsInputSchema>) => {
      const forms = await deps.findPublishedForms();

      let filtered = forms;
      if (keyword) {
        const lower = keyword.toLowerCase();
        filtered = forms.filter(
          (f) =>
            f.title.toLowerCase().includes(lower) || f.description?.toLowerCase().includes(lower)
        );
      }

      return {
        success: true,
        totalCount: filtered.length,
        forms: filtered.map((f) => ({
          slug: f.slug,
          title: f.title,
          description: f.description,
          publishedAt: f.publishedAt,
        })),
      };
    },
  });

  const fillFieldsTool = tool({
    description:
      "엔드유저의 자연어 발화에서 입력값을 추출하여 현재 활성 폼의 지정 필드에 자동으로 채워 넣거나, 기존 응답 수정 시 필드값을 변경합니다. 여러 필드를 한 번에 채울 수 있습니다.",
    inputSchema: consumerFillFieldsInputSchema,
    execute: async ({
      formSlug,
      fields,
      message,
    }: z.infer<typeof consumerFillFieldsInputSchema>) => {
      return {
        success: true,
        formSlug: sanitizeSlug(formSlug),
        fields,
        message,
      };
    },
  });

  const submitFormTool = tool({
    description:
      "현재 작성 중인 폼의 입력을 완료하고 최종 제출을 실행하거나, 수정된 응답 저장을 발동합니다.",
    inputSchema: consumerSubmitFormInputSchema,
    execute: async ({
      formSlug,
      confirmationMessage,
    }: z.infer<typeof consumerSubmitFormInputSchema>) => {
      return {
        success: true,
        formSlug: sanitizeSlug(formSlug),
        message: confirmationMessage,
      };
    },
  });

  return {
    navigate: navigateTool,
    listForms: listFormsTool,
    fillFields: fillFieldsTool,
    submitForm: submitFormTool,
  };
}
