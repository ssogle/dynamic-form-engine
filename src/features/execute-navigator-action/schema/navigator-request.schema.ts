import { z } from "zod";
import { analysisBlockSchema } from "@/entities/analysis-view";
import { coreFormFieldSchema, selectOptionSchema } from "@/entities/form";

/**
 * 네비게이터 동작 모드 Zod 스키마
 */
export const navigatorModeSchema = z.enum(["builder", "consumer", "analyst"]);

/**
 * 네비게이터 동작 모드 구분 타입
 */
export type NavigatorMode = z.infer<typeof navigatorModeSchema>;

/**
 * 대화 세션 메시지 DTO 검증 스키마
 */
export const navigatorChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

/**
 * 대화 세션 메시지 DTO 타입
 */
export type NavigatorChatMessageDto = z.infer<typeof navigatorChatMessageSchema>;

/**
 * 화면 테이블/목록에 렌더링된 항목의 경량 요약 정보 스키마 (React Query 캐시 연동)
 */
export const visibleItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string().optional(),
  summary: z.string().optional(),
});

/**
 * 화면 테이블/목록에 렌더링된 항목의 경량 요약 정보 타입
 */
export type VisibleItemSummary = z.infer<typeof visibleItemSchema>;

/**
 * 네비게이터 실행 요청 클라이언트 UI 화면 컨텍스트 Zod 스키마
 */
export const navigatorClientContextSchema = z.object({
  currentPath: z.string().optional(),
  // Builder Context
  currentForm: z
    .object({
      id: z.string(),
      version: z.number().int().positive().optional(),
      title: z.string(),
      description: z.string().optional(),
      isPublished: z.boolean().optional(),
      primaryFieldId: z.string().optional(),
      fields: z.array(coreFormFieldSchema).default([]),
    })
    .optional(),
  visibleForms: z.array(visibleItemSchema).optional(),
  // Consumer Context
  currentFormId: z.string().optional(),
  currentFormTitle: z.string().optional(),
  availableFields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.string(),
        required: z.boolean().optional(),
        multiple: z.boolean().optional(),
        description: z.string().optional(),
        options: z.array(selectOptionSchema).optional(),
        relationConfig: z
          .object({
            targetFormId: z.string(),
            multiple: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .optional(),
  currentDraftValues: z.record(z.string(), z.unknown()).optional(),
  visibleSubmissions: z.array(visibleItemSchema).optional(),
  // Analyst Context
  currentAnalysisView: z
    .object({
      id: z.string(),
      version: z.number().int().positive().optional(),
      title: z.string(),
      description: z.string().optional(),
      isPublished: z.boolean().optional(),
      blocks: z.array(analysisBlockSchema).default([]),
    })
    .optional(),
  visibleAnalysisViews: z.array(visibleItemSchema).optional(),
});

/**
 * 네비게이터 실행 요청 컨텍스트 타입 (`navigatorClientContextSchema` 파생)
 */
export type NavigatorClientContext = z.infer<typeof navigatorClientContextSchema>;

/**
 * 고위험 액션 사전 실행 확인(HITL) 대상 도구 목록 (단일 진실 원천 - SSOT)
 */
export const HIGH_RISK_CONFIRMATION_TOOLS = [
  "publishForm",
  "deleteForms",
  "submitForm",
  "deleteSubmissions",
  "publishAnalysisView",
  "deleteAnalysisViews",
] as const;

/**
 * 고위험 액션 사전 확인 대상 도구명 스키마
 */
export const highRiskConfirmationToolSchema = z.enum(HIGH_RISK_CONFIRMATION_TOOLS);
export type HighRiskConfirmationToolName = z.infer<typeof highRiskConfirmationToolSchema>;

/**
 * 멀티모달 이미지 첨부 파일 검증 스키마 (Gemini Vision 입력용)
 */
export const navigatorAttachmentSchema = z.object({
  name: z.string().max(120).optional(),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  dataUrl: z
    .string()
    .max(4_000_000, "이미지 첨부 크기가 허용 한도(약 3MB)를 초과했습니다.")
    .refine((val) => val.startsWith("data:image/"), "유효한 이미지 Data URL 형식이 아닙니다."),
});
export type NavigatorAttachmentDto = z.infer<typeof navigatorAttachmentSchema>;

/**
 * 사용자가 인라인 확인 카드에서 승인한 고위험 액션 직접 실행 페이로드 스키마
 */
export const confirmedNavigatorActionSchema = z.object({
  confirmationId: z.string().min(1, "승인 식별자(confirmationId)는 필수입니다."),
  toolName: highRiskConfirmationToolSchema,
  payload: z.record(z.string(), z.unknown()),
});
export type ConfirmedNavigatorActionDto = z.infer<typeof confirmedNavigatorActionSchema>;

/**
 * 네비게이터 HTTP 요청 페이로드 검증 스키마
 */
export const navigatorRequestSchema = z.object({
  mode: navigatorModeSchema.default("builder"),
  prompt: z.string().min(1, "사용자 명령 프롬프트는 필수입니다."),
  messages: z.array(navigatorChatMessageSchema).optional(),
  attachments: z
    .array(navigatorAttachmentSchema)
    .max(3, "이미지는 한 번에 최대 3장까지 첨부할 수 있습니다.")
    .optional(),
  confirmedAction: confirmedNavigatorActionSchema.optional(),
  currentContext: navigatorClientContextSchema.optional(),
});

/**
 * 서버 경계에서 파싱 완료된 네비게이터 요청 DTO 타입
 */
export type NavigatorRequestDto = z.infer<typeof navigatorRequestSchema>;

/**
 * 네비게이터 서버/뮤테이션 호출자용 요청 페이로드 타입 (호출 시 mode 생략 허용)
 */
export type ExecuteNavigatorPayload = Omit<NavigatorRequestDto, "mode"> & {
  mode?: NavigatorMode | undefined;
};
