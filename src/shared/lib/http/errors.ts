import type { ErrorCode, HttpErrorData } from "./types";

/**
 * 표준 Error 객체에 HTTP 상태 정보(status, code, details)를 확장한 타입
 * - 순수 함수로 생성되지만 표준 Error 인스턴스이므로 try-catch문에서 정상 포착됩니다.
 */
export type HttpErrorObject = Error &
  HttpErrorData & {
    readonly isHttpError: true;
  };

/**
 * HTTP 에러 객체를 생성하는 기본 팩토리 함수
 *
 * 복잡한 클래스 상속(class CustomError extends Error) 대신,
 * 표준 Error 인스턴스에 필요한 HTTP 메타데이터를 불변 형태로 결합(Object.assign)합니다.
 *
 * @param status HTTP 상태 코드 (e.g. 400, 404, 500)
 * @param message 사용자에게 보여줄 에러 메시지
 * @param code 기계 판독용 에러 코드 (e.g. 'NOT_FOUND')
 * @param details 유효성 검증 실패 상세 정보 등 부가 데이터
 */
export const createHttpError = (
  status: number,
  message: string,
  code: ErrorCode | string = "INTERNAL_SERVER_ERROR",
  details?: unknown
): HttpErrorObject => {
  const error = new Error(message);
  return Object.assign(error, {
    status,
    code,
    details,
    isHttpError: true as const,
  });
};

/** 400 Bad Request: 클라이언트의 요청 문법이 잘못되었거나 필수 값이 누락되었을 때 사용 */
export const badRequest = (message: string = "잘못된 요청입니다.", details?: unknown) =>
  createHttpError(400, message, "BAD_REQUEST", details);

/** 401 Unauthorized: 인증이 필요하거나 로그인 세션/토큰이 만료되었을 때 사용 */
export const unauthorized = (message: string = "인증이 필요합니다.", details?: unknown) =>
  createHttpError(401, message, "UNAUTHORIZED", details);

/** 403 Forbidden: 로그인은 되어 있으나 해당 리소스에 접근 권한이 없을 때 사용 */
export const forbidden = (message: string = "접근 권한이 없습니다.", details?: unknown) =>
  createHttpError(403, message, "FORBIDDEN", details);

/** 404 Not Found: 요청한 데이터(폼 ID 등)를 데이터베이스나 서버에서 찾을 수 없을 때 사용 */
export const notFound = (message: string = "대상을 찾을 수 없습니다.", details?: unknown) =>
  createHttpError(404, message, "NOT_FOUND", details);

/** 409 Conflict: 이미 존재하는 데이터와 충돌이 발생했을 때 사용 (e.g. 폼 이름 중복) */
export const conflict = (message: string = "이미 존재하는 리소스입니다.", details?: unknown) =>
  createHttpError(409, message, "CONFLICT", details);

/** 422 Unprocessable Entity: Zod 스키마 검증에 실패하여 입력 형식이 유효하지 않을 때 사용 */
export const validationError = (
  message: string = "유효성 검증에 실패했습니다.",
  details?: unknown
) => createHttpError(422, message, "VALIDATION_ERROR", details);

/** 500 Internal Server Error: 서버 내부 로직이나 DB/외부 API 장애 시 사용 */
export const internalError = (
  message: string = "서버 내부 오류가 발생했습니다.",
  details?: unknown
) => createHttpError(500, message, "INTERNAL_SERVER_ERROR", details);

/**
 * 전달받은 에러가 createHttpError로 생성된 HttpErrorObject인지 검사하는 타입 가드 함수
 *
 * catch(error) 블록에서 unknown 타입의 error를 안전하게 분기할 때 사용합니다.
 */
export const isHttpError = (error: unknown): error is HttpErrorObject => {
  return (
    typeof error === "object" &&
    error !== null &&
    "isHttpError" in error &&
    (error as Record<string, unknown>).isHttpError === true
  );
};
