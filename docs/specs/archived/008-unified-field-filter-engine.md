> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-008] 통합 필드 조회 능력 레지스트리 및 필터 엔진 (Unified Field Filter Engine)

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-008-unified-field-filter-engine`
> - **작성일 (Created)**: 2026-11-18
> - **완료일 (Archived)**: 2026-11-18

## 1. 배경 및 문제 정의 (Context & Problem Statement)

현재 시스템은 9종 코어 필드(`text`, `textarea`, `number`, `select`, `radio`, `checkbox`, `date`, `switch`, `relation`)를 지원하지만, 데이터 조회 및 필터링 계층이 빌더-컨슈머-분석 영역별로 파편화되어 있습니다.

1. **컨슈머 응답 테이블의 일괄 텍스트 검색 한계**: `submissionQuerySchema`의 `filters`는 `Record<string, string>`만 허용하고, `findSubmissionsPaginated`는 모든 필드에 대해 일괄 `ILIKE '%keyword%'` 검색만 수행합니다. `ColumnHeaderFilter` 역시 필드 타입 구분 없이 단일 텍스트 `<Input>`만 렌더링하므로, 선택형 옵션 라벨/코드 매칭, 숫자 범위(`between`), 날짜 컬럼 헤더 필터, `switch` 불리언 필터, `relation` 대표명/레코드 필터가 지원되지 않으며 시스템 컬럼(`createdAt`, `updatedAt`) 헤더 필터도 부재합니다.
2. **분석 엔진 필터의 연산자 부재 및 SQL 중복**: `analyticsFieldFilterSchema`는 `{ fieldId, value }` 동등 일치만 지원하며, `analytics.server.ts`의 `buildFieldFilterConditions`에 별도의 SQL 조건 조립 로직이 중복 구현되어 있습니다. 숫자 범위(`>=`, `between`), 텍스트 부분 일치(`contains`), 부정(`neq`), 빈 값(`isEmpty`) 등의 조건 필터링이 불가능합니다.
3. **분석 뷰 -> 원천 데이터 드릴다운 단절**: `analysisBlockSourceLinkSchema`와 `buildRawDataHref`, 그리고 `/consumer/forms/[id]` 페이지가 기간(`startDate`, `endDate`, `dateFieldId`)만 전달할 수 있고 필드 필터 조건(`filters`)은 전달하지 못해 분석 조건과 원천 데이터 테이블 조회가 단절됩니다.
4. **FSD 제약에 따른 단일 진실 원천(SSOT) 부재**: `eslint.config.mjs`의 `boundaries/dependencies` 규칙상 `entities` 슬라이스 간 교차 참조가 금지되어 있으므로, `entities/form`, `entities/form-submission`, `entities/analysis-view`가 모두 참조할 필드 타입별 조회 능력(Capability) 및 공용 필터 Zod 스키마를 `shared/schema/` 계층에 정립할 필요가 있습니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. `src/shared/schema/`에 **9종 코어 필드 + 시스템 컬럼(`id`, `createdAt`, `updatedAt`)의 조회/필터/집계 Capability Matrix**와 **공용 Zod 필터 조건 스키마(`FieldFilterCondition`)**를 단일 진실 원천으로 구축합니다.
  2. 빌더 스키마(`CoreFormField`) 변경 없이 기존 필드 `type`(`options`, `relationConfig` 포함)으로부터 지원 연산자와 UI 필터 모드를 자동 파생(고정 매핑)하고, AI `getFormDetails` 도구에서 이를 노출합니다.
  3. 서로 다른 필드 간 `AND`, 동일 필드 내 다중 값(`in`, `hasAny` 등)은 `OR`, 범위 조건은 `between` 연산자로 표준화합니다.
  4. 서버 필터 SQL 빌더를 `entities/form-submission/server`의 공용 모듈로 통합하여, 컨슈머 페이지네이션 목록과 분석 집계/샘플 조회가 동일한 SQL 정밀도(숫자/날짜 안전 캐스팅, 옵션 라벨-코드 정규화, `relation` UUID 및 자연어 `contains` 해석)를 공유하도록 합니다.
  5. 컨슈머 응답 테이블(`ColumnHeaderFilter`)을 필드 타입별 맞춤 필터 UI로 확장하고, `disabled: true` 옵션은 `(비활성화됨)` 구분 표시와 함께 필터 선택지에 노출하며, `relation` 필드는 컨슈머에서 타깃 레코드 피커(`in`)로 필터링합니다.
  6. 분석 뷰 `sourceLinks` 및 `/consumer/forms/[id]` URL 쿼리스트링(`filters`) 연동을 통해 분석 뷰에서 컨슈머 원천 테이블로 필터 상태가 그대로 드릴다운되도록 합니다.
- **Non-Goals**:
  1. 빌더 폼 스키마(`CoreFormField`) 및 UI에 필드별 `filterable` 토글이나 커스텀 기본 필터 설정을 추가하지 않습니다.
  2. 임의 중첩 괄호(`(A OR B) AND C`) 기반의 복합 논리식 빌더 UI는 이번 범위에서 제외합니다.
  3. PostgreSQL `form_submissions.data` 컬럼에 대한 GIN 인덱스 마이그레이션은 별도 성능 과제로 분리합니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/shared/schema/` (`eslint-plugin-check-file` 제약 준수: `**/schema/**` 하위에는 `*.schema.ts`, `*.schema.test.ts`, `index.ts`만 허용되므로 `field-capability.schema.ts`, `field-filter.schema.ts`, `index.ts` 및 대응 `*.schema.test.ts`로만 구성):
    - `field-capability.schema.ts`: `coreFieldTypeSchema`, 시스템 컬럼 타입(`id`, `createdAt`, `updatedAt`), `fieldFilterOperatorSchema`, 타입별 고정 Capability Matrix 및 `resolveFieldQueryCapability()` 순수 해석 함수 정의 (`entities/form`은 `coreFieldTypeSchema`를 여기서 re-export).
    - `field-filter.schema.ts`: 공용 `fieldFilterConditionSchema`, `fieldFilterListSchema`, URL 직렬화/역직렬화(`parseFieldFiltersParam`, `serializeFieldFiltersParam` — 레거시 `Record<string, string>` 자동 승격 포함), 폼 필드 스키마 기반 검증기(`validateFiltersAgainstFields`) 정의.
  - `src/entities/form-submission/schema/`: `submissionQuerySchema`, `analyticsAggregationQuerySchema`, `querySubmissionsForAnalysisSchema`가 공통 `fieldFilterConditionSchema` 참조.
  - `src/entities/form-submission/server/`:
    - `field-filter-sql.server.ts`: `form-submission.server.ts`와 `analytics.server.ts`가 공통 사용하는 PostgreSQL WHERE 조건 조립 엔진 (기존 `buildSafeNumericSql`, `buildValidFieldDateSql`, `resolveRelationFilterCandidateIds` 통합 및 `relation` `contains` 자연어 검색 지원).
    - `form-submission.server.ts`: `FindSubmissionsPaginatedOptions`에 선택적 `schemaDefinition?: FormSchemaDefinition | null` 계약을 추가하여 `submissions-routes.ts`가 이미 로드한 폼 스키마를 그대로 전달(중복 `forms` 테이블 조회 방지)하고, 동적 필드 정렬 시에도 `number`/`date` 타입에 대해 `buildSafeNumericSql`·`buildValidFieldDateSql` 기반 안전 캐스팅 정렬 적용.
  - `src/entities/analysis-view/schema/analysis-view.schema.ts`: `analysisBlockSourceLinkSchema`에 `filters: z.array(fieldFilterConditionSchema).optional()` 추가.
  - `src/features/manage-form-submissions/`:
    - `ColumnHeaderFilter` (`ColumnHeaderFilterProps`): 기존 `filterValue: string` / `onApplyFilter: (val: string) => void`를 `filterCondition?: FieldFilterCondition | undefined` / `onApplyFilter: (condition?: FieldFilterCondition) => void`로 전환하고, 타입별 맞춤 필터 위젯 및 `RelationColumnFilterPicker` (타깃 폼 레코드 피커, `entities/` 훅만 사용해 FSD 수평 참조 금지 준수) 제공.
    - `useSubmissionListTable`: `columnFilters` 상태를 `Record<string, FieldFilterCondition>`으로 관리하고 URL `?filters=`와 동기화하며, 시스템 컬럼(`createdAt`, `updatedAt`, `id`)에 가상 필드 메타(예: `{ id: "createdAt", label: "제출 일시", type: "system_date" }`)를 부여해 `ColumnHeaderFilter`와 연결.
  - `src/features/render-analysis-view/` & `src/app/consumer/forms/[id]/page.tsx`: `buildRawDataHref`와 페이지 `searchParams`에서 `filters` 직렬화/파싱 전달. `build-source-links.ts`의 `makeDedupeKey`에는 `formId`, `startDate`, `endDate`, `dateFieldId` 외에 정규화·직렬화된 `filters` 문자열을 포함해 동일 폼/동일 기간이라도 필터 조건이 다르면 별도 출처 링크로 보존.
  - `src/features/execute-navigator-action/`: `query-tools.ts`(`getFormDetails`에 필드별 지원 필터/집계 Capability 메타 포함) 및 `analyst-prompt.ts`(새 연산자 `between`, `gt/gte/lt/lte`, `in`, `contains` 등 활용 지침 갱신).

- **데이터 계약 (Schema & Interfaces)**:

  ```typescript
  // src/shared/schema/field-capability.schema.ts
  export const fieldFilterOperatorSchema = z.enum([
    "eq",
    "neq",
    "contains",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "in",
    "notIn",
    "hasAny",
    "hasAll",
    "isEmpty",
    "isNotEmpty",
  ]);
  export type FieldFilterOperator = z.infer<typeof fieldFilterOperatorSchema>;

  // LLM Tool Schema(Gemini Structured Outputs) 호환을 위해 평탄화된 객체 + superRefine 구조 채택
  // src/shared/schema/field-filter.schema.ts
  export const fieldFilterConditionSchema = z
    .object({
      fieldId: z.string().min(1, "필터 대상 필드 ID는 필수입니다."),
      op: fieldFilterOperatorSchema.default("eq"),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
      values: z.array(z.string().min(1)).optional(),
      min: z.union([z.string(), z.number()]).optional(),
      max: z.union([z.string(), z.number()]).optional(),
    })
    .superRefine((val, ctx) => {
      // op별 필수 피연산자 및 범위 순서 검증
    });
  export type FieldFilterCondition = z.infer<typeof fieldFilterConditionSchema>;

  // src/entities/form-submission/server/form-submission.server.ts
  export interface FindSubmissionsPaginatedOptions {
    page?: number | undefined;
    limit?: number | undefined;
    sort?: string | undefined;
    filters?: string | undefined;
    ids?: string | undefined;
    dateFieldId?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    timezone?: string | undefined;
    schemaDefinition?: FormSchemaDefinition | null | undefined;
  }
  ```
  - **하위 호환 및 필터 정규화·결합 규칙**:
    - `op` 생략 시 기본값 `"eq"`를 적용하여 기존 `{ fieldId, value }` 분석 필터 포맷과 100% 호환합니다.
    - `in` / `notIn` / `hasAny` / `hasAll` 연산자에서 `values` 대신 단일 `value`만 전달된 경우 `[String(value)]`로 자동 정규화합니다.
    - 동일 `fieldId`에 복수의 동등/포함 조건이 전달된 경우 기존 `analytics.server.ts` 방식과 동일하게 `OR`로 결합하고, 서로 다른 `fieldId` 간 또는 범위(`between`) 등 이종 연산자 조건 간에는 `AND`로 결합합니다.
  - **PostgreSQL JSONB `NULL` / 빈 값 SQL 판정 기준**:
    - `isEmpty`: 키 누락(`IS NULL`), 공백/빈 문자열(`TRIM(COALESCE(...)) = ''`), 또는 빈 JSONB 배열(`jsonb_typeof(...) = 'array' AND jsonb_array_length(...) = 0`)을 모두 빈 값으로 판정합니다. (`isNotEmpty`는 그 여집합)
    - `neq` / `notIn`: SQL 3값 논리(`NULL != 'val'`이 `UNKNOWN`으로 제외되는 문제)를 방지하기 위해 `IS DISTINCT FROM` 또는 `... IS NULL OR ...` 형태로 미응답(`NULL`) 행을 누락 없이 포함합니다.
  - **타입별 Capability 고정 매핑 요약**:
    - `text`, `textarea`: `["contains", "eq", "neq", "isEmpty", "isNotEmpty"]` (기본 `contains`)
    - `number`: `["eq", "neq", "gt", "gte", "lt", "lte", "between", "isEmpty", "isNotEmpty"]` (기본 `between`, 수치 집계 및 숫자 안전 캐스팅 정렬 가능)
    - `select`, `radio`: `["in", "notIn", "eq", "isEmpty", "isNotEmpty"]` (기본 `in`, `disabled: true` 옵션 포함 노출 및 구분 표시)
    - `checkbox` (`options` 있음): `["hasAny", "hasAll", "isEmpty", "isNotEmpty"]` (기본 `hasAny`, `disabled: true` 옵션 포함 노출 및 구분 표시)
    - `switch`, `checkbox` (`options` 없음): `["eq", "isEmpty", "isNotEmpty"]` (기본 `eq`, `true`/`false`)
    - `date`: `["between", "eq", "gte", "lte", "isEmpty", "isNotEmpty"]` (기본 `between`, 날짜 축 및 날짜 안전 캐스팅 정렬 가능)
    - `relation`: `["in", "contains", "isEmpty", "isNotEmpty"]` (컨슈머 UI는 피커 기반 `in`, 서버/분석가는 UUID `in` 및 대표명 자연어 `contains` 모두 지원)
    - 시스템 컬럼 `createdAt`, `updatedAt`: `["between", "gte", "lte", "eq"]` (IANA `timezone` 기준 일 경계 비교)
    - 시스템 컬럼 `id`: `["eq", "contains"]`

- **오류 처리 규격**:
  - `validateFiltersAgainstFields`, `buildFieldFilterSqlConditions`, `aggregateFormSubmissions`, `queryFormSubmissionsForAnalysis`는 `{ data, error }` Result 패턴을 준수하여 미존재 `fieldId`나 필드 타입에서 허용하지 않는 `op` 전달 시 명확한 한국어 사유 문자열을 반환합니다.
  - REST API(`GET /api/v1/forms/:id/submissions`) 경계에서는 잘못된 연산자/타입 조합 시 `badRequest(400)`를 반환하며, `parseFieldFiltersParam`의 URL 직접 유입 레거시 문자열(`Record<string, string>`)은 안전하게 `{ fieldId, op: "contains", value }`로 변환해 하위 호환을 유지합니다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: `entities/form`에 Capability 및 필터 스키마 배치**
  - 기각 사유: `eslint.config.mjs`의 `boundaries/dependencies` 규칙이 `entities` 슬라이스 간 상호 참조(`entities/form-submission` -> `entities/form`, `entities/analysis-view` -> `entities/form`)를 차단하므로 아키텍처 규칙을 위반합니다. `src/shared/schema/`로 하향 배치하면 모든 레이어가 규칙 위반 없이 단일 원천을 공유할 수 있습니다.
- **대안 B: `z.discriminatedUnion("op", [...])` 기반 필터 AST 정의**
  - 기각 사유: 타입 추론은 엄격하지만, Vercel AI SDK를 통해 Gemini Structured Outputs 도구 스키마로 변환할 때 중첩 Union이 모델의 파라미터 생성 오류나 JSON Schema 제약 문제를 유발할 위험이 있습니다. 평탄화된 `z.object` + `.superRefine()` 조합이 API, URL, LLM 도구 모두에서 안정적입니다.
- **대안 C: `relation` 필터를 컨슈머 피커(UUID) 전용으로만 제한**
  - 기각 사유: AI Analyst가 자연어 질문("마케팅 관련 프로젝트 지출만 합산해줘")을 처리할 때 1차로 ID를 모르는 상태에서도 `contains` 기반 부분 일치 조회가 가능해야 유연한 분석이 가능합니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: `relation`의 `contains` 필터는 타깃 폼 레코드에서 `primaryFieldId ILIKE`로 후보 UUID 목록을 선조회한 뒤 메인 쿼리(`IN` / JSONB `@>`)에 주입합니다. 후보 레코드가 과도하게 많을 경우를 대비해 선조회 상한 설정 또는 서브쿼리 방식의 효율성을 구현 단계에서 검증해야 합니다.
- **엣지 케이스**:
  - 과거 `checkbox` 데이터가 `boolean`으로 저장되었다가 이후 `options`가 추가된 경우 등 비정형 과거 데이터에서도 SQL 조건(`jsonb_typeof` 분기)이 런타임 예외를 일으키지 않도록 방어해야 합니다.
  - `RelationFieldInput` 피커(`buildPickerFilterString`)의 기존 필터 포맷도 새 `FieldFilterCondition[]` 또는 호환 어댑터와 충돌 없이 동작해야 합니다.
  - `createdAt`/`updatedAt` 컬럼 필터와 상단 `startDate`/`endDate` 드릴다운 기간 필터가 동시에 존재할 때 중복/충돌 없이 `AND`로 결합되어야 합니다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `src/shared/schema/`에 필드 Capability Matrix 및 공용 Zod 필터 스키마(`field-capability.schema.ts`, `field-filter.schema.ts`) 구축 및 단위 테스트.
  2. `entities/form`, `entities/form-submission`, `entities/analysis-view` 스키마 연동 및 공용 서버 SQL 필터 빌더(`field-filter-sql.server.ts`) 통합 테스트.
  3. `submissions-routes.ts` API 경계 검증 및 `query-tools.ts` / `analyst-tools.ts` / `analyst-prompt.ts` AI 도구/프롬프트 연동 테스트.
  4. 컨슈머 `ColumnHeaderFilter` 타입별 UI 위젯(비활성 옵션 구분, `relation` 피커, `number`/`date` 범위, 시스템 컬럼) 및 URL 쿼리/분석 `sourceLinks` 드릴다운 연동.
- **검증 기준**:
  - `npm test` (Capability 파생, Zod 스키마/어댑터, SQL 조립, API 라우터, 테이블 훅, 드릴다운 링크 단위 테스트 전체 통과)
  - `npm run verify` (타입체크, FSD 경계 및 네이밍 린트, 포맷체크, 전체 단위 테스트 결함 0건 완주)
