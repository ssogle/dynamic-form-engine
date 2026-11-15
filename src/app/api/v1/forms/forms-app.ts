import { createApiRouter } from "../_lib/create-api-router";
import {
  requireForm,
  requireFormSubmission,
  validateFormIdParam,
  validateSubmissionIdParam,
  type FormsRouterVariables,
} from "./forms-middleware";
import { formsRoutes } from "./forms-routes";
import { submissionsRoutes } from "./submissions-routes";

/**
 * `/api/v1/forms` 도메인 전체를 관장하는 통합 Hono API 앱
 *
 * 조립 및 실행 순서 설계:
 * 1. `basePath: "/api/v1/forms"`를 지정해 Next.js Catch-All Route(`[[...route]]/route.ts`)의
 *    실제 URL 경로와 정확히 일치시키며, 표준 `onError` / `notFound` 핸들러를 상속받습니다.
 * 2. Hono는 미들웨어와 라우트를 등록 순서대로 실행하므로, 반드시 모든 `.use()` 미들웨어를
 *    `.route()` 마운트보다 먼저 등록하여 컨텍스트 변수(`formId`, `form`, `submission`)가 보장되도록 합니다.
 * 3. `validateFormIdParam`은 `/:id`(단일 리소스)와 `/:id/*`(하위 경로 전체)로 스코프를 분리해
 *    중복 등록 없이 `:id`를 검증하고, `/:id/submissions/:submissionId`는 `submissionId`만 추가 검증한 뒤
 *    `Promise.all` 기반 `requireFormSubmission`으로 `findFormById` 중복 호출을 제거합니다.
 * 4. `formsRoutes`와 `submissionsRoutes` 모두 루트(`/`)에 마운트하여 경로 중첩 없이
 *    미들웨어 매칭 스코프와 라우트 경로가 1:1로 일치하도록 고정합니다.
 */
export const formsApp = createApiRouter<FormsRouterVariables>({
  basePath: "/api/v1/forms",
});

// [Step 1] 폼 UUID(`:id`) 형식 검증 스코프 등록
formsApp.use("/:id", validateFormIdParam);
formsApp.use("/:id/*", validateFormIdParam);

// [Step 2] 부모 폼 사전 조회(`requireForm`) 스코프 등록
// - 개별 응답 경로(`/:id/submissions/:submissionId`)는 아래 Step 3에서 병렬 조회하므로 의도적으로 제외합니다.
formsApp.use("/:id", requireForm);
formsApp.use("/:id/publish", requireForm);
formsApp.use("/:id/submissions", requireForm);

// [Step 3] 개별 응답 경로(`:submissionId` 검증 + 폼/응답 병렬 조회 및 소속 검증) 등록
formsApp.use("/:id/submissions/:submissionId", validateSubmissionIdParam, requireFormSubmission);

// [Step 4] 도메인별 서브 라우터를 루트(`/`)에 평탄 마운트 (등록 순서대로 라우팅 테이블에 병합)
formsApp.route("/", formsRoutes);
formsApp.route("/", submissionsRoutes);
