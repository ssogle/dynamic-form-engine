import {
  extractActiveFields,
  formsListQuerySchema,
  insertFormSchema,
  publishFormBodySchema,
  updateFormSchema,
  validateFormSchemaTransition,
} from "@/entities/form";
import {
  findActiveForms,
  findPublishedForms,
  insertForm,
  publishFormById,
  softDeleteFormById,
  updateFormById,
} from "@/entities/form/server";
import { hasSubmissionsByFormId } from "@/entities/form-submission/server";
import { apiResponse, badRequest, conflict, notFound } from "@/shared/lib/http";
import { createSubRouter } from "../_lib/create-api-router";
import { parseJsonBody, parseQueryParams } from "../_lib/request-helpers";
import type { FormsRouterVariables } from "./forms-middleware";

/**
 * 폼 메타데이터 및 발행 lifecycle을 담당하는 Hono 서브 라우터
 *
 * 담당 엔드포인트:
 * - `GET /`: 전체 활성 폼 또는 발행된 폼 목록 조회
 * - `POST /`: 신규 폼 스키마 생성 (`insertFormSchema` 검증)
 * - `GET /:id`: 단건 폼 상세 조회 (`requireForm` 미들웨어로 선조회 완료)
 * - `PATCH /:id`: 폼 메타데이터/스키마 부분 수정 (`updateFormSchema` 검증)
 * - `DELETE /:id`: 폼 소프트 삭제
 * - `POST /:id/publish`: 폼 공식 발행 및 초안 회수
 */
export const formsRoutes = createSubRouter<FormsRouterVariables>();

/**
 * 전체 활성 폼 목록 또는 발행된 폼 목록 조회
 * @route GET /api/v1/forms
 */
formsRoutes.get("/", async (c) => {
  const { published } = parseQueryParams(c, formsListQuerySchema);
  const formsList = published === "true" ? await findPublishedForms() : await findActiveForms();
  return apiResponse.ok(formsList);
});

/**
 * 신규 폼 생성
 * @route POST /api/v1/forms
 */
formsRoutes.post("/", async (c) => {
  const validatedData = await parseJsonBody(c, insertFormSchema, "유효하지 않은 폼 데이터입니다.");
  const createdForm = await insertForm(validatedData);
  return apiResponse.created(createdForm);
});

/**
 * 특정 폼 단건 상세 조회
 * @route GET /api/v1/forms/:id
 */
formsRoutes.get("/:id", (c) => {
  // 선행 `validateFormIdParam` + `requireForm` 미들웨어가 존재 검증 및 로드를 완료한 상태입니다.
  const form = c.get("form");
  return apiResponse.ok(form);
});

/**
 * 특정 폼 정보 및 스키마 정의 부분 수정
 * @route PATCH /api/v1/forms/:id
 */
formsRoutes.patch("/:id", async (c) => {
  const form = c.get("form");
  const validatedData = await parseJsonBody(
    c,
    updateFormSchema,
    "유효하지 않은 폼 수정 데이터입니다."
  );

  // 스키마 변경이 포함된 경우 발행 상태 잠금 및 기제출 응답 호환성 보호 규칙을 검증합니다.
  if (validatedData.schemaDefinition) {
    const hasSubmissions =
      form.publishedAt === null ? await hasSubmissionsByFormId(form.id) : false;
    const transitionResult = validateFormSchemaTransition({
      existingForm: form,
      nextSchemaDefinition: validatedData.schemaDefinition,
      hasSubmissions,
    });
    if (transitionResult.error !== null) {
      throw badRequest(transitionResult.error);
    }
  }

  const updateResult = await updateFormById(form.id, validatedData);
  if (updateResult.status === "not_found") {
    throw notFound("수정 대상 폼을 찾을 수 없습니다.");
  }
  if (updateResult.status === "conflict") {
    throw conflict(
      "다른 사용자가 먼저 폼을 수정했습니다. 최신 데이터를 불러온 뒤 다시 시도해 주세요.",
      { currentVersion: updateResult.currentVersion }
    );
  }

  return apiResponse.ok(updateResult.data);
});

/**
 * 특정 폼 소프트 삭제 (deletedAt 갱신)
 * @route DELETE /api/v1/forms/:id
 */
formsRoutes.delete("/:id", async (c) => {
  const form = c.get("form");
  const deletedForm = await softDeleteFormById(form.id);

  if (!deletedForm) {
    throw notFound("삭제할 폼을 찾을 수 없습니다.");
  }

  return apiResponse.ok(deletedForm);
});

/**
 * 폼 공식 발행(`isPublished: true`) 또는 초안 회수(`isPublished: false`)
 * @route POST /api/v1/forms/:id/publish
 */
formsRoutes.post("/:id/publish", async (c) => {
  const form = c.get("form");

  // 빈 본문(`{}` 대체)을 허용하되 손상된 JSON 문자열이나 비불리언 타입은 400으로 차단합니다.
  const { isPublished } = await parseJsonBody(
    c,
    publishFormBodySchema,
    "유효하지 않은 발행 요청 데이터입니다.",
    { allowEmpty: true }
  );

  // 공식 발행 전환 시에만 최소 1개 이상의 활성 필드 존재 여부를 강제 검증합니다.
  if (isPublished) {
    const activeFields = extractActiveFields(form);
    if (activeFields.length === 0) {
      throw badRequest("폼을 발행하려면 최소 1개 이상의 활성 필드가 필요합니다.");
    }
  }

  const updatedForm = await publishFormById(form.id, isPublished);
  if (!updatedForm) {
    throw notFound("발행 대상 폼을 찾을 수 없습니다.");
  }

  return apiResponse.ok(updatedForm);
});
