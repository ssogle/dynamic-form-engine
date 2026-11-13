import { NextRequest } from "next/server";
import {
  runNavigatorEngine,
  navigatorRequestSchema,
} from "@/features/execute-navigator-action/server";
import { apiResponse, parseRequestData, withErrorHandler } from "@/shared/lib/http";

/**
 * AI Navigator 통합 HTTP 엔드포인트 핸들러 (POST /api/v1/navigator)
 *
 * Builder 및 Consumer 두 모드의 자연어 명령을 단일 오케스트레이션 엔진에 위임하고
 * 표준 응답 구조로 반환하는 Thin Controller입니다.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const json: unknown = await request.json().catch(() => null);
  const parsedRequest = parseRequestData(
    navigatorRequestSchema,
    json,
    "요청 페이로드가 올바르지 않습니다."
  );

  const result = await runNavigatorEngine(parsedRequest);
  return apiResponse.ok(result);
});
