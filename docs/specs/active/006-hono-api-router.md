<!-- 아카이브(동결) 전환 시 아래 WARNING 주석을 해제하고 상단 NOTE 블록을 대체하세요 -->
<!--
> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.
-->

# [Spec-006] Hono(Non-RPC) 기반 API v1 라우팅 구조 개편 (`forms` 전환 및 `relations` 로직 분리)

> [!NOTE]
>
> - **상태 (Status)**: Active (기획/구현 중)
> - **브랜치 (Branch)**: `refactor/spec-006-hono-api-router`
> - **작성일 (Created)**: 2026-11-16
> - **완료일 (Archived)**: -

## 1. 배경 및 문제 정의 (Context & Problem Statement)

본 프로젝트는 `entities/*/schema` 및 `features/*/schema`의 Zod 스키마를 **단일 진실 원천(Single Source of Truth, SSOT)**으로 삼아 프론트엔드(폼, 쿼리)와 백엔드(API 경계 검증)가 공통 계약을 공유하는 방향성을 지향합니다. 이 방향이 일관되게 유지되려면 API 경계에서도 정적 Zod 스키마(`insertFormSchema`, `updateFormSchema`, `submissionQuerySchema` 등)와 폼 정의 기반 동적 Zod 검증(`validateSubmissionData`)이 누락이나 편차 없이 동일한 파이프라인을 통해 원활하게 실행되어야 합니다.

그러나 현재 `src/app/api/v1/` 디렉터리는 Next.js App Router 파일 기반 라우팅으로 분산되어 있어 다음과 같은 구조적 한계와 중복이 발생하고 있습니다:

1. **깊은 중첩으로 인한 라우터 가시성 및 관리성 저하**: 최상위 기능 분기(`forms`, `relations`, `navigator`)는 직관적이지만, `forms` 하위 경로가 최대 4단계(`src/app/api/v1/forms/[id]/submissions/[submissionId]/route.ts`)까지 중첩되면서 전체 엔드포인트 구조 파악과 공통 경계 검증 관리가 어려워졌습니다.
2. **경로 UUID 검증 및 스키마 파편화**: `forms/[id]/route.ts`, `forms/[id]/publish/route.ts`, `forms/[id]/submissions/route.ts`, `forms/[id]/submissions/[submissionId]/route.ts` 4개 파일의 총 9개 핸들러에 동일한 `z.uuid(...)` 검증 스키마와 `parseRequestData(..., await context.params, ...)` 호출이 반복됩니다.
3. **부모 리소스(`form`) 존재 확인 중복**: `publish`, `submissions`(`GET`/`POST`), `submissions/[submissionId]`(`GET`/`PATCH`/`DELETE`) 총 6개 핸들러마다 `findFormById(id)` 호출 및 `404 Not Found` 예외 처리가 반복됩니다.
4. **입력 경계(Query/JSON) 파싱 파이프라인 불일치 및 도메인 경계 혼재**: `submissions/route.ts`는 `searchParams.get(...)`를 수작업으로 조립해 `submissionQuerySchema`에 전달하며, `publish/route.ts`는 잘못된 JSON 수신 시 `400 Bad Request`를 반환하는 반면 `forms/route.ts` 등의 `await req.json()`은 파싱 실패 시 `SyntaxError`가 `withErrorHandler`로 전파되어 `500 INTERNAL_SERVER_ERROR`를 반환할 수 있습니다. 또한 `relations/route.ts`는 Route Handler 내부에 `relationsQuerySchema`, `RelatedGroupResponse`(클라이언트 `RelatedSubmissionsGroup`과 중복) 및 Drizzle Two-Phase Query(`db.select`) 로직이 직접 혼재되어 있어 Thin App Router 및 스키마 SSOT 원칙과 어긋납니다.

이를 해소하기 위해 경량 HTTP 라우터 `hono`를 도입해 API 라우트와 Zod 경계 검증 파이프라인을 통합 관리합니다. 이때 스키마의 소유권은 계속 `entities`/`features`에 두고 FSD(Feature-Sliced Design)의 단방향 의존성과 도메인 스키마 중심(Contract-First) 설계 원칙을 지키기 위해 **Hono RPC(`hc`)는 배제하고 순수 서버 라우팅 및 미들웨어 레이어로만 적용**합니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. `src/app/api/v1/_lib/`에 점진적 확장이 가능한 공통 Hono 라우터 팩토리(`createApiRouter`) 및 요청/검증 유틸리티(`parseRouteParams`, `parseQueryParams`, `readJsonBody`, `parseJsonBody`) 구축.
  2. `src/app/api/v1/forms/` 하위의 기존 5개 `route.ts` 및 5개 `route.test.ts`를 `forms/[[...route]]/route.ts`와 평탄화된 Hono 서브 라우터 구조로 일괄 치환.
  3. 경로 스코프 미들웨어(`validateFormIdParam`, `validateSubmissionIdParam`, `requireForm`, `requireFormSubmission`)를 통해 UUID 파라미터 검증, 부모 폼 조회, 서브미션 소속 검증 중복 제거.
  4. 기존 API 응답 계약(`{ success: true, data, meta }` / `{ success: false, error: { code, message, details } }`) 및 HTTP 상태 코드 100% 하위 호환 유지.
  5. `app.request()` 기반 통합 테스트로 기존 5개 테스트 스위트의 모든 시나리오(400/404/200/201) 이관 및 잘못된 JSON 본문 400 방어 검증 추가.
  6. **(최종 단계)** `src/app/api/v1/relations/route.ts` 내부의 `db.select` 영속성 로직을 `entities/form-submission/server`(`findInboundRelatedSubmissions`)로 하향 분리하고, `relationsQuerySchema` 및 `RelatedSubmissionsGroup` 계약을 `entities/form-submission` SSOT로 통합한 뒤 `_lib` 기반 Thin Controller로 전환.

- **Non-Goals**:
  1. Hono RPC(`hc`) 도입 및 `AppType` 클라이언트 노출 (FSD 역방향 참조 방지 및 기존 `httpClient` + TanStack Query 규격 유지).
  2. `src/app/api/v1/navigator/`의 Hono 마이그레이션 (점진적 적용 전략에 따라 본 스펙에서는 현행 유지, 추후 `_lib` 재사용 가능하도록 기반만 마련).
  3. 클라이언트 측 `entities/*/queries`, `features/*/queries`, `src/shared/lib/http/client.ts`의 통신 방식 변경 (단, `use-related-submissions.query.ts`는 `entities/form-submission`으로 승격/통합된 `RelatedSubmissionsGroup` 타입을 그대로 참조).
  4. `@hono/zod-validator` 외부 플러그인 도입 및 OpenAPI 스펙 자동 생성.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 디렉터리 배치 (`src/app/api/v1/` 내부 구성)**:
  - **`src/app/api/v1/_lib/`를 생성하는 이유 (아키텍처 및 프레임워크 근거)**:
    1. **Next.js App Router Private Folder 규약 (`_` 접두사)**: `src/app/` 하위에서 폴더명 앞에 `_`를 붙이면 Next.js 라우팅 탐색 대상에서 완전히 제외되므로, URL 경로 세그먼트로 오인될 여지 없이 API 내부 공용 유틸리티를 안전하게 배치할 수 있습니다. (`eslint.config.mjs`의 `check-file/folder-naming-convention` 규칙상 `src/app/` 내부는 kebab-case 강제에서 제외되지만, 내부 파일명은 모두 `kebab-case` 규칙을 준수합니다.)
    2. **`src/shared/lib/http/`와의 책임 분리 및 클라이언트 번들 격리**: `src/shared/lib/http/index.ts`는 `entities/*/queries` 및 `features/*/queries`의 클라이언트 코드에서도 직접 import되는 공용 배럴입니다. `shared/lib/http`는 Next.js나 Hono에 종속되지 않는 범용 HTTP 계약(`httpClient`, `apiResponse`, `parseRequestData`, `HttpErrorObject`)만 유지하고, Hono `Context` 및 라우터 조립에 결합된 어댑터 코드는 `app/api/v1/_lib/`에 격리하여 클라이언트 번들에 `hono`가 유입될 위험을 원천 차단합니다.
    3. **점진적 확장을 위한 `v1` 공통 거점**: 당장 1단계에서는 `forms`만 전환하지만, `forms/` 내부에 가두지 않고 `api/v1/_lib/`에 배치함으로써 향후 `relations`, `navigator`가 Hono로 전환될 때 `eslint-plugin-boundaries`의 `app -> app` 허용 범위 안에서 동일한 에러/파싱 규칙을 즉시 재사용할 수 있습니다.
    4. **FSD 8대 세그먼트 규칙과의 정합성**: `entities`/`features` 슬라이스는 8대 표준 세그먼트(`ui`, `queries`, `server`, `store`, `schema`, `types`, `lib`, `hooks`)와 `*.server.ts` 배치 규칙의 제약을 받습니다. HTTP 라우터 어댑터는 도메인 비즈니스 로직이 아니라 `app` 진입점 레이어의 책임이므로 `src/app/api/v1/_lib/`에 두는 것이 FSD 역할 분리와 일치합니다.

  - **`src/app/api/v1/_lib/` 파일 상세 설계**:
    - `create-api-router.ts`:
      - **목적**: 각 도메인 루트 라우터가 매번 `onError`와 미매칭 `notFound` 핸들러를 중복 등록하지 않도록 표준 Hono 인스턴스를 생성하는 팩토리입니다.
      - **주요 인터페이스 및 동작**:
        - `createApiRouter<TVariables extends Record<string, unknown> = Record<string, never>>(options?: { basePath?: string })`
        - `options.basePath`가 전달되면 `new Hono<{ Variables: TVariables }>().basePath(options.basePath)`로 초기화합니다. 서브 라우터(`forms-routes.ts`, `submissions-routes.ts`)는 별도 `onError`/`notFound`가 없는 순수 `Hono<{ Variables: TVariables }>` 인스턴스(또는 `createSubRouter`)로 생성해 루트 앱에 `.route()`로 마운트하며, 모든 예외 및 404 처리는 루트 앱이 일괄 담당합니다.
        - `app.onError((err) => apiResponse.fail(err))`를 기본 등록해, 핸들러/미들웨어에서 던진 `HttpErrorObject`(`badRequest`, `notFound` 등)와 예기치 않은 예외를 기존 표준 에러 JSON(`{ success: false, error: { code, message, details } }`)으로 변환합니다.
        - `app.notFound(() => apiResponse.fail(notFound("요청한 API 경로를 찾을 수 없습니다.")))`를 기본 등록해, Hono 기본 평문 `"404 Not Found"` 대신 API v1 규격과 동일한 JSON 404 응답을 반환합니다.
    - `request-helpers.ts`:
      - **목적**: 외부 `@hono/zod-validator`를 추가하지 않고 기존 `parseRequestData`와 `zod@^4.6.7`을 재사용하여 Hono `Context`의 경로/쿼리/JSON 본문을 일관된 규격으로 파싱합니다.
      - **제공 함수 명세**:
        - `parseRouteParams<TSchema extends z.ZodType>(c: Context, schema: TSchema, errorMessage?: string)`: `c.req.param()` 결과를 `parseRequestData`로 검증합니다. 실패 시 `400 BAD_REQUEST`(`details` 포함)를 throw합니다.
        - `parseQueryParams<TSchema extends z.ZodType>(c: Context, schema: TSchema, errorMessage?: string)`: `c.req.query()` 결과를 `parseRequestData`로 검증합니다. (`GET /forms/:id/submissions`의 `submissionQuerySchema` 파싱 시 `URLSearchParams` 수동 추출을 대체합니다.)
        - `readJsonBody(c: Context, options?: { allowEmpty?: boolean })`: `await c.req.text()`로 원시 본문을 안전하게 읽은 뒤 `JSON.parse`를 수행합니다. 잘못된 JSON 문법(`SyntaxError`)이나 빈 본문(`allowEmpty !== true`) 시 `500` 대신 `400 badRequest("요청 본문이 올바른 JSON 형식이 아닙니다.")`를 throw합니다. `allowEmpty: true`인 경우 빈 본문에 한해 `{}`를 반환합니다. (`POST /forms/:id/submissions`, `PATCH /forms/:id/submissions/:submissionId`처럼 동적 필드 스키마 `validateSubmissionData`를 사용하는 엔드포인트에서도 공용으로 사용합니다.)
        - `parseJsonBody<TSchema extends z.ZodType>(c: Context, schema: TSchema, options?: { allowEmpty?: boolean; errorMessage?: string })`: `readJsonBody`로 안전하게 JSON을 파싱한 뒤 `parseRequestData(schema, rawBody, options?.errorMessage)`로 정적 Zod 스키마 검증까지 한 번에 수행합니다. (`POST /forms`, `PATCH /forms/:id`, `POST /forms/:id/publish`에서 사용합니다.)
    - `create-api-router.test.ts` & `request-helpers.test.ts`:
      - `onError`의 `HttpErrorObject`/일반 `Error` 변환, `notFound` JSON 응답, `basePath` 매칭, `parseRouteParams`/`parseQueryParams` 검증 실패 400 응답, `readJsonBody`/`parseJsonBody`의 잘못된 JSON 400 방어 및 `allowEmpty` 분기를 단위 테스트로 검증합니다.

  - **`src/app/api/v1/forms/` 파일 구성 (기존 중첩 폴더 5쌍을 제거하고 단일 depth로 평탄화)**:
    - `[[...route]]/route.ts`: `formsApp`을 받아 Next.js App Router 진입점용 HTTP 메서드(`GET`, `POST`, `PATCH`, `DELETE` 4종만)를 export하는 얇은 어댑터 파일입니다. 기존 스펙에 없는 `PUT`, `OPTIONS` 등은 노출하지 않아 미지원 메서드 호출 시 Next.js 기본 `405 Method Not Allowed` 동작을 유지합니다. (어댑터는 `@hono/vercel`의 `handle(formsApp)` 또는 설치 버전의 deprecated 경고가 없는 표준 Web Fetch 어댑터를 사용합니다.)
    - `forms-app.ts`: `createApiRouter<FormsRouterVariables>({ basePath: "/api/v1/forms" })`로 루트 앱을 생성하고, 등록 순서 원칙에 따라 **미들웨어를 먼저 등록한 뒤** `formsRoutes`와 `submissionsRoutes`를 모두 루트(`/`)에 마운트(`.route("/", formsRoutes).route("/", submissionsRoutes)`)합니다. 이를 통해 `submissionsRoutes` 내부의 전체 경로(`/:id/submissions`, `/:id/submissions/:submissionId`)와 경로 중복 없이 일치시키며, `formsApp.request("/api/v1/forms/...")` 테스트에서 실제 Prefix 매칭까지 직접 검증합니다.
    - `forms-middleware.ts`: UUID 파라미터 검증 및 도메인 엔티티 컨텍스트 주입 미들웨어.
    - `forms-routes.ts`: `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/publish`.
    - `submissions-routes.ts`: `GET /:id/submissions`, `POST /:id/submissions`, `GET /:id/submissions/:submissionId`, `PATCH /:id/submissions/:submissionId`, `DELETE /:id/submissions/:submissionId`.
    - `forms-app.test.ts` (필요 시 기능별 테스트 파일 분리 가능): `formsApp.request(...)` 기반 라우팅/미들웨어/핸들러 통합 테스트.

  - **`src/app/api/v1/relations/` 및 `entities/form-submission` 내부 로직 분리 (최종 단계)**:
    - `src/entities/form-submission/schema/submission-query.schema.ts` (또는 `relation-query.schema.ts`): `relationsQuerySchema`(`targetId: z.uuid(...)`)를 엔티티 스키마 SSOT로 이동하고 `index.ts`로 export합니다.
    - `src/entities/form-submission/types/relation.types.ts` (순수 TypeScript 타입): 라우트와 클라이언트에 중복 선언되어 있던 `RelatedGroupResponse` / `RelatedSubmissionsGroup` 계약을 `RelatedSubmissionsGroup` 단일 타입으로 통합하고 `index.ts`로 export합니다 (`use-related-submissions.query.ts`는 이를 재사용).
    - `src/entities/form-submission/server/form-submission.server.ts`: `relations/route.ts` 내부에 있던 Two-Phase Query(`relations` -> `formSubmissions` -> `forms` 일괄 조회 및 소스 폼별 그룹화)를 `findInboundRelatedSubmissions(targetId: string): Promise<RelatedSubmissionsGroup[]>` 함수로 추출하고 `server.ts`를 통해 공개합니다. (기존 `syncSubmissionRelations`와 같은 서버 영속성 모듈에 응집 배치)
    - `src/app/api/v1/relations/route.ts`: 단일 엔드포인트(`GET /api/v1/relations`) 구조는 유지하되, `_lib`(`createApiRouter({ basePath: "/api/v1/relations" })`, `parseQueryParams`)와 `findInboundRelatedSubmissions`를 조합하는 Thin Controller로 정리합니다.
    - `src/entities/form-submission/server/form-submission.server.test.ts` & `src/app/api/v1/relations/route.test.ts`: 추출된 `findInboundRelatedSubmissions`의 엣지 탐색/소프트 삭제 필터/소스 폼 그룹화 단위 테스트를 엔티티 서버 테스트로 이관하고, `route.test.ts`는 `relationsApp.request(...)` 기반 경계 검증(400/200)과 위임 검증에 집중하도록 정리합니다.

- **데이터 계약 및 미들웨어 컨텍스트 (`Variables`)**:

  ```typescript
  import type { Form } from "@/entities/form";
  import type { FormSubmission } from "@/entities/form-submission";

  export interface FormsRouterVariables {
    formId: string;
    form: Form;
    submissionId: string;
    submission: FormSubmission;
  }
  ```
  - **경로 파라미터 UUID 검증 미들웨어 및 실행 순서 (중복 검증 방지)**:
    - **1차 (`validateFormIdParam`)**: `/:id` 단일 리소스 경로(`GET`, `PATCH`, `DELETE`)와 `/:id/*` 하위 경로(`POST /:id/publish`, `/:id/submissions`, `/:id/submissions/:submissionId`)에서 `id`만 `z.uuid("올바른 폼 ID(UUID) 형식이 아닙니다.")`로 검증하고 `c.set("formId", id)`를 주입합니다. Hono 와일드카드(`/*`)가 `/:id`와 동시 매칭되는 경우에 대비해 미들웨어 상단에 멱등성 가드(`if (c.get("formId")) { await next(); return; }`)를 두어 `id` 검증이 1회만 실행되도록 보장하며, 검증 실패 시 DB 조회 없이 즉시 `400 BAD_REQUEST`를 반환합니다.
    - **2차 (`validateSubmissionIdParam`)**: `/:id/submissions/:submissionId` 경로에서는 상위 `/:id/*` 미들웨어가 먼저 `formId`를 검증·주입한 뒤 이어서 실행되며, `id`를 재검증하지 않고 `submissionId`만 추가로 UUID 검증 후 `c.set("submissionId", submissionId)`를 주입합니다.
  - **리소스 존재 확인 미들웨어 스코프 분리 (불필요한 DB 쿼리 방지)**:
    - `GET / PATCH / DELETE /:id`: 선행 `findFormById` 미들웨어를 적용하지 않아, `PATCH`(`updateFormById`)와 `DELETE`(`softDeleteFormById`)의 단일 DB 왕복 특성을 그대로 보존합니다.
    - `POST /:id/publish`, `GET / POST /:id/submissions`: 와일드카드(`/*`)가 아닌 정확한 단일 경로에만 `requireForm` 미들웨어를 적용해 `findFormById(formId)`를 조회하고 없으면 `notFound`, 존재하면 `c.set("form", form)`을 주입합니다.
    - `GET / PATCH / DELETE /:id/submissions/:submissionId`: `validateSubmissionIdParam` 이후 `requireFormSubmission` 미들웨어에서 `Promise.all([findFormById(formId), findSubmissionById(submissionId)])`를 병렬 조회하여 폼 부재 및 `submission.formId !== form.id` 소속 불일치를 `404`로 차단한 뒤 `form`, `submission`을 함께 주입합니다. (`requireForm`과 중복 실행되지 않도록 스코프를 완전히 분리합니다.)

- **오류 처리 규격**:
  - 기존 `src/shared/lib/http/server.ts`의 `apiResponse.ok`, `apiResponse.created`, `apiResponse.fail`, `parseRequestData`와 `src/shared/lib/http/errors.ts`의 `badRequest`, `notFound`를 그대로 사용합니다.
  - 모든 동기/비동기 예외는 Hono `onError`를 통해 `apiResponse.fail(err)`로 위임되어 기존 표준 에러 응답(`{ success: false, error: { code, message, details } }`)을 유지합니다.
  - `readJsonBody` 및 `parseJsonBody`는 잘못된 JSON 문법 수신 시 일괄적으로 `badRequest("요청 본문이 올바른 JSON 형식이 아닙니다.")`를 던집니다 (`publish`는 `{ allowEmpty: true }` 옵션으로 빈 본문 시 `{}` 기본값 처리).

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: Hono RPC(`hc`)까지 전면 도입**
  - 기각 사유: `entities/*/queries` 및 `features/*/queries`가 `src/app/api/`의 `AppType`을 참조하게 되어 `eslint-plugin-boundaries`의 FSD 단방향 참조 원칙에 위배되며, 기존 `httpClient`의 `HttpErrorData` 정규화 및 공통 스키마 계약 구조를 깨뜨립니다.
- **대안 B: `/api/v1/[[...route]]/route.ts` 단일 진입점 통합**
  - 기각 사유: `navigator` 라우트가 의존하는 `@ai-sdk/google`, `ai` 등 무거운 AI SDK 번들 및 실행 타임아웃 설정이 경량 CRUD인 `forms` 라우트와 결합되며, 점진적 적용 전략과 상충합니다.
- **대안 C: Hono 없이 Next.js Route Handler + 고차 함수(HOF)만 추가**
  - 기각 사유: UUID 검증 및 부모 폼 조회 중복은 줄일 수 있으나, Next.js 파일 라우팅 제약으로 인해 `forms/[id]/submissions/[submissionId]/route.ts`와 같은 깊은 폴더 중첩 자체는 해소할 수 없습니다.
- **대안 D: `@hono/zod-validator` 외부 미들웨어 사용**
  - 기각 사유: 프로젝트의 `zod@^4.6.7` 환경(`z.uuid`, `z.flattenError`)과 커스텀 에러 포맷(`{ success: false, error: { code, message, details } }`)을 일관되게 유지하기 어렵고 불필요한 의존성이 늘어납니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **ESLint 및 FSD 경계 규칙 제약**:
  - `eslint.config.mjs`의 `no-restricted-syntax`는 `ClassDeclaration`과 `ThisExpression`을 금지하므로 `new Hono()` 생성 호출 자체는 허용되나, 프로젝트 코드 작성 시 `class` 및 `this` 사용을 엄격히 배제하고 순수 함수와 클로저 기반 미들웨어로 구현합니다.
  - `check-file` 규칙상 `src/app/` 내 모든 파일명은 `kebab-case`여야 하며, `*.server.ts` 접미사는 `**/server/` 폴더 내부에서만 허용되므로 라우터/미들웨어 파일은 일반 `kebab-case` 파일명(`forms-app.ts`, `forms-middleware.ts` 등)을 사용합니다.
  - `src/shared/lib/http/index.ts`는 클라이언트 컴포넌트에서도 import하므로 `hono` 의존 유틸리티는 `src/shared/lib/http/` 배럴에 섞지 않고 `src/app/api/v1/_lib/`에 격리합니다.
- **Next.js 16 Catch-All 라우팅 및 어댑터 엣지 케이스**:
  - `[[...route]]`는 `/api/v1/forms` 루트 경로와 하위 경로를 모두 처리하므로 `formsApp`의 `basePath("/api/v1/forms")` 설정과 함께 루트 경로, 동적 파라미터 경로, 미매칭 404 경로를 명시적으로 검증합니다.
  - `eslint.config.mjs`의 `@typescript-eslint/no-deprecated: "warn"` 규칙에 따라 Vercel/Next.js 어댑터(`@hono/vercel` vs `hono/vercel`)의 deprecated 여부를 패키지 설치 직후 확인해 경고 없는 진입 어댑터를 사용합니다.
- **Vitest (`jsdom` 환경) 호환성**:
  - `vitest.config.mts` 기본 환경이 `jsdom`이므로, `formsApp.request(...)`와 `NextResponse` 조합이 `jsdom` 테스트 러너에서 이상 없이 동작하는지 구현 단계에서 즉시 검증합니다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `hono` 패키지 설치 및 `src/app/api/v1/_lib/` 공통 라우터 팩토리/요청 헬퍼 구현 + 단위 테스트
  2. `src/app/api/v1/forms/` 미들웨어(`forms-middleware.ts`), 서브 라우터(`forms-routes.ts`, `submissions-routes.ts`), 앱 조립(`forms-app.ts`) 및 `[[...route]]/route.ts` 구현
  3. 기존 `forms/` 하위 5개 `route.test.ts` 테스트 시나리오를 Hono 기반 통합 테스트로 이관/검증한 뒤 기존 중첩 `route.ts` / `route.test.ts` 5쌍 제거
  4. **(최종 단계)** `relations/route.ts` 내부의 `relationsQuerySchema`, `RelatedSubmissionsGroup`, `findInboundRelatedSubmissions`를 `entities/form-submission`으로 하향 분리하고 `relations/route.ts`를 `_lib` 기반 Thin Controller로 전환 및 테스트 갱신
  5. `npm run verify` 전체 정적 분석(typecheck, lint, format:check) 및 전체 테스트 통과 확인

- **검증 기준**:
  - `npm test -- src/app/api/v1/` (신규 `_lib`, `forms`, `relations` 테스트 전체 통과)
  - `npm test -- src/entities/form-submission/` (`findInboundRelatedSubmissions` 단위 테스트 포함 통과)
  - `npm run verify` (`typecheck`, `lint`, `format:check`, 전체 `vitest` 결함 0건 완주)
