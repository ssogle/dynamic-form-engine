import { z } from "zod";
import { coreFormFieldSchema } from "@/entities/form";

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
    .enum(["ADD_FIELD", "REMOVE_FIELD", "MODIFY_FIELD", "UPDATE_INFO", "SET_ALL_FIELDS"])
    .describe("수행할 스키마 조작 유형"),
  targetFieldId: z
    .string()
    .optional()
    .describe("수정/삭제 대상 필드 식별자 (필드 ID, name 또는 라벨)"),
  fieldData: coreFormFieldSchema.partial().optional().describe("추가 또는 변경할 필드 데이터"),
  fields: z
    .array(coreFormFieldSchema)
    .optional()
    .describe("전체 필드 일괄 교체 시 전달되는 완성된 필드 목록"),
  newSlug: z.string().optional().describe("변경할 새 폼 슬러그"),
  formTitle: z.string().optional().describe("변경할 폼 제목"),
  formDescription: z.string().optional().describe("변경할 폼 설명"),
  message: z.string().describe("스키마 변경 후 사용자에게 전달할 안내 메시지"),
});

export type UpdateSchemaAction = z.infer<typeof updateSchemaActionSchema>;

/**
 * 폼 발행 상태 변경 액션 스키마
 */
export const publishFormActionSchema = z.object({
  type: z.literal("PUBLISH_FORM"),
  formSlug: z.string().min(1, "대상 폼 슬러그는 필수입니다."),
  isPublished: z.boolean().describe("발행 여부 (true: 발행, false: 초안/미발행)"),
  publishedAt: z.string().nullable().optional().describe("발행 일시 ISO 문자열"),
  message: z.string().describe("발행 상태 변경 후 사용자에게 전달할 안내 메시지"),
});

export type PublishFormAction = z.infer<typeof publishFormActionSchema>;

/**
 * AI Navigator 1단계 핵심 액션 유니온 (Zod Discriminated Union)
 */
export const navigatorActionSchema = z.discriminatedUnion("type", [
  navigateActionSchema,
  createFormActionSchema,
  updateSchemaActionSchema,
  publishFormActionSchema,
]);

export type NavigatorAction = z.infer<typeof navigatorActionSchema>;
