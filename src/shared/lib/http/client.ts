import { createHttpError, isHttpError } from "./errors";

/**
 * httpClient 요청 옵션 인터페이스
 * - 표준 fetch의 RequestInit 옵션을 상속받으며, 편리한 쿼리 파라미터(params)를 지원합니다.
 */
export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** URL 뒤에 붙을 쿼리 스트링 객체 (e.g. { page: 1, search: '신청서' } -> ?page=1&search=신청서) */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * 쿼리 파라미터 객체를 URL 쿼리 스트링으로 직렬화하는 내부 헬퍼 함수
 */
const buildUrl = (
  url: string,
  params?: Record<string, string | number | boolean | undefined>
): string => {
  if (!params) return url;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  if (!queryString) return url;

  return url.includes("?") ? `${url}&${queryString}` : `${url}?${queryString}`;
};

/**
 * 표준 fetch를 감싸 모든 비동기 통신을 처리하는 코어 요청 함수
 *
 * 1. URL 쿼리 파라미터 자동 조합
 * 2. JSON / FormData 자동 판별 및 Content-Type 헤더 설정
 * 3. 성공 응답(2xx) 시 순수 데이터(T)를 바로 반환
 * 4. 실패 응답(4xx, 5xx) 및 네트워크 단절 시 표준 HttpErrorObject를 일관되게 throw
 *    -> TanStack Query의 isError, retry, error 상태 머신과 100% 직통 연동됩니다.
 */
const request = async <T>(
  url: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> => {
  const { params, headers, ...restOptions } = options;
  const fullUrl = buildUrl(url, params);

  // 헤더 설정 (FormData가 아닐 경우 기본 application/json 적용)
  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  // Body 직렬화
  const serializedBody =
    body !== undefined ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined;

  try {
    const response = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      ...(serializedBody !== undefined ? { body: serializedBody } : {}),
      ...restOptions,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");

    // JSON 파싱 시도 (실패 시 null)
    const payload = isJson ? await response.json().catch(() => null) : null;

    // HTTP 상태 코드가 2xx가 아닌 에러 응답(400, 404, 500 등)인 경우
    if (!response.ok) {
      const status = response.status;
      const code = payload?.error?.code ?? `HTTP_${response.status}`;
      const message = payload?.error?.message ?? response.statusText ?? "요청 처리에 실패했습니다.";
      const details = payload?.error?.details;

      throw createHttpError(status, message, code, details);
    }

    // 성공 응답 처리 1: 서버가 { success: true, data: T, meta } 규격을 반환한 경우 순수 data 추출
    if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
      return payload.data as T;
    }

    // 성공 응답 처리 2: 일반 JSON 데이터를 바로 반환한 경우
    return payload as T;
  } catch (err) {
    // 이미 정규화된 HttpErrorObject인 경우 그대로 전파
    if (isHttpError(err)) {
      throw err;
    }

    // 인터넷 끊김, CORS 에러 등 브라우저 단의 네트워크 예외 발생 시 표준 HttpErrorObject로 변환하여 throw
    const message =
      err instanceof Error ? err.message : "네트워크 연결 또는 요청 처리에 실패했습니다.";
    throw createHttpError(0, message, "NETWORK_ERROR");
  }
};

/**
 * 클라이언트 컴포넌트 및 TanStack Query 훅에서 사용하는 공통 HTTP 통신 모듈
 *
 * 성공 시 순수 데이터(T)를 반환하고, 실패 시 정규화된 HttpErrorObject를 throw하여
 * TanStack Query의 isError, error 상태와 100% 네이티브로 직통 연동됩니다.
 */
export const httpClient = {
  /** GET 요청: 리소스 조회 */
  get: <T>(url: string, options?: RequestOptions): Promise<T> =>
    request<T>(url, "GET", undefined, options),

  /** POST 요청: 신규 리소스 생성 또는 작업 실행 */
  post: <T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(url, "POST", body, options),

  /** PUT 요청: 리소스 전체 교체/수정 */
  put: <T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(url, "PUT", body, options),

  /** PATCH 요청: 리소스 일부 수정 */
  patch: <T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(url, "PATCH", body, options),

  /** DELETE 요청: 리소스 삭제 */
  delete: <T>(url: string, options?: RequestOptions): Promise<T> =>
    request<T>(url, "DELETE", undefined, options),
};
