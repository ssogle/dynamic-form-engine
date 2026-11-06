import type { NextRequest } from "next/server";
import { z } from "zod";
import { updateFormSchema } from "@/entities/form";
import {
  findFormById,
  findFormBySlug,
  softDeleteFormById,
  updateFormById,
} from "@/entities/form/server";
import { apiResponse, badRequest, notFound, withErrorHandler } from "@/shared/lib/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/forms/[id]
 *
 * 지정된 식별자(UUID id 또는 slug)를 가진 활성 폼 1건의 상세 정보를 조회합니다.
 * UUID 형식이면 id로 조회하고, 그 외에는 슬러그(slug)로 자동 판별하여 조회합니다.
 *
 * @param _req NextRequest 요청 객체
 * @param context URL 경로 매개변수 (Promise<{ id: string }>)
 * @returns 200 OK와 함께 Form 객체 반환, 없을 경우 404 Not Found
 */
export const GET = withErrorHandler<RouteContext>(async (_req: NextRequest, context) => {
  const { id } = await context.params;

  const isUuid = UUID_REGEX.test(id);
  const form = isUuid ? await findFormById(id) : await findFormBySlug(id);

  if (!form) {
    throw notFound("요청하신 폼이 존재하지 않거나 삭제되었습니다.");
  }

  return apiResponse.ok(form);
});

/**
 * PATCH /api/v1/forms/[id]
 *
 * 지정된 식별자(id)를 가진 활성 폼의 메타데이터를 부분 수정합니다.
 * Next.js 16 규칙에 따라 context.params를 비동기(await)로 안전하게 언래핑합니다.
 *
 * @param req 부분 수정할 JSON 본문 (title, description, schemaDefinition 등)
 * @param context URL 경로 매개변수 (Promise<{ id: string }>)
 * @returns 200 OK와 함께 수정 완료된 Form 객체 반환
 */
export const PATCH = withErrorHandler<RouteContext>(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const body: unknown = await req.json();
  const parsed = updateFormSchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest(
      "폼 수정 요청 형식이 올바르지 않습니다.",
      z.flattenError(parsed.error).fieldErrors
    );
  }

  const updatedForm = await updateFormById(id, parsed.data);

  if (!updatedForm) {
    throw notFound("수정 대상 폼이 존재하지 않거나 이미 삭제되었습니다.");
  }

  return apiResponse.ok(updatedForm);
});

/**
 * DELETE /api/v1/forms/[id]
 *
 * 지정된 식별자(id)의 폼을 소프트 삭제(Soft Delete)합니다.
 * 실제 데이터베이스 레코드를 파기하지 않고 deletedAt 컬럼에 현재 시각(UTC)을 기록합니다.
 *
 * @param req 요청 객체
 * @param context URL 경로 매개변수 (Promise<{ id: string }>)
 * @returns 200 OK와 함께 소프트 삭제된 Form 객체 반환
 */
export const DELETE = withErrorHandler<RouteContext>(async (_req: NextRequest, context) => {
  const { id } = await context.params;

  const deletedForm = await softDeleteFormById(id);

  if (!deletedForm) {
    throw notFound("삭제 대상 폼이 존재하지 않거나 이미 삭제되었습니다.");
  }

  return apiResponse.ok(deletedForm);
});
