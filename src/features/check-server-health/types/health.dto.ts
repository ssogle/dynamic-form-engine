/**
 * GET /api/v1/health 엔드포인트의 네트워크 응답 DTO (Data Transfer Object)
 *
 * 서버(BFF Route Handler)와 클라이언트(httpClient / useHealthQuery) 간의
 * 단일 통신 계약(Contract)으로 동작합니다.
 */
export interface HealthCheckResponseDto {
  readonly status: "ok";
  readonly timestamp: string;
}
