import type { NextRequest } from "next/server";
import { z } from "zod";
import { extractActiveFields } from "@/entities/form";
import { findFormById, publishFormById } from "@/entities/form/server";
import { apiResponse, badRequest, notFound, withErrorHandler } from "@/shared/lib/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 폼 발행 요청 본문 유효성 검증 스키마
 *
 * isPublished: true(발행), false(미발행 초안 회수)
 * 요청 본문이 비어있거나 필드가 누락된 경우 기본값 true(발행)로 처리합니다.
 */
const publishRequestBodySchema = z.object({
  isPublished: z.boolean().default(true),
});

/**
 * POST /api/v1/forms/[id]/publish
 *
 * 지정된 폼의 공식 발행 상태를 토글(발행 또는 초안 회수)합니다.
 *
 * [중앙 시계 권한 및 가드레일 원칙]
 * 1. 클라이언트가 임의의 타임스탬프를 주입할 수 없으며, PostgreSQL 중앙 시계인 sql`now()`로 발행일시를 확정합니다.
 * 2. 발행(isPublished: true) 시 최소 1개 이상의 활성 필드가 존재하는지 검증하여 빈 폼의 유출을 방지합니다.
 * 3. 초안 회수(isPublished: false) 시에는 publishedAt 컬럼을 null로 초기화합니다.
 *
 * @param req 클라이언트 JSON 요청 본문 ({ isPublished?: boolean })
 * @param context URL 경로 매개변수 (Promise<{ id: string }>)
 * @returns 200 OK와 함께 상태 전이된 Form 객체 반환
 */
export const POST = withErrorHandler<RouteContext>(async (req: NextRequest, context) => {
  const { id } = await context.params;

  // 1. 요청 본문 파싱 (본문이 비어있거나 올바르지 않은 JSON이어도 safeParse로 유연하게 처리)
  let rawBody: unknown = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      rawBody = JSON.parse(text);
    }
  } catch {
    throw badRequest("요청 본문이 올바른 JSON 형식이 아닙니다.");
  }

  const parsed = publishRequestBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw badRequest(
      "발행 요청 형식이 올바르지 않습니다.",
      z.flattenError(parsed.error).fieldErrors
    );
  }

  const { isPublished } = parsed.data;

  // 2. 대상 폼 존재 및 소프트 삭제 여부 확인
  const existingForm = await findFormById(id);
  if (!existingForm) {
    throw notFound("요청하신 폼이 존재하지 않거나 이미 삭제되었습니다.");
  }

  // 3. 발행 시 도메인 가드레일: 최소 1개 이상의 활성 필드 필수
  if (isPublished) {
    const activeFields = extractActiveFields(existingForm);
    if (activeFields.length === 0) {
      throw badRequest("최소 1개 이상의 필드가 포함된 폼만 공식 발행할 수 있습니다.");
    }
  }

  // 4. 중앙 DB 시계를 통해 발행/회수 트랜잭션 수행
  const updatedForm = await publishFormById(id, isPublished);
  if (!updatedForm) {
    throw notFound("발행 대상 폼을 갱신하지 못했습니다.");
  }

  return apiResponse.ok(updatedForm);
});
