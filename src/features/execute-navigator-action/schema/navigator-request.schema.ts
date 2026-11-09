import { z } from "zod";

const visibleItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  createdAt: z.string().optional(),
  summary: z.string().optional(),
});

/**
 * 네비게이터 HTTP 요청 페이로드 검증 스키마
 */
export const navigatorRequestSchema = z.object({
  mode: z.enum(["builder", "consumer"]).default("builder"),
  prompt: z.string().min(1, "사용자 명령 프롬프트는 필수입니다."),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional(),
  currentContext: z
    .object({
      currentPath: z.string().optional(),
      // Builder Context
      currentForm: z
        .object({
          slug: z.string(),
          title: z.string(),
          description: z.string().optional(),
          fields: z.array(z.any()).default([]),
        })
        .optional(),
      visibleForms: z.array(visibleItemSchema).optional(),
      // Consumer Context
      currentFormSlug: z.string().optional(),
      currentFormTitle: z.string().optional(),
      availableFields: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            label: z.string(),
            type: z.string(),
            required: z.boolean().optional(),
            options: z.array(z.string()).optional(),
          })
        )
        .optional(),
      currentDraftValues: z.record(z.string(), z.unknown()).optional(),
      visibleSubmissions: z.array(visibleItemSchema).optional(),
    })
    .optional(),
});

export type NavigatorRequestDto = z.infer<typeof navigatorRequestSchema>;
