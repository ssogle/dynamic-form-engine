import type { NextRequest } from "next/server";
import { z } from "zod";
import { findFormById } from "@/entities/form/server";
import { extractActiveFields, validateSubmissionData } from "@/entities/form";
import { findSubmissionsPaginated, insertSubmission } from "@/entities/form-submission/server";
import { submissionQuerySchema } from "@/entities/form-submission";
import { apiResponse, badRequest, notFound, withErrorHandler } from "@/shared/lib/http";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/v1/forms/[id]/submissions
 *
 * 특정 폼에 귀속된 소프트 삭제되지 않은 활성 응답 목록을 페이지네이션, 멀티 정렬, 컬럼 필터를 적용하여 조회합니다.
 * 식별자(id)는 폼 UUID 식별자입니다.
 *
 * @param req NextRequest 객체 (쿼리 파라미터: page, limit, sort, filters)
 * @param context URL 파라미터 (id: 폼 UUID)
 * @returns 200 OK와 함께 PaginatedSubmissionsResponse 객체 반환
 */
export const GET = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
  const { id } = await context.params;

  // 1. 대상 폼 존재 여부 확인 (UUID)
  const form = await findFormById(id);
  if (!form) {
    throw notFound("존재하지 않거나 삭제된 폼입니다.");
  }

  // 2. 쿼리 파라미터 유효성 검증
  const searchParams = req.nextUrl.searchParams;
  const rawQuery = {
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    filters: searchParams.get("filters") ?? undefined,
  };
  const parsed = submissionQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    throw badRequest(
      "요청 쿼리 매개변수가 올바르지 않습니다.",
      z.flattenError(parsed.error).fieldErrors
    );
  }

  // 3. 폼의 실제 UUID(form.id)를 기반으로 페이지네이션 응답 조회
  const paginatedResult = await findSubmissionsPaginated(form.id, parsed.data);
  return apiResponse.ok(paginatedResult);
});

/**
 * POST /api/v1/forms/[id]/submissions
 *
 * 발행된 폼에 대해 신규 응답 데이터를 제출하고 데이터베이스에 영속화합니다.
 * 제출된 원시 데이터는 해당 폼의 필드 메타데이터 기반 동적 Zod 스키마로 검증되며,
 * 미발행 폼이거나 유효성 검사 실패 시 적절한 4xx 에러를 반환합니다.
 * 식별자(id)는 폼 UUID 식별자입니다.
 *
 * @param req 클라이언트의 JSON 요청 본문 ({ data: Record<string, unknown> } 또는 Key-Value 객체)
 * @param context URL 파라미터 (id: 폼 UUID)
 * @returns 201 Created와 함께 영속화된 단일 FormSubmission 객체 반환
 */
export const POST = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
  const { id } = await context.params;

  // 1. 대상 폼 조회 및 발행 상태 검증 (UUID)
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
  const fields = extractActiveFields(form);
  const validationResult = validateSubmissionData(fields, rawData);

  if (!validationResult.isValid) {
    throw badRequest("제출 데이터 검증에 실패했습니다.", validationResult.errors);
  }

  // 4. 정제된 데이터를 데이터베이스에 영속화 (폼의 실제 UUID인 form.id 저장)
  const createdSubmission = await insertSubmission({
    formId: form.id,
    data: validationResult.cleanedData ?? {},
  });

  return apiResponse.created(createdSubmission);
});
