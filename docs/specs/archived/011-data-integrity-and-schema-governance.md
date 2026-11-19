> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-011] 데이터 정합성 및 스키마 거버넌스 고도화 (Data Integrity & Schema Governance)

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-011-data-integrity-and-schema-governance`
> - **작성일 (Created)**: 2026-11-19
> - **완료일 (Archived)**: 2026-11-19

## 1. 배경 및 문제 정의 (Context & Problem Statement)

현재 시스템은 데이터 수집·관계 연결·분석의 기본 루프는 동작하지만, 운영 환경 관점의 데이터 정합성 및 스키마 변경 안전장치에 다음 5가지 구조적 취약점이 존재합니다.

1. **동시 수정 충돌 무방비 (Last-Write-Wins)**: `forms`, `form_submissions`, `analysis_views` 테이블에 버전 관리가 없어, 복수 요청이 겹칠 경우 선행 변경이 경고 없이 덮어쓰입니다.
2. **발행 상태 스키마 무제한 수정 및 파괴적 변경 허용**: `publishedAt !== null`인 라이브 폼에서도 스키마 수정이 차단되지 않으며, 기제출 응답이 존재하는 상태에서 필드 `type` 변경이나 `relationConfig` 축소/대상 변경이 허용되어 기존 JSONB 데이터와 충돌할 수 있습니다.
3. **드롭다운(`select`) 멀티 선택 미지원**: 정적 선택지 다중 선택이 `checkbox` 그룹에만 의존하여, 선택지가 많은 항목에서 공간을 절약하는 칩형 멀티 드롭다운 UI를 선택할 수 없습니다.
4. **`relation` 저장 포맷 이원화**: `multiple: false`는 `string`, `multiple: true`는 `string[]`로 저장 타입이 갈라져 스키마 호환성 및 일관된 배열 정규화 처리가 복잡합니다.
5. **`relations` 엣지 테이블의 AI 미연동**: `findInboundRelatedSubmissions` 서버 조회 로직이 완성되어 있음에도 Consumer/Analyst AI 도구에 노출되지 않아, 특정 레코드 기준으로 연결된 후속 이력을 AI가 근거 기반으로 답변할 수 없습니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. `forms`, `form_submissions`, `analysis_views` 테이블에 `version` 컬럼(기본값 `1`)을 추가해 DB 레벨 낙관적 락(`WHERE version = expectedVersion`) 및 `409 Conflict` 응답 계약을 도입합니다. `PATCH` 수정 API는 `expectedVersion`을 필수로 요구하며, 클라이언트·AI 컨텍스트가 충돌 시 최신 데이터를 재조회하도록 안내합니다.
  2. `forms` 스키마 변경 보호 규칙을 `PATCH /api/v1/forms/:id`와 `builder-tools`에 일관 적용합니다:
     - 발행 중(`publishedAt !== null`): 스키마 수정 차단 (초안 회수 선행 안내)
     - 초안 + 기제출 응답 1건 이상(`hasSubmissions === true`): 물리 삭제 차단, 필드 `type` 변경 차단, `relationConfig.targetFormId` 변경 및 `relation.multiple: true -> false` 차단, `select.multiple: true -> false` 차단
     - 초안 + 응답 0건: 모든 스키마 변경 자유 허용
  3. `coreFormFieldSchema`에 `select` 전용 `multiple?: boolean`을 지원하고, `@/shared/ui/combobox`의 `ComboboxChips` 기반 멀티 선택 드롭다운과 `field-capability.schema.ts` 배열 연산자(`hasAny`, `hasAll`)를 연결합니다.
  4. `relation` 필드의 표준 저장 포맷을 단일/다중 모두 `string[]` 배열로 통일하고(`multiple: false`는 최대 1개 제약), 기존 단일 문자열 레거시 데이터도 안전하게 정규화 수용합니다.
  5. 이미 구현된 `findInboundRelatedSubmissions`를 활용하는 AI 읽기 도구 `getRelatedSubmissions`를 추가해 Consumer/Analyst AI가 특정 레코드의 연결 이력을 조회할 수 있도록 합니다.

- **Non-Goals**:
  1. append-only 버전 히스토리 테이블 및 특정 시점 롤백 UI는 본 스펙에서 제외합니다. (충돌 시 3-way 병합 UI 대신 재조회 안내만 제공)
  2. `checkbox` <-> `select` 간 자동 데이터 마이그레이션은 제공하지 않습니다.
  3. Consumer AI의 `fillFields`/`submitForm` 세부 버그 수정, 마크다운/사전 확인 루프, `react-force-graph` 시각화는 후속 Spec 012~014에서 다룹니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/shared/tables/` & `drizzle/`: `forms`, `form_submissions`, `analysis_views`에 `version: integer("version").default(1).notNull()` 추가 및 Drizzle 마이그레이션 생성
  - `src/shared/schema/field-capability.schema.ts`: `FieldCapabilityTarget`에 `multiple?: boolean` 수용, `select` + `multiple === true` 시 다중 배열 연산자(`hasAny`, `hasAll` 등) 매핑
  - `src/entities/form/`:
    - `schema/form-field.schema.ts`: `coreFormFieldSchema`에 `multiple: z.boolean().optional()` 추가
    - `schema/form.schema.ts`: `updateFormSchema`에 `expectedVersion: z.number().int().positive()` 필수 수용 (시스템 관리 필드에 `version` 포함)
    - `schema/dynamic-form.schema.ts`: `select(multiple: true)` `string[]` 검증, `relation` `string[]` 통일 (`multiple: false` 시 `max(1)` 및 레거시 단일 문자열 호환)
    - `lib/validate-form-schema-transition.ts`: 발행 상태 및 응답 보유 여부에 따른 스키마 변경 호환성 검증(`{ data, error }` Result 패턴)
    - `server/form.server.ts`: `updateFormById` 낙관적 락 `WHERE version = expectedVersion` + 충돌 구분 반환
    - `queries/use-form.mutation.ts`: `UpdateForm` 페이로드에 `expectedVersion` 전달 및 `409 Conflict` 시 쿼리 무효화
  - `src/entities/form-submission/`:
    - `schema/form-submission.schema.ts`: `updateFormSubmissionSchema`에 `expectedVersion` 필수 수용
    - `server/form-submission.server.ts`: `updateSubmissionById` 트랜잭션 내 낙관적 락 + `syncSubmissionRelations` 동기화
    - `queries/use-form-submissions.mutation.ts`: 수정 뮤테이션 시 `expectedVersion` 전달 및 `409 Conflict` 처리
  - `src/entities/analysis-view/`:
    - `schema/analysis-view.schema.ts` & `server/analysis-view.server.ts` & `queries/use-analysis-view.mutation.ts`: `expectedVersion` 기반 낙관적 락 일관 적용
  - `src/app/api/v1/`: `forms-routes.ts`, `submissions-routes.ts`, `analysis-views-routes.ts`에서 스키마 전이 검증 에러(`400`) 및 버전 불일치(`409 Conflict`) 반환
  - `src/features/render-dynamic-form/`:
    - `ui/dynamic-field.tsx`: `select` + `multiple === true`일 때 `@/shared/ui/combobox`(`Combobox`, `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`) 렌더링
    - `lib/relation-table.ts` & `ui/relation-field-input.tsx`: `relation` 값 정규화 및 `multiple: false`일 때도 `[targetId]` / `[]` 배열 포맷으로 일관 출력
    - `hooks/use-consumer-submission-editor.hook.ts`: 수정 시 `submission.version`을 `expectedVersion`으로 전달
  - `src/features/execute-navigator-action/`:
    - `schema/navigator-request.schema.ts`: 컨텍스트 내 `version` 전달 수용
    - `lib/tools/query-tools.ts` (또는 공용 읽기 도구): `getRelatedSubmissions({ submissionId })` 추가
    - `lib/tools/builder-tools.ts` & `analyst-tools.ts`: 스키마 전이 검증 유틸 재사용 및 `expectedVersion` 기반 낙관적 락 검사
  - `src/widgets/navigator-shell/`: 컨텍스트 `version` 전달 연동

- **데이터 계약 (Schema & Interfaces)**:
  - 낙관적 락 서버 반환 판별 유니온:
    ```typescript
    export type OptimisticUpdateResult<T> =
      | { status: "updated"; data: T }
      | { status: "not_found" }
      | { status: "conflict"; currentVersion: number };
    ```
  - `relation` 저장 규격:
    `string[]` (미선택 `[]`, 단일 선택 `[uuid]`, 다중 선택 `[uuid1, uuid2]`) — 기존 DB 내 레거시 `string` 값은 조회/검증/정규화 계층에서 `[value]`로 호환 변환
  - `select` 저장 및 UI 규격:
    단일(`multiple: false` -> 최대 1개 제약) 및 다중(`multiple: true`) 모두 `string[]` 배열 저장, 레거시 단일 문자열 수용, 다중 시 `ComboboxChips` 렌더링

- **오류 처리 규격**:
  - 스키마 전이 규칙 위반(발행 중 수정, 응답 보유 시 `type` 변경/`multiple` 축소 등): `{ data: null, error: string }` Result 반환 -> API `400 Bad Request` / AI 도구 `{ success: false, error }`
  - 낙관적 락 충돌: API `409 Conflict` (`CONFLICT`) -> 클라이언트 뮤테이션에서 캐시 무효화(`invalidateQueries`) 및 충돌 안내

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: `updatedAt` 타임스탬프 비교 기반 낙관적 락**
  - 기각 사유: JS `Date` 직렬화 정밀도 오차 가능성이 있어, 단조 증가 정수 `version` 컬럼이 결정론적이고 디버깅이 명확함.
- **대안 B: `expectedVersion` 선택(optional) 허용**
  - 기각 사유: 호출부에서 실수로 버전을 누락할 경우 낙관적 락이 조용히 무력화되므로, `expectedVersion` 필수로 강제해 동시 수정 보호를 보장함.
- **대안 C: 별도 `multiselect` 필드 타입(10종) 신설**
  - 기각 사유: 기존 9종 코어 필드 체계(`coreFieldTypeSchema`)와 SQL 필터/집계 분기를 불필요하게 늘리는 대신, `select`에 `multiple?: boolean` 속성을 두는 편이 `relationConfig.multiple`과 일관됨.
- **대안 D: `relation` 저장 포맷을 계속 `string | string[]`로 유지**
  - 기각 사유: 단일/다중 선택의 JSONB 타입 불일치로 쿼리·검증·확장(`false -> true`) 시 분기가 복잡해지므로, `string[]` 단일 포맷으로 통일함.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: `updateSubmissionById` 내 `syncSubmissionRelations`는 동일 DB 트랜잭션 내에서 실행해 데이터-엣지 불일치를 방지합니다.
- **엣지 케이스**:
  1. 기존 DB에 저장된 단일 `relation` 문자열 값(`"uuid"`)이 존재할 경우, `normalizeStringIds` 및 Zod `preprocess`로 `[uuid]` 배열로 변환하여 하위 호환을 보장해야 합니다.
  2. AI 도구(`builder-tools`, `analyst-tools`) 실행 시 클라이언트가 전달한 컨텍스트의 `version`을 서버 최신 버전과 대조하여, 화면을 열어둔 사이 발생한 동시 수정 충돌도 놓치지 않도록 처리해야 합니다.
  3. `PATCH` 호출 시 `version` 자체를 클라이언트가 임의로 조작하지 못하도록 `systemManagedFields`에 `version`을 포함하고, 요청에서는 `expectedVersion`만 별도 검증합니다.
- **미해결 의문**:
  - 없음 (Step 1 합의로 `expectedVersion` 필수 강제 및 UI Spike 생략 확정)

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. DB 테이블 `version` 컬럼 추가 + Drizzle 마이그레이션 + `validateFormSchemaTransition` 순수 함수 및 단위 테스트 (TDD)
  2. `forms` / `form_submissions` / `analysis_views` 낙관적 락 서버/API/클라이언트 뮤테이션 적용 및 테스트
  3. `select(multiple)` + `relation` `string[]` 통일 스키마·필터·`ComboboxChips` UI·테스트 구현
  4. `getRelatedSubmissions` AI 도구 + `builder-tools`/`analyst-tools` 보호 규칙·낙관적 락 연동
  5. `npm run verify` 통합 검증 완주
- **검증 기준**:
  - `npm test`: 스키마 전이 보호 규칙, 낙관적 락 충돌(409), `select(multiple)`·`relation` 배열 정규화, `getRelatedSubmissions` 단위 테스트 통과
  - `npm run verify`: 타입체크, ESLint, Prettier, 전체 테스트 결함 0건 통과
