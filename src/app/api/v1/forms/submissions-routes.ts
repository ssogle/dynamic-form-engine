import { extractActiveFields, validateSubmissionData } from "@/entities/form";
import { extractSubmissionPayload, submissionQuerySchema } from "@/entities/form-submission";
import {
  findSubmissionsPaginated,
  insertSubmission,
  softDeleteSubmissionById,
  updateSubmissionById,
} from "@/entities/form-submission/server";
import { apiResponse, badRequest, notFound } from "@/shared/lib/http";
import { createSubRouter } from "../_lib/create-api-router";
import { parseQueryParams, readJsonBody } from "../_lib/request-helpers";
import type { FormsRouterVariables } from "./forms-middleware";

/**
 * 특정 폼에 귀속된 응답(Submissions) CRUD를 담당하는 Hono 서브 라우터
 *
 * 설계 원칙:
 * - 모든 경로는 상위 `formsApp` 루트(`/`)에 마운트되므로 `/:id/submissions*` 전체 상대 경로를 명시합니다.
 * - `:id` / `:submissionId` UUID 검증과 엔티티 사전 로드(`form`, `submission`)는
 *   상위 `forms-middleware`가 완료한 상태로 진입하므로 핸들러는 순수 도메인 규칙과 동적 Zod 검증에만 집중합니다.
 */
export const submissionsRoutes = createSubRouter<FormsRouterVariables>();

/**
 * 특정 폼의 응답 목록 페이지네이션, 멀티 정렬, 컬럼 필터, 배치 ID 조회
 * @route GET /api/v1/forms/:id/submissions
 */
submissionsRoutes.get("/:id/submissions", async (c) => {
  const form = c.get("form");
  const queryParams = parseQueryParams(
    c,
    submissionQuerySchema,
    "유효하지 않은 조회 파라미터입니다."
  );

  const paginatedResult = await findSubmissionsPaginated(form.id, queryParams);
  return apiResponse.ok(paginatedResult);
});

/**
 * 특정 발행 폼에 신규 응답 제출
 * @route POST /api/v1/forms/:id/submissions
 */
submissionsRoutes.post("/:id/submissions", async (c) => {
  const form = c.get("form");

  // 미발행 초안 상태의 폼에는 컨슈머 응답 제출을 허용하지 않습니다.
  if (!form.publishedAt) {
    throw badRequest("발행되지 않은 폼에는 응답을 제출할 수 없습니다.");
  }

  const rawBody = await readJsonBody(c);
  const submissionPayload = extractSubmissionPayload(rawBody);

  // 대상 폼의 활성 필드 정의로부터 런타임 동적 Zod 스키마를 조립해 입력값을 검증/정제합니다.
  const activeFields = extractActiveFields(form);
  const validationResult = validateSubmissionData(activeFields, submissionPayload);

  if (!validationResult.isValid) {
    throw badRequest("제출된 폼 응답 데이터가 유효하지 않습니다.", validationResult.errors);
  }

  const createdSubmission = await insertSubmission({
    formId: form.id,
    data: validationResult.cleanedData ?? {},
  });

  return apiResponse.created(createdSubmission);
});

/**
 * 특정 폼의 단일 응답 상세 조회
 * @route GET /api/v1/forms/:id/submissions/:submissionId
 */
submissionsRoutes.get("/:id/submissions/:submissionId", (c) => {
  // 선행 `requireFormSubmission` 미들웨어가 폼 귀속 관계(`submission.formId === form.id`)까지 검증 완료한 상태입니다.
  const submission = c.get("submission");
  return apiResponse.ok(submission);
});

/**
 * 특정 폼의 단일 응답 데이터 수정
 * @route PATCH /api/v1/forms/:id/submissions/:submissionId
 */
submissionsRoutes.patch("/:id/submissions/:submissionId", async (c) => {
  const form = c.get("form");
  const submission = c.get("submission");

  const rawBody = await readJsonBody(c);
  const submissionPayload = extractSubmissionPayload(rawBody);

  // 수정 시에도 폼의 최신 활성 필드 정의를 기준으로 동적 Zod 검증 및 잉여 키 정제를 수행합니다.
  const activeFields = extractActiveFields(form);
  const validationResult = validateSubmissionData(activeFields, submissionPayload);

  if (!validationResult.isValid) {
    throw badRequest("수정하려는 폼 응답 데이터가 유효하지 않습니다.", validationResult.errors);
  }

  const updatedSubmission = await updateSubmissionById(submission.id, {
    data: validationResult.cleanedData ?? {},
  });

  if (!updatedSubmission) {
    throw notFound("수정 대상 응답 데이터를 찾을 수 없습니다.");
  }

  return apiResponse.ok(updatedSubmission);
});

/**
 * 특정 폼의 단일 응답 소프트 삭제 (`deletedAt` 갱신 및 관계 엣지 정리)
 * @route DELETE /api/v1/forms/:id/submissions/:submissionId
 */
submissionsRoutes.delete("/:id/submissions/:submissionId", async (c) => {
  const submission = c.get("submission");
  const deletedSubmission = await softDeleteSubmissionById(submission.id);

  if (!deletedSubmission) {
    throw notFound("삭제할 응답 데이터를 찾을 수 없습니다.");
  }

  return apiResponse.ok(deletedSubmission);
});
