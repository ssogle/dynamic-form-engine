import { NextResponse, type NextRequest } from "next/server";
import { isHttpError } from "./errors";

/**
 * 서버(BFF Route Handler)에서 일관된 JSON 응답을 만들기 위한 유틸리티 헬퍼
 */
export const apiResponse = {
  /**
   * 200 OK: 성공 응답 생성
   * @param data 클라이언트에 반환할 실제 비즈니스 데이터
   * @param meta 페이지네이션 정보 등 부가 메타데이터
   */
  ok: <T>(data: T, meta?: Record<string, unknown>) =>
    NextResponse.json({ success: true, data, meta }, { status: 200 }),

  /**
   * 201 Created: 새로운 리소스 생성 성공 응답 (e.g. 신규 폼 생성, 폼 제출 완료)
   * @param data 생성된 리소스 데이터
   */
  created: <T>(data: T, meta?: Record<string, unknown>) =>
    NextResponse.json({ success: true, data, meta }, { status: 201 }),

  /**
   * 에러 응답 생성:
   * - `isHttpError`인 경우: 해당 에러의 status(400, 404 등)와 code, message, details를 그대로 전달
   * - 일반 `Error`인 경우: 500 상태코드와 에러 메시지 전달
   * - 알 수 없는 예외인 경우: 500 상태코드와 기본 안내 문구 전달
   */
  fail: (error: unknown) => {
    // 1. 우리가 함수형으로 생성한 HttpErrorObject인 경우
    if (isHttpError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined && { details: error.details }),
          },
        },
        { status: error.status }
      );
    }

    // 2. 일반 자바스크립트 Error (e.g. new Error)인 경우
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    // 3. 문자열이나 null 등 규격 외의 예외인 경우
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "알 수 없는 서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  },
};

type RouteHandler<TContext = unknown> = (req: NextRequest, context: TContext) => Promise<Response>;

/**
 * Next.js Route Handler 고차 함수 (Higher-Order Function)
 *
 * 매 route.ts 파일마다 지루하게 try-catch 블록을 반복 작성할 필요 없이,
 * 핸들러 내부에서 발생한 모든 예외(throw badRequest, throw notFound 등)를
 * 자동으로 가로채 적절한 HTTP 상태코드와 표준 JSON 에러로 변환해 줍니다.
 *
 * @example
 * ```ts
 * export const GET = withErrorHandler(async (req, { params }) => {
 *   const form = await getForm(params.id);
 *   if (!form) throw notFound("폼이 없습니다."); // -> 자동으로 404 JSON 반환
 *   return apiResponse.ok(form);                  // -> 200 { success: true, data: form }
 * });
 * ```
 */
export const withErrorHandler = <TContext = unknown>(
  handler: RouteHandler<TContext>
): RouteHandler<TContext> => {
  return async (req: NextRequest, context: TContext) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return apiResponse.fail(error);
    }
  };
};
