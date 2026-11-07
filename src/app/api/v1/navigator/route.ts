import { NextRequest } from "next/server";
import { z } from "zod";
import { runNavigatorEngine } from "@/features/execute-navigator-action/server";
import { apiResponse, badRequest, withErrorHandler } from "@/shared/lib/http";

/**
 * 네비게이터 HTTP 요청 페이로드 검증 스키마
 */
const navigatorRequestSchema = z.object({
  prompt: z.string().min(1, "사용자 명령 프롬프트는 필수입니다."),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
  currentContext: z
    .object({
      currentPath: z.string().optional(),
      currentForm: z
        .object({
          slug: z.string(),
          title: z.string(),
          description: z.string().optional(),
          fields: z.array(z.any()).default([]),
        })
        .optional(),
    })
    .optional(),
});

/**
 * AI Navigator HTTP 엔드포인트 핸들러 (POST /api/v1/navigator)
 *
 * HTTP 요청의 유효성을 검증하고, 비즈니스 오케스트레이션을
 * `runNavigatorEngine` 서비스에 위임한 후 결과를 반환하는 Thin Controller입니다.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const json: unknown = await request.json().catch(() => null);
  const parsedRequest = navigatorRequestSchema.safeParse(json);

  if (!parsedRequest.success) {
    throw badRequest(
      "요청 페이로드가 올바르지 않습니다.",
      z.flattenError(parsedRequest.error).fieldErrors
    );
  }

  // 비즈니스 오케스트레이션 실행 위임
  const executionResponse = await runNavigatorEngine(parsedRequest.data);

  return apiResponse.ok(executionResponse);
});
