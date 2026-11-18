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
        description: z.string().optional(),
        options: z.array(selectOptionSchema).optional(),
      })
    )
    .optional(),
  currentDraftValues: z.record(z.string(), z.unknown()).optional(),
  visibleSubmissions: z.array(visibleItemSchema).optional(),
  // Analyst Context
  currentAnalysisView: z
    .object({
      id: z.string(),
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
 * 네비게이터 HTTP 요청 페이로드 검증 스키마
 */
export const navigatorRequestSchema = z.object({
  mode: navigatorModeSchema.default("builder"),
  prompt: z.string().min(1, "사용자 명령 프롬프트는 필수입니다."),
  messages: z.array(navigatorChatMessageSchema).optional(),
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
