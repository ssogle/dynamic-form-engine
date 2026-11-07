import type { NextRequest } from "next/server";
import { findFormById } from "@/entities/form/server";
import type { CoreFormField } from "@/entities/form";
import { findSubmissionsByFormId, insertSubmission } from "@/entities/form-submission/server";
import { validateSubmissionData } from "@/features/render-dynamic-form";
import { apiResponse, badRequest, notFound, withErrorHandler } from "@/shared/lib/http";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 폼 객체로부터 코어 필드 정의 배열을 안전하게 추출합니다.
 */
function extractFieldsFromForm(form: {
  fields?: unknown;
  schemaDefinition?: unknown;
}): CoreFormField[] {
  if (Array.isArray(form.fields)) {
    return form.fields as CoreFormField[];
  }

  if (
    form.schemaDefinition !== null &&
    typeof form.schemaDefinition === "object" &&
    "fields" in form.schemaDefinition &&
    Array.isArray((form.schemaDefinition as { fields?: unknown }).fields)
  ) {
    return (form.schemaDefinition as { fields: CoreFormField[] }).fields;
  }

  return [];
}

/**
 * GET /api/v1/forms/[id]/submissions
 *
 * 특정 폼에 귀속된 소프트 삭제되지 않은 활성 응답 목록을 생성 최신순으로 조회하여 반환합니다.
 *
 * @param _req NextRequest 객체 (미사용)
 * @param context URL 파라미터 (id: 폼 식별자)
 * @returns 200 OK와 함께 FormSubmission[] 배열 반환
 */
export const GET = withErrorHandler(async (_req: NextRequest, context: RouteContext) => {
  const { id } = await context.params;

  // 1. 대상 폼 존재 여부 확인
  const form = await findFormById(id);
  if (!form) {
    throw notFound("존재하지 않거나 삭제된 폼입니다.");
  }

  // 2. 응답 목록 조회
  const submissions = await findSubmissionsByFormId(id);
  return apiResponse.ok(submissions);
});

/**
 * POST /api/v1/forms/[id]/submissions
 *
 * 발행된 폼에 대해 신규 응답 데이터를 제출하고 데이터베이스에 영속화합니다.
 * 제출된 원시 데이터는 해당 폼의 필드 메타데이터 기반 동적 Zod 스키마로 검증되며,
 * 미발행 폼이거나 유효성 검사 실패 시 적절한 4xx 에러를 반환합니다.
 *
 * @param req 클라이언트의 JSON 요청 본문 ({ data: Record<string, unknown> } 또는 Key-Value 객체)
 * @param context URL 파라미터 (id: 폼 식별자)
 * @returns 201 Created와 함께 영속화된 단일 FormSubmission 객체 반환
 */
export const POST = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
  const { id } = await context.params;

  // 1. 대상 폼 조회 및 발행 상태 검증
  const form = await findFormById(id);
  if (!form) {
    throw notFound("존재하지 않거나 삭제된 폼입니다.");
  }

  if (!form.publishedAt) {
    throw badRequest("아직 발행되지 않은 폼에는 응답을 제출할 수 없습니다.");
  }

  // 2. 요청 본문 파싱 (래핑된 { data: {...} } 형태와 직접 Key-Value 형태 모두 호환)
  const body: unknown = await req.json();
  let rawData: Record<string, unknown> = {};

  if (body !== null && typeof body === "object") {
    if ("data" in body && body.data !== null && typeof body.data === "object") {
      rawData = body.data as Record<string, unknown>;
    } else {
      rawData = body as Record<string, unknown>;
    }
  }

  // 3. 폼 필드 스키마 기반 런타임 동적 Zod 유효성 검증
  const fields = extractFieldsFromForm(form);
  const validationResult = validateSubmissionData(fields, rawData);

  if (!validationResult.isValid) {
    throw badRequest("제출 데이터 검증에 실패했습니다.", validationResult.errors);
  }

  // 4. 정제된 데이터를 데이터베이스에 영속화
  const createdSubmission = await insertSubmission({
    formId: id,
    data: validationResult.cleanedData ?? {},
  });

  return apiResponse.created(createdSubmission);
});
