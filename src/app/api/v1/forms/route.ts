import type { NextRequest } from "next/server";
import { insertFormSchema } from "@/entities/form";
import { findActiveForms, findPublishedForms, insertForm } from "@/entities/form/server";
import { apiResponse, parseRequestData, withErrorHandler } from "@/shared/lib/http";

/**
 * GET /api/v1/forms
 *
 * 등록된 폼 목록을 생성 일시 최신순으로 조회하여 반환합니다.
 * 쿼리 파라미터 `published=true` 전달 시 공식 발행된 활성 폼만 필터링하여 반환합니다.
 *
 * @param req NextRequest 객체 (쿼리 파라미터 파싱용)
 * @returns 200 OK와 함께 Form[] 배열 반환
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const isPublishedOnly = req.nextUrl.searchParams.get("published") === "true";

  const formList = isPublishedOnly ? await findPublishedForms() : await findActiveForms();
  return apiResponse.ok(formList);
});

/**
 * POST /api/v1/forms
 *
 * 신규 폼 메타데이터를 등록합니다.
 * 요청 본문은 insertFormSchema를 통해 엄격히 검증되며, 검증 실패 시 400 Bad Request를 반환합니다.
 *
 * @param req 클라이언트의 JSON 요청 본문(title, description, schemaDefinition 등)
 * @returns 201 Created와 함께 영속화된 단일 Form 객체 반환
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: unknown = await req.json();
  const parsedData = parseRequestData(
    insertFormSchema,
    body,
    "폼 생성 요청 형식이 올바르지 않습니다."
  );

  const createdForm = await insertForm(parsedData);

  return apiResponse.created(createdForm);
});
