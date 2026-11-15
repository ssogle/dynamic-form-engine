import { Hono } from "hono";
import type { BlankSchema } from "hono/types";
import { apiResponse, notFound } from "@/shared/lib/http";

/**
 * Hono API 루트 라우터 생성 옵션
 */
export interface CreateApiRouterOptions {
  /**
   * Next.js Catch-All Route(`[[...route]]/route.ts`)와 매칭될 기본 URL 접두사
   * - 생략 시 루트(`/`)가 적용되며, Hono 내부 `mergePath`를 통해 일관된 라우터 타입을 유지합니다.
   * @example "/api/v1/forms"
   */
  basePath?: string;
}

/**
 * `handleRoute`가 요구하는 최소 라우터 인터페이스
 * - Hono 인스턴스 전체 제네릭에 의존하지 않고 `fetch` 메서드만 요구하여,
 *   Any 타입 없이 다양한 `Variables` 제네릭을 가진 라우터를 안전하게 어댑팅합니다.
 */
export interface FetchableRouter {
  fetch: (request: Request) => Response | Promise<Response>;
}

/**
 * 프로젝트 표준 에러/404 포맷(`apiResponse.fail`)이 통합된 최상위 Hono API 라우터 팩토리
 *
 * 동작 원리:
 * 1. `TVariables` 제네릭으로 미들웨어(`c.set`)와 핸들러(`c.get`) 간의 컨텍스트 타입을 컴파일 타임에 보장합니다.
 * 2. `basePath`를 조건부 분기 대신 항상 적용(`options?.basePath ?? "/"`)하여 반환 타입이 유니온으로 넓어지는 것을 방지합니다.
 * 3. `onError`와 `notFound`를 프로젝트 기존 `apiResponse.fail` 및 `notFound()` 규격으로 바인딩하여,
 *    클라이언트(`httpClient`)가 기대하는 `{ success: false, error: { code, message, details } }` 계약을 100% 보존합니다.
 *
 * @template TVariables 미들웨어에서 `c.set` / `c.get`으로 공유할 컨텍스트 변수 객체 타입
 * @param options `basePath` 등 루트 라우터 구성 옵션
 * @returns 표준 에러/404 핸들러가 내장된 Hono 라우터 인스턴스
 */
export const createApiRouter = <TVariables extends object = Record<never, never>>(
  options?: CreateApiRouterOptions
): Hono<{ Variables: TVariables }, BlankSchema, string> => {
  // 조건부 삼항 연산자 대신 기본값("/")을 사용하여 단일 반환 타입을 유지하고,
  // Next.js App Router의 실제 요청 URL 경로와 정확히 일치하도록 basePath를 고정합니다.
  const app = new Hono<{ Variables: TVariables }>().basePath(options?.basePath ?? "/");

  // 라우터 및 하위 미들웨어/핸들러에서 throw된 모든 예외(HttpErrorObject, 일반 Error 등)를
  // 기존의 withErrorHandler와 동일한 포맷의 JSON 응답으로 변환합니다.
  app.onError((error) => {
    return apiResponse.fail(error);
  });

  // 정의되지 않은 경로나 메서드로 진입한 경우 Next.js/Hono 기본 text 404 대신
  // 프로젝트 표준 NOT_FOUND JSON 응답을 반환합니다.
  app.notFound((c) => {
    return apiResponse.fail(
      notFound(`요청한 API 경로를 찾을 수 없습니다: ${c.req.method} ${c.req.path}`)
    );
  });

  return app;
};

/**
 * 최상위 라우터에 `.route("/", subRouter)`로 조립하기 위한 경량 Hono 서브 라우터 팩토리
 *
 * 주의사항 (중요):
 * - Hono 내부 구현상 서브 라우터에 별도 `onError`를 등록하면 `.route()` 결합 시 핸들러마다
 *   추가 `compose` 래퍼가 감싸지고 예외가 상위 루트 라우터의 `onError`로 전파되지 않습니다.
 * - 따라서 서브 라우터에는 의도적으로 `onError`와 `notFound`를 등록하지 않고 순수 라우트 정의 용도로만 생성하여,
 *   예외 처리 및 404 응답이 최상위 `createApiRouter`로 단일 위임되도록 보장합니다.
 *
 * @template TVariables 부모 루트 라우터와 동일한 컨텍스트 변수 객체 타입
 * @returns 에러/404 핸들러가 없는 순수 Hono 서브 라우터 인스턴스
 */
export const createSubRouter = <TVariables extends object = Record<never, never>>(): Hono<
  { Variables: TVariables },
  BlankSchema,
  "/"
> => {
  return new Hono<{ Variables: TVariables }>();
};

/**
 * Hono 라우터 인스턴스를 Next.js App Router Route Handler(`GET`, `POST`, `PATCH`, `DELETE`)로 변환하는 어댑터
 *
 * 선정 이유:
 * - `hono/vercel`의 `handle` 함수가 Hono 4.x에서 `@deprecated` 처리되어 ESLint `no-deprecated` 경고를 유발하며,
 *   내부 구현 자체가 단순히 `(app) => (req) => app.fetch(req)` 위임에 불과합니다.
 * - 별도 외부 어댑터 패키지(`@hono/vercel`) 추가 없이 Web Fetch API 표준(`Request -> Promise<Response>`)을
 *   직접 연결하여 제로 의존성과 Next.js 16 Route Handler 타입 호환성을 동시에 확보합니다.
 *
 * @param app `fetch(request)` 메서드를 제공하는 Hono API 라우터 인스턴스
 * @returns Next.js Route Handler 시그니처와 호환되는 비동기 요청 처리 함수
 */
export const handleRoute = (app: FetchableRouter): ((request: Request) => Promise<Response>) => {
  return async (request: Request) => {
    return await app.fetch(request);
  };
};
