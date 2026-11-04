import type { HealthCheckResponseDto } from "@/features/check-server-health";
import { apiResponse, withErrorHandler } from "@/shared/lib/http";

/**
 * GET /api/v1/health
 *
 * API v1 런타임의 정상 동작 여부를 확인하는 헬스체크 엔드포인트입니다.
 * withErrorHandler로 감싸져 있어 안전하게 200 { success: true, data } 또는 표준 에러 JSON을 반환합니다.
 *
 * @returns 200 OK와 함께 HealthCheckResponseDto 객체 반환
 */
export const GET = withErrorHandler(async () => {
  return apiResponse.ok<HealthCheckResponseDto>({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
