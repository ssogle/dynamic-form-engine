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
 * NDJSON(Newline-Delimited JSON) 스트림 통신 옵션 인터페이스
 */
export interface StreamNdjsonOptions<TEvent> extends RequestOptions {
  /** HTTP 메서드 (기본값: POST) */
  method?: string;
  /** 줄 단위로 파싱된 NDJSON 이벤트 수신 콜백 */
  onEvent: (event: TEvent) => void | Promise<void>;
  /** 마지막 청크 수신 이후 무응답 허용 시간(ms) — 초과 시 스트림 중단 */
  inactivityTimeoutMs?: number;
  /** 전체 스트림 요청 최대 허용 시간(ms) */
  totalTimeoutMs?: number;
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
 * catch 블록에서 포착된 예외를 표준 HttpErrorObject로 정규화합니다.
 */
const normalizeClientError = (err: unknown, fallbackMessage: string) => {
  if (isHttpError(err)) {
    return err;
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return createHttpError(0, message, "NETWORK_ERROR");
};

/**
 * 공통 fetch 호출 및 HTTP 2xx 상태 코드 검증 헬퍼
 *
 * 단건 JSON 요청(request)과 NDJSON 스트림 요청(streamNdjson)이 동일한 URL 조합,
 * 헤더 설정, 에러 페이로드 파싱 규약을 공유하도록 단일화합니다.
 */
const executeFetch = async (
  url: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<Response> => {
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

  const response = await fetch(fullUrl, {
    method,
    headers: requestHeaders,
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
    ...restOptions,
  });

  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json().catch(() => null) : null;
    const status = response.status;
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    const message = payload?.error?.message ?? response.statusText ?? "요청 처리에 실패했습니다.";
    const details = payload?.error?.details;

    throw createHttpError(status, message, code, details);
  }

  return response;
};

/**
 * 표준 fetch를 감싸 모든 비동기 JSON 통신을 처리하는 코어 요청 함수
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
  try {
    const response = await executeFetch(url, method, body, options);
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json().catch(() => null) : null;

    // 성공 응답 처리 1: 서버가 { success: true, data: T, meta } 규격을 반환한 경우 순수 data 추출
    if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
      return payload.data as T;
    }

    // 성공 응답 처리 2: 일반 JSON 데이터를 바로 반환한 경우
    return payload as T;
  } catch (err) {
    throw normalizeClientError(err, "네트워크 연결 또는 요청 처리에 실패했습니다.");
  }
};

/**
 * NDJSON(Newline-Delimited JSON) 스트림 응답을 청크 단위로 읽어 줄별 이벤트를 디스패치합니다.
 *
 * 무활동 타임아웃(inactivityTimeoutMs)과 전체 타임아웃(totalTimeoutMs)을 통해
 * 첫 청크 이후 서버 무응답이나 네트워크 정체로 UI가 영구 Pending 상태에 빠지는 것을 방지합니다.
 */
const streamNdjson = async <TEvent>(
  url: string,
  body: unknown,
  options: StreamNdjsonOptions<TEvent>
): Promise<void> => {
  const {
    method = "POST",
    onEvent,
    inactivityTimeoutMs,
    totalTimeoutMs,
    signal: externalSignal,
    ...restOptions
  } = options;

  const controller = new AbortController();
  let abortReason: "inactivity" | "total" | "external" | null = null;
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  let totalTimer: ReturnType<typeof setTimeout> | null = null;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const triggerAbort = (reason: "inactivity" | "total" | "external") => {
    if (abortReason !== null) return;
    abortReason = reason;
    controller.abort();
    // 일부 환경/모킹 스트림에서는 fetch signal 중단만으로 reader.read()가 즉시 풀리지 않으므로 reader도 함께 취소합니다.
    if (activeReader) {
      void activeReader.cancel().catch(() => undefined);
    }
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer !== null) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
    if (inactivityTimeoutMs && inactivityTimeoutMs > 0) {
      inactivityTimer = setTimeout(() => {
        triggerAbort("inactivity");
      }, inactivityTimeoutMs);
    }
  };

  const onExternalAbort = () => triggerAbort("external");
  if (externalSignal) {
    if (externalSignal.aborted) {
      throw createHttpError(0, "요청이 취소되었습니다.", "ABORTED");
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  if (totalTimeoutMs && totalTimeoutMs > 0) {
    totalTimer = setTimeout(() => {
      triggerAbort("total");
    }, totalTimeoutMs);
  }

  resetInactivityTimer();

  try {
    const response = await executeFetch(url, method, body, {
      ...restOptions,
      signal: controller.signal,
    });

    if (!response.body) {
      throw createHttpError(500, "스트림 응답 본문을 읽을 수 없습니다.", "EMPTY_STREAM_BODY");
    }

    const reader = response.body.getReader();
    activeReader = reader;
    const decoder = new TextDecoder();
    let buffer = "";

    const emitBufferedLines = async (flushRemainder: boolean) => {
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          await onEvent(JSON.parse(line) as TEvent);
        }
        newlineIndex = buffer.indexOf("\n");
      }

      if (flushRemainder) {
        const trailing = buffer.trim();
        buffer = "";
        if (trailing) {
          await onEvent(JSON.parse(trailing) as TEvent);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (abortReason === "inactivity" || abortReason === "total") {
        throw createHttpError(
          408,
          "서버 응답이 지연되어 연결이 중단되었습니다. 다시 시도해 주세요.",
          "STREAM_TIMEOUT"
        );
      }
      if (abortReason === "external") {
        throw createHttpError(0, "요청이 취소되었습니다.", "ABORTED");
      }
      if (done) break;

      resetInactivityTimer();
      buffer += decoder.decode(value, { stream: true });
      await emitBufferedLines(false);
    }

    buffer += decoder.decode();
    await emitBufferedLines(true);
  } catch (err) {
    if (abortReason === "inactivity" || abortReason === "total") {
      throw createHttpError(
        408,
        "서버 응답이 지연되어 연결이 중단되었습니다. 다시 시도해 주세요.",
        "STREAM_TIMEOUT"
      );
    }
    if (abortReason === "external") {
      throw createHttpError(0, "요청이 취소되었습니다.", "ABORTED");
    }
    throw normalizeClientError(err, "스트림 통신 중 오류가 발생했습니다.");
  } finally {
    if (inactivityTimer !== null) clearTimeout(inactivityTimer);
    if (totalTimer !== null) clearTimeout(totalTimer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
    if (activeReader) {
      try {
        activeReader.releaseLock();
      } catch {
        // 이미 해제된 락 무시
      }
    }
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

  /** NDJSON 스트림 요청: 줄바꿈 구분 JSON 청크 실시간 수신 */
  streamNdjson: <TEvent>(
    url: string,
    body: unknown,
    options: StreamNdjsonOptions<TEvent>
  ): Promise<void> => streamNdjson<TEvent>(url, body, options),
};
