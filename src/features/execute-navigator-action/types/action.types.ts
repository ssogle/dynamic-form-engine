import { z } from "zod";
import { coreFormFieldSchema, type ActiveForm } from "@/entities/form";

/**
 * 폼 슬러그 정규식 가드레일 (영문 소문자, 숫자, 하이픈)
 */
export const slugRegex = /^[a-z0-9-]+$/;

/**
 * 화면 라우팅 이동 액션 스키마
 */
export const navigateActionSchema = z.object({
  type: z.literal("NAVIGATE"),
  targetPath: z.string().describe("이동할 경로 (예: /builder/customer-survey, /forms, /)"),
  message: z.string().describe("네비게이터가 대화창에 사용자에게 전달할 안내 메시지"),
});

export type NavigateAction = z.infer<typeof navigateActionSchema>;

/**
 * 신규 폼 생성 및 프리뷰 전환 액션 스키마
 */
export const createFormActionSchema = z.object({
  type: z.literal("CREATE_FORM"),
  slug: z
    .string()
    .min(2, "슬러그는 최소 2글자 이상이어야 합니다.")
    .regex(slugRegex, "슬러그는 영문 소문자, 숫자, 하이픈만 허용됩니다."),
  title: z.string().min(1, "폼 제목은 비어있을 수 없습니다."),
  description: z.string().optional(),
  fields: z.array(coreFormFieldSchema).default([]),
  message: z.string().describe("폼 생성 완료 후 사용자에게 전달할 안내 메시지"),
});

export type CreateFormAction = z.infer<typeof createFormActionSchema>;

/**
 * 폼 스키마 실시간 조작 액션 스키마
 */
export const updateSchemaActionSchema = z.object({
  type: z.literal("UPDATE_SCHEMA"),
  formSlug: z.string().min(1, "대상 폼 슬러그는 필수입니다."),
  operation: z
    .enum(["ADD_FIELD", "REMOVE_FIELD", "MODIFY_FIELD", "UPDATE_INFO"])
    .describe("수행할 스키마 조작 유형"),
  targetFieldId: z
    .string()
    .optional()
    .describe("수정/삭제 대상 필드 식별자 (필드 ID, name 또는 라벨)"),
  fieldData: coreFormFieldSchema.partial().optional().describe("추가 또는 변경할 필드 데이터"),
  formTitle: z.string().optional().describe("변경할 폼 제목"),
  formDescription: z.string().optional().describe("변경할 폼 설명"),
  message: z.string().describe("스키마 변경 후 사용자에게 전달할 안내 메시지"),
});

export type UpdateSchemaAction = z.infer<typeof updateSchemaActionSchema>;

/**
 * AI Navigator 1단계 핵심 액션 유니온 (Zod Discriminated Union)
 */
export const navigatorActionSchema = z.discriminatedUnion("type", [
  navigateActionSchema,
  createFormActionSchema,
  updateSchemaActionSchema,
]);

export type NavigatorAction = z.infer<typeof navigatorActionSchema>;

/**
 * Result 패턴 표준 규격
 */
export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; details?: unknown } };

/**
 * 이전 대화 히스토리 메시지 규격
 */
export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * AI Navigator 실행 요청 페이로드
 */
export interface ExecuteNavigatorActionPayload {
  /**
   * 사용자 자연어 발화 프롬프트
   */
  prompt: string;

  /**
   * 이전 대화 세션 히스토리 목록 (맥락 유지용)
   */
  messages?: ChatHistoryMessage[] | undefined;

  /**
   * 클라이언트의 현재 화면 컨텍스트
   */
  currentContext?:
    | {
        currentPath?: string | undefined;
        currentForm?: ActiveForm | undefined;
      }
    | undefined;
}

/**
 * AI Navigator 실행 최종 응답 규격
 */
export interface NavigatorExecutionResponse {
  /**
   * 사용자에게 대화창을 통해 전달할 AI 최종 답변 메시지
   */
  reply: string;

  /**
   * 도출 및 수행된 UI 액션 (화면 이동, 폼 생성, 스키마 변경 등 화면 제어가 필요할 때 제공)
   */
  action?: NavigatorAction | null | undefined;

  /**
   * 액션 수행 결과 갱신/생성된 폼 스키마 (해당되는 경우)
   */
  updatedForm?: ActiveForm | null | undefined;

  /**
   * 도구 카탈로그 실행 이력 목록
   */
  toolCalls?:
    | Array<{
        toolName: string;
        args: Record<string, unknown>;
        result?: unknown;
      }>
    | undefined;
}
