import { z } from "zod";
import { badRequest, parseRequestData } from "@/shared/lib/http";

/**
 * Hono `Context`에서 요청 파라미터/쿼리/본문 파싱에 필요한 최소 구조 인터페이스
 * - Hono 라우트 경로(`P`)와 컨텍스트 변수(`Variables`) 제네릭에 관계없이 모든 핸들러와 미들웨어에서
 *   타입 충돌 없이 안전하게 `c`를 전달할 수 있도록 최소 요청 계약만 정의합니다.
 */
export interface RequestContext {
  req: {
    param: () => Record<string, string>;
    query: () => Record<string, string>;
    text: () => Promise<string>;
  };
}

/**
 * JSON 요청 본문 읽기 동작 제어 옵션
 */
export interface ReadJsonBodyOptions {
  /**
   * 본문이 비어 있을 때 에러를 던지지 않고 빈 객체(`{}`)로 대체할지 여부
   * - 예: `POST /:id/publish`처럼 기본값(`isPublished: true`)으로 빈 본문을 허용해야 하는 엔드포인트에서 사용
   * @default false
   */
  allowEmpty?: boolean;
}

/**
 * 동적 URL 경로 파라미터(`c.req.param()`)를 Zod 스키마로 파싱하고 검증합니다.
 *
 * 동작 원리:
 * - 내부적으로 `@/shared/lib/http`의 `parseRequestData`에 위임하여, 검증 실패 시
 *   프로젝트 전역 표준인 `400 BAD_REQUEST`와 필드별 `details` 에러 객체를 throw합니다.
 *
 * @template TSchema 검증에 사용할 Zod 스키마 타입
 * @param c Hono 핸들러 또는 미들웨어 컨텍스트
 * @param schema 경로 파라미터 검증용 Zod 스키마 (Single Source of Truth)
 * @param errorMessage 검증 실패 시 클라이언트에 전달할 최상위 에러 메시지
 * @returns Zod 스키마로 파싱/정규화된 경로 파라미터 객체
 */
export const parseRouteParams = <TSchema extends z.ZodType>(
  c: RequestContext,
  schema: TSchema,
  errorMessage?: string
): z.infer<TSchema> => {
  return parseRequestData(schema, c.req.param(), errorMessage);
};

/**
 * URL 쿼리 스트링(`c.req.query()`)을 Zod 스키마로 파싱하고 검증합니다.
 *
 * 동작 원리:
 * - `c.req.query()`는 누락된 쿼리 키를 `null` 대신 키 자체에서 생략하므로,
 *   Zod의 `.optional()` 및 `.default()` 규칙과 별도 전처리 없이 자연스럽게 호환됩니다.
 *
 * @template TSchema 검증에 사용할 Zod 스키마 타입
 * @param c Hono 핸들러 또는 미들웨어 컨텍스트
 * @param schema 쿼리 파라미터 검증용 Zod 스키마
 * @param errorMessage 검증 실패 시 클라이언트에 전달할 최상위 에러 메시지
 * @returns Zod 스키마로 타입 강제(coerce) 및 기본값 적용이 완료된 쿼리 객체
 */
export const parseQueryParams = <TSchema extends z.ZodType>(
  c: RequestContext,
  schema: TSchema,
  errorMessage?: string
): z.infer<TSchema> => {
  return parseRequestData(schema, c.req.query(), errorMessage);
};

/**
 * HTTP 요청 본문(Body)을 JSON으로 안전하게 파싱하여 반환합니다.
 *
 * `c.req.json()` 대신 `c.req.text()` -> `JSON.parse()`를 사용하는 이유:
 * 1. 빈 본문(`""` 또는 공백)과 손상된 JSON 문법(`"{ broken"`)을 런타임 환경 차이에 무관하게 명확히 구분할 수 있습니다.
 * 2. `allowEmpty: true`인 경우 빈 본문에 한해 `{}`를 반환하되, 잘못된 JSON 문자열이 전달된 경우에는
 *    즉시 `400 BAD_REQUEST`로 차단하여 잘못된 입력이 묵살되지 않도록 보장합니다.
 * 3. `POST /:id/submissions`처럼 폼 스키마에 따라 런타임에 동적 검증이 필요한 경우 Zod 정적 검증 전 단계에서 사용합니다.
 *
 * @param c Hono 핸들러 컨텍스트
 * @param options 빈 본문 허용 여부 등 파싱 옵션
 * @returns 파싱된 원본 JSON 값 (`unknown`)
 * @throws HttpErrorObject 빈 본문(비허용 시) 또는 JSON 문법 오류 시 `400 BAD_REQUEST`
 */
export const readJsonBody = async (
  c: RequestContext,
  options?: ReadJsonBodyOptions
): Promise<unknown> => {
  const rawText = await c.req.text();

  // 공백을 제외한 본문이 완전히 비어 있는 경우 옵션에 따라 빈 객체 또는 400 예외를 분기합니다.
  if (rawText.trim().length === 0) {
    if (options?.allowEmpty) {
      return {};
    }
    throw badRequest("요청 본문이 비어 있거나 올바른 JSON 형식이 아닙니다.");
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw badRequest("요청 본문이 올바른 JSON 형식이 아닙니다.");
  }
};

/**
 * JSON 요청 본문을 읽은 뒤, 도메인 Zod 스키마로 즉시 검증하여 타입이 보장된 데이터를 반환합니다.
 *
 * 동작 원리:
 * 1. `readJsonBody`로 JSON 문법 및 빈 본문 여부를 1차 검증합니다.
 * 2. `parseRequestData`로 도메인 엔티티 스키마(e.g. `insertFormSchema`, `updateFormSchema`)를 적용하여
 *    도메인 단일 진실 원천(SSOT)과 API 입력 검증이 완전히 일치하도록 보장합니다.
 *
 * @template TSchema 검증에 사용할 Zod 스키마 타입
 * @param c Hono 핸들러 컨텍스트
 * @param schema 요청 본문 검증용 도메인 Zod 스키마
 * @param errorMessage 스키마 검증 실패 시 반환할 에러 메시지
 * @param options JSON 읽기 옵션 (`allowEmpty` 등)
 * @returns Zod 검증을 통과한 강타입 요청 본문 데이터
 */
export const parseJsonBody = async <TSchema extends z.ZodType>(
  c: RequestContext,
  schema: TSchema,
  errorMessage?: string,
  options?: ReadJsonBodyOptions
): Promise<z.infer<TSchema>> => {
  const rawBody = await readJsonBody(c, options);
  return parseRequestData(schema, rawBody, errorMessage);
};
