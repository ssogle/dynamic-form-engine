import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Form } from "@/entities/form";
import { findFormById } from "@/entities/form/server";
import type { FormSubmission } from "@/entities/form-submission";
import { findSubmissionById } from "@/entities/form-submission/server";
import { notFound } from "@/shared/lib/http";
import { parseRouteParams } from "../_lib/request-helpers";

/**
 * `/api/v1/forms` 라우터 컨텍스트(`c.set` / `c.get`)에서 공유되는 타입 안전 변수 맵
 *
 * 각 필드는 전처리 미들웨어 실행 이후 핸들러 단계에서 반드시 존재함이 보장되므로,
 * 비선택적(non-optional) 타입으로 정의하여 핸들러 내 불필요한 null/undefined 방어 분기를 제거합니다.
 */
export interface FormsRouterVariables {
  /** 경로 파라미터 `:id` UUID 검증을 통과한 폼 고유 식별자 */
  formId: string;
  /** 경로 파라미터 `:submissionId` UUID 검증을 통과한 응답 고유 식별자 */
  submissionId: string;
  /** `findFormById`로 조회된 활성 폼 엔티티 (소프트 삭제 제외) */
  form: Form;
  /** `findSubmissionById` 및 부모 폼 소속 검증(`submission.formId === form.id`)을 통과한 응답 엔티티 */
  submission: FormSubmission;
}

/**
 * Hono `MiddlewareHandler`용 Forms 라우터 환경 타입 별칭
 */
export type FormsMiddleware = MiddlewareHandler<{ Variables: FormsRouterVariables }>;

/**
 * 동적 경로 파라미터 `:id` 검증용 Zod 스키마 (UUID v4 등 표준 UUID 포맷 검사)
 */
const formIdParamSchema = z.object({
  id: z.uuid("올바른 폼 ID(UUID) 형식이 아닙니다."),
});

/**
 * 동적 경로 파라미터 `:submissionId` 검증용 Zod 스키마
 * - 상위 `/:id/*` 미들웨어가 `:id`를 이미 검증하므로 `:submissionId`만 독립 검증하여 중복 검증을 방지합니다.
 */
const submissionIdParamSchema = z.object({
  submissionId: z.uuid("올바른 응답 ID(UUID) 형식이 아닙니다."),
});

/**
 * 경로 파라미터 `:id`의 UUID 형식을 검증하고 `formId` 컨텍스트 변수에 주입하는 미들웨어
 *
 * 멱등성 가드 동작 원리:
 * - `/:id`와 `/:id/*` 스코프에 각각 등록되지만, 만약 동일 요청 흐름에서 2회 이상 진입하더라도
 *   이미 `c.get("formId")`가 설정되어 있다면 재파싱 없이 즉시 다음 미들웨어로 위임합니다.
 */
export const validateFormIdParam: FormsMiddleware = async (c, next) => {
  // 동일 요청 주기 내 중복 UUID 파싱을 차단하는 멱등성 가드
  const existingFormId = c.get("formId") as string | undefined;
  if (existingFormId) {
    await next();
    return;
  }

  const { id } = parseRouteParams(c, formIdParamSchema);
  c.set("formId", id);
  await next();
};

/**
 * 하위 리소스 경로의 `:submissionId` UUID 형식을 검증하고 `submissionId` 변수에 주입하는 미들웨어
 *
 * 주의:
 * - 반드시 `validateFormIdParam` 이후에 실행되며, `:id`를 다시 검사하지 않고 `:submissionId`만 검증합니다.
 */
export const validateSubmissionIdParam: FormsMiddleware = async (c, next) => {
  const { submissionId } = parseRouteParams(c, submissionIdParamSchema);
  c.set("submissionId", submissionId);
  await next();
};

/**
 * 컨텍스트에 주입된 `formId`로 활성 폼 엔티티를 조회하고 존재하지 않으면 404를 반환하는 미들웨어
 *
 * 적용 대상:
 * - `GET/PATCH/DELETE /:id`
 * - `POST /:id/publish`
 * - `GET/POST /:id/submissions`
 * - (개별 응답 경로 `/:id/submissions/:submissionId`는 `requireFormSubmission`이 병렬 조회를 수행하므로 제외)
 */
export const requireForm: FormsMiddleware = async (c, next) => {
  const formId = c.get("formId");
  const form = await findFormById(formId);

  if (!form) {
    throw notFound("해당 폼을 찾을 수 없습니다.");
  }

  c.set("form", form);
  await next();
};

/**
 * 개별 응답 경로(`/:id/submissions/:submissionId`) 진입 시 부모 폼과 대상 응답을 병렬 조회하고
 * 두 리소스 간의 소속 관계(`submission.formId === form.id`)를 검증하는 미들웨어
 *
 * 성능 및 정확성 설계:
 * - `requireForm` -> `requireSubmission`을 직렬 체이닝할 경우 발생할 수 있는 워터폴 지연을 피하기 위해
 *   `Promise.all`로 두 DB 조회를 동시에 실행합니다.
 * - 응답이 다른 폼에 속해 있거나 소프트 삭제된 경우에도 404 Not Found로 응답하여 리소스 격리를 유지합니다.
 */
export const requireFormSubmission: FormsMiddleware = async (c, next) => {
  const formId = c.get("formId");
  const submissionId = c.get("submissionId");

  const [form, submission] = await Promise.all([
    findFormById(formId),
    findSubmissionById(submissionId),
  ]);

  if (!form) {
    throw notFound("해당 폼을 찾을 수 없습니다.");
  }

  if (!submission || submission.formId !== form.id) {
    throw notFound("해당 응답 데이터를 찾을 수 없습니다.");
  }

  c.set("form", form);
  c.set("submission", submission);
  await next();
};
