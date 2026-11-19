/**
 * HTTP 통신 및 API 응답에서 사용하는 표준 에러 코드
 */
export type ErrorCode =
  | "BAD_REQUEST" // 400: 잘못된 요청 문법, 필수 파라미터 누락 등
  | "UNAUTHORIZED" // 401: 인증 실패 (로그인 필요, 토큰 만료)
  | "FORBIDDEN" // 403: 인가 실패 (권한 부족)
  | "NOT_FOUND" // 404: 요청한 리소스(폼, 사용자 등)가 없음
  | "CONFLICT" // 409: 중복된 리소스 충돌 (이미 존재하는 이름 등)
  | "VALIDATION_ERROR" // 422: Zod 스키마 검증 실패
  | "NETWORK_ERROR" // 0: 클라이언트 오프라인 또는 네트워크 단절
  | "INTERNAL_SERVER_ERROR"; // 500: 서버 내부 로직 예외

/**
 * 클라이언트에 전달되는 공통 에러 데이터 구조
 */
export interface HttpErrorData {
  /** HTTP 상태 코드 (e.g. 400, 404, 500, 네트워크 에러 시 0) */
  status: number;
  /** 기계 판독용 에러 식별 코드 (e.g. 'NOT_FOUND') */
  code: ErrorCode | string;
  /** 사용자 또는 개발자용 친절한 한글 에러 메시지 */
  message: string;
  /** Zod 필드 검증 에러 목록 등 부가 디버깅 정보 (선택적) */
  details?: unknown;
}

/**
 * Result 패턴 기반의 API 응답 타입 (Discriminated Union)
 *
 * 성공 시: `{ data: T, error: null }`
 * 실패 시: `{ data: null, error: HttpErrorData }`
 *
 * 컴포넌트에서 `const { data, error } = await httpClient.get(...)` 형태로 호출 후
 * `if (error)` 분기를 거치면, TypeScript가 자동으로 `data`를 non-null로 좁혀줍니다(Type Narrowing).
 */
export type ApiResult<T> =
  | {
      data: T;
      error: null;
      meta?: Record<string, unknown>;
    }
  | {
      data: null;
      error: HttpErrorData;
      meta?: undefined;
    };

/**
 * 낙관적 락(Optimistic Lock) 기반 DB 갱신 결과 판별 유니온
 *
 * - updated: expectedVersion 일치로 정상 갱신 완료
 * - not_found: 대상 레코드가 존재하지 않거나 이미 소프트 삭제됨 (404)
 * - conflict: 대상 레코드는 활성 상태이나 DB 최신 버전과 expectedVersion 불일치 (409)
 */
export type OptimisticUpdateResult<T> =
  | { status: "updated"; data: T }
  | { status: "not_found" }
  | { status: "conflict"; currentVersion: number };
