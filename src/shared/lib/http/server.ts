import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, isHttpError } from "./errors";

/**
 * API 경계(Route Handler 등)에서 경로 파라미터, 쿼리 파라미터 또는 요청 본문을 Zod 스키마로 일괄 파싱합니다.
 *
 * 검증에 성공하면 스키마 타입이 좁혀진 안전한 데이터를 반환하고,
 * 실패하면 필드별 오류 상세(details)가 포함된 400 Bad Request(HttpErrorObject)를 즉시 던져
 * 내부 서비스/DB 계층으로 잘못된 입력이 흘러들어가지 않도록 차단합니다.
 *
 * @param schema 적용할 Zod 검증 스키마
 * @param input 파싱할 미검증 원시 입력값
 * @param errorMessage 검증 실패 시 클라이언트에 반환할 대표 오류 메시지
 * @returns 검증 및 변환이 완료된 타입 안전 데이터
 */
export const parseRequestData = <TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  errorMessage: string = "요청 형식이 올바르지 않습니다."
): z.infer<TSchema> => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(errorMessage, z.flattenError(parsed.error).fieldErrors);
  }
  return parsed.data;
};

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
    // 프로덕션 환경에서는 DB 연결 문자열, SQL 제약 조건, 외부 API 원시 오류 등이
    // 클라이언트로 직접 노출되지 않도록 서버 로그에만 기록하고 일반화된 안내 문구를 반환합니다.
    if (error instanceof Error) {
      const isProduction = process.env.NODE_ENV === "production";
      if (isProduction) {
        console.error("[API Internal Error]", error);
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: isProduction ? "서버 처리 중 오류가 발생했습니다." : error.message,
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
