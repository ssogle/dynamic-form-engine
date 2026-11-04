import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import type { HealthCheckResponseDto } from "../types/health.dto";
import { healthKeys } from "./health.keys";

/**
 * 순수 API 통신 함수 (BFF /api/v1/health 호출)
 * - 성공 시 순수 HealthCheckResponseDto를 반환하고, 실패 시 정규화된 HttpErrorData를 throw합니다.
 */
export const getHealth = (): Promise<HealthCheckResponseDto> =>
  httpClient.get<HealthCheckResponseDto>("/api/v1/health");

/**
 * 서버 헬스체크 TanStack Query 훅
 *
 * @returns 헬스체크 결과 및 캐시 상태 객체
 */
export const useHealthQuery = () =>
  useQuery<HealthCheckResponseDto, HttpErrorData>({
    queryKey: healthKeys.all,
    queryFn: getHealth,
  });
