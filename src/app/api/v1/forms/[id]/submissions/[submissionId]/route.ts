import type { NextRequest } from "next/server";
import { z } from "zod";
import { findFormById } from "@/entities/form/server";
import { extractActiveFields, validateSubmissionData } from "@/entities/form";
import { extractSubmissionPayload } from "@/entities/form-submission";
import {
  findSubmissionById,
  softDeleteSubmissionById,
  updateSubmissionById,
} from "@/entities/form-submission/server";
import {
  apiResponse,
  badRequest,
  notFound,
  parseRequestData,
  withErrorHandler,
} from "@/shared/lib/http";

interface RouteContext {
  params: Promise<{
    id: string;
    submissionId: string;
  }>;
}

/**
 * 단건 응답 라우트 경로 파라미터 검증 스키마
 */
const submissionRouteParamsSchema = z.object({
  id: z.uuid("올바른 폼 ID(UUID) 형식이 아닙니다."),
  submissionId: z.uuid("올바른 응답 ID(UUID) 형식이 아닙니다."),
});

/**
 * GET /api/v1/forms/[id]/submissions/[submissionId]
 *
 * 특정 폼의 단건 응답 상세 데이터를 조회합니다.
 *
 * @param _req NextRequest 객체 (미사용)
 * @param context URL 파라미터 (id: 폼 식별자, submissionId: 응답 식별자)
 * @returns 200 OK와 함께 FormSubmission 객체 반환
 */
export const GET = withErrorHandler(async (_req: NextRequest, context: RouteContext) => {
  const { id, submissionId } = parseRequestData(
    submissionRouteParamsSchema,
    await context.params,
    "올바른 경로 식별자(UUID)가 아닙니다."
  );

  // 1. 대상 폼 및 단건 응답 조회 (id는 UUID)
  const [form, submission] = await Promise.all([
    findFormById(id),
    findSubmissionById(submissionId),
  ]);

  if (!form) {
    throw notFound("존재하지 않거나 삭제된 폼입니다.");
  }

  if (!submission || submission.formId !== form.id) {
    throw notFound("존재하지 않거나 삭제된 응답입니다.");
  }

  return apiResponse.ok(submission);
});

/**
 * PATCH /api/v1/forms/[id]/submissions/[submissionId]
 *
 * 기제출된 응답 데이터를 수정합니다.
 * 수정 데이터는 해당 폼의 필드 메타데이터 기반 동적 Zod 스키마로 재검증됩니다.
 *
 * @param req 클라이언트의 JSON 요청 본문 ({ data: Record<string, unknown> } 또는 Key-Value 객체)
 * @param context URL 파라미터 (id: 폼 식별자, submissionId: 응답 식별자)
 * @returns 200 OK와 함께 갱신된 FormSubmission 객체 반환
 */
export const PATCH = withErrorHandler(async (req: NextRequest, context: RouteContext) => {
  const { id, submissionId } = parseRequestData(
    submissionRouteParamsSchema,
    await context.params,
    "올바른 경로 식별자(UUID)가 아닙니다."
  );

  // 1. 대상 폼 및 기존 응답 존재 여부 확인 (id는 UUID)
  const [form, existingSubmission] = await Promise.all([
    findFormById(id),
    findSubmissionById(submissionId),
  ]);

  if (!form) {
    throw notFound("존재하지 않거나 삭제된 폼입니다.");
  }

  if (!existingSubmission || existingSubmission.formId !== form.id) {
    throw notFound("존재하지 않거나 삭제된 응답입니다.");
  }

  // 2. 요청 본문 파싱
  const body: unknown = await req.json();
  const rawData = extractSubmissionPayload(body);

  // 3. 폼 필드 스키마 기반 런타임 동적 Zod 유효성 검증
  const fields = extractActiveFields(form);
  const validationResult = validateSubmissionData(fields, rawData);

  if (!validationResult.isValid) {
    throw badRequest("수정 데이터 검증에 실패했습니다.", validationResult.errors);
  }

  // 4. 데이터베이스 갱신 (updatedAt은 중앙 DB 시계로 자동 갱신됨)
  const updatedSubmission = await updateSubmissionById(submissionId, {
    data: validationResult.cleanedData ?? {},
  });

  if (!updatedSubmission) {
    throw notFound("수정 대상 응답을 찾을 수 없습니다.");
  }

  return apiResponse.ok(updatedSubmission);
});

/**
 * DELETE /api/v1/forms/[id]/submissions/[submissionId]
 *
 * 특정 응답을 소프트 삭제(deletedAt 컬럼 갱신) 처리합니다.
 *
 * @param _req NextRequest 객체 (미사용)
 * @param context URL 파라미터 (id: 폼 식별자, submissionId: 응답 식별자)
 * @returns 200 OK와 함께 소프트 삭제된 FormSubmission 객체 반환
 */
export const DELETE = withErrorHandler(async (_req: NextRequest, context: RouteContext) => {
  const { id, submissionId } = parseRequestData(
    submissionRouteParamsSchema,
    await context.params,
    "올바른 경로 식별자(UUID)가 아닙니다."
  );

  // 1. 대상 폼 및 기존 응답 존재 및 폼 일치 검증 (id는 UUID)
  const [form, existingSubmission] = await Promise.all([
    findFormById(id),
    findSubmissionById(submissionId),
  ]);

  if (!form) {
    throw notFound("존재하지 않거나 삭제된 폼입니다.");
  }

  if (!existingSubmission || existingSubmission.formId !== form.id) {
    throw notFound("존재하지 않거나 이미 삭제된 응답입니다.");
  }

  // 2. 소프트 삭제 수행
  const deletedSubmission = await softDeleteSubmissionById(submissionId);
  if (!deletedSubmission) {
    throw notFound("삭제 대상 응답을 찾을 수 없습니다.");
  }

  return apiResponse.ok(deletedSubmission);
});
