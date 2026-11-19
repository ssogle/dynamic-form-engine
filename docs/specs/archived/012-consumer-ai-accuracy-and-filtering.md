> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-012] 컨슈머 AI 정확도 및 목록 필터·정렬 제어 고도화 (Consumer AI Accuracy & Filtering)

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-012-consumer-ai-accuracy-and-filtering`
> - **작성일 (Created)**: 2026-11-19
> - **완료일 (Archived)**: 2026-11-19

## 1. 배경 및 문제 정의 (Context & Problem Statement)

현재 Consumer AI Navigator(`mode="consumer"`)는 기본적인 이동·입력·제출 액션은 갖추고 있으나, 실사용 시 다음 5가지 정확도 및 제어 공백이 존재합니다.

1. **상대 날짜 인식 불가**: `formatConsumerContextPrompt`에 오늘 날짜 컨텍스트가 주입되지 않아 `"오늘/내일/이번 주"` 같은 요청을 `YYYY-MM-DD`로 변환하지 못합니다.
2. **수정/상세 화면 기존 데이터 미인지**: `useNavigatorShell`이 수정/상세 화면(`/submissions/[submissionId]`)에서도 `currentDraftValues`만 전송하고 캐시된 `submission.data`를 병합하지 않아 AI가 기존 입력값을 빈 상태로 오인합니다.
3. **타깃 폼 오판**: `formatConsumerContextPrompt`가 `currentFormTitle`을 프롬프트에 출력하지 않고 ID만 노출해, 다른 도메인 폼 작업("매출 추가해줘")을 요청해도 현재 열려있는 폼으로 이동해 버립니다.
4. **`fillFields` / `submitForm` 무검증 통과 버그**:
   - `fillFields`가 대상 폼 스키마 검증 없이 값을 그대로 주입해, 선택형 옵션의 `value` 코드 대신 라벨이나 자유 텍스트가 들어갈 수 있습니다.
   - `submitForm`이 서버에서 유효성 선검증 없이 무조건 `{ success: true }`를 반환해, 클라이언트 `methods.handleSubmit()`이 필수값 누락으로 막혀도 채팅에는 "제출 완료"로 오안내됩니다.
5. **목록 필터·정렬 AI 제어 미지원**: `ManageFormSubmissions`는 통합 필드 필터·기간 필터·멀티 정렬을 지원하지만 `ConsumerFormIdPage`가 `sort` 쿼리를 받지 않고, Consumer AI도 자연어로 목록 필터·정렬을 적용·초기화할 수 없습니다.
6. **읽기 전용 데이터 도메인 검색 및 릴레이션 연쇄 조회 불가**: Consumer AI에 제출 데이터 조회 도구가 없어 `/consumer`·`/new` 등 목록 외부 화면에서 "오늘 작업기록 작성 여부"를 확인하거나, `relation` 필드에 연결할 타깃 폼 레코드 UUID를 검색해 연쇄 맥락을 파악할 수 없습니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. `formatConsumerContextPrompt`에 `todayYmd("Asia/Seoul")` 현재 기준 날짜와 `currentFormTitle`을 명시하고, 현재 폼 제목과 다른 도메인 요청 시 `searchForms({ mode: "consumer" })`를 우선 호출하도록 프롬프트를 강화합니다.
  2. `useNavigatorShell`의 Consumer 컨텍스트 조립 시 `/consumer/forms/[id]/submissions/[submissionId]`(상세/수정) 경로에서는 캐시된 `submission.data`를 `currentDraftValues`의 베이스로 병합 전달해 AI가 현재 레코드 값을 정확히 파악하고, RHF <-> `useConsumerFormDraftStore` 양방향 실시간 동기화를 보장합니다.
  3. `fillFields` 실행 시 대상 폼 스키마(`findFormById`) 기준으로 선택형 옵션(`label -> value` 정규화 및 허용 외 값 거부), `select`/`relation` `string[]` 포맷 정규화를 서버 도구 레벨에서 검증합니다.
  4. `submitForm` 실행 시 서버에서 현재 컨텍스트(`currentDraftValues` + 동일 턴 `fillFields` 변경분)를 대상 폼의 `validateSubmissionData(activeFields, ...)`로 선검증해 실패 시 `{ success: false, error, fieldErrors }`를 반환함으로써 미제출 오안내를 차단합니다.
  5. `ConsumerFormIdPage`와 `ManageFormSubmissions`(`useSubmissionListTable`)가 `?sort=...` 쿼리를 수용하도록 확장하고, Consumer AI에 `applySubmissionListQuery` 도구를 추가해 자연어 필터·기간·정렬·초기화를 지원합니다.
  6. Consumer AI에 발행 폼 한정 읽기 전용 `searchSubmissions` 도구를 추가하고 `consumer` 모드의 `maxSteps`를 `10`으로 확장하여, 화면 이동 없이 오늘/기간별 등록 내역 확인 및 `relation` 타깃 레코드 UUID/연쇄 맥락 파악을 지원합니다.
- **Non-Goals**:
  1. 멀티모달 이미지 첨부(영수증/명세서 Vision 파싱) 및 채팅 입력 UI 개선 -> AI Elements 도입과 함께 Spec 013에서 구현합니다.
  2. 고위험 액션 사전 실행 확인 루프(Human-in-the-loop) 및 채팅 마크다운 렌더러 -> Spec 013에서 구현합니다.
  3. 서버 목록 필터 엔진 자체(`field-filter-sql.server.ts`)의 신규 연산자 추가 -> 기존 통합 필드 필터/정렬 계약을 그대로 재사용합니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/app/(workspace)/consumer/forms/[id]/page.tsx`: `searchParams`에 `sort` 추가 및 `parseSortParam` 파싱 후 `ManageFormSubmissions`에 `initialSort` 전달
  - `src/features/manage-form-submissions/`:
    - `ui/manage-form-submissions.tsx` & `ui/submission-list-table.tsx` & `hooks/use-submission-list-table.hook.ts`: `initialSort` props 수용 및 URL 쿼리 props(`initialDateRange`, `initialFilters`, `initialSort`) 동기화
  - `src/widgets/navigator-shell/`:
    - `hooks/use-navigator-shell.hook.ts`: Consumer 모드 `/submissions/[submissionId]`(상세/수정)에서 `formSubmissionsKeys.detail(submissionId)` 캐시를 읽어 `{ ...submission.data, ...currentDraftValues }` 병합 전달, `availableFields`에 `multiple` 및 `relationConfig` 메타 포함
  - `src/features/execute-navigator-action/`:
    - `schema/navigator-request.schema.ts`: `availableFields`에 `multiple`, `relationConfig` 선택 필드 확장
    - `schema/navigator-tools.schema.ts`: `applySubmissionListQueryInputSchema` 및 `consumerSearchSubmissionsInputSchema` 추가 (`formId?`, `dateFieldId?`, `startDate?`, `endDate?`, `filters?`, `sortOrder?`, `limit?`)
    - `lib/tools/consumer-tools.ts`:
      - 동일 요청 턴 내 `fillFields` -> `submitForm` 연쇄 호출 누적 상태(`trackedDraftValues`) 관리
      - `fillFields`: 대상 폼(`findFormById`) 스키마 기준 옵션 `label -> value` 정규화·검증 및 `select`/`relation` 배열 정규화
      - `submitForm`: `validateSubmissionData(activeFields, mergedValues)` 선검증 및 실패 시 누락/오류 필드 안내 반환
      - `applySubmissionListQuery`: 대상 폼 필터(`validateFiltersAgainstFields`)·기간·정렬 유효성 검증 후 `/consumer/forms/[formId]?...` `NAVIGATE` 액션 생성
      - `searchSubmissions`: 발행 폼(`publishedAt`) 한정 가드(`resolvePublishedForm`) 후 `queryFormSubmissionsForAnalysis`를 호출해 `limit + 1` 기반 `hasMore`와 라벨 매핑 레코드(`id`, `createdAt`, `values`)를 반환
    - `lib/prompts/consumer-prompt.ts`: `todayYmd("Asia/Seoul")` 기준 날짜, `currentFormTitle`, 타깃 폼 탐색 분기, 선택지 `value` 코드, 목록 필터/정렬 및 `searchSubmissions`·`getRelatedSubmissions` 릴레이션 연쇄 조회 지침 반영
    - `server/navigator-engine.server.ts`: `createConsumerTools`에 `findFormById`, `queryFormSubmissionsForAnalysis`, `initialDraftValues` 주입 및 `consumer` 모드 `maxSteps: 10` 상향

- **데이터 계약 (Schema & Interfaces)**:
  - `applySubmissionListQuery` 입력 스키마:
    ```typescript
    {
      formId: string; // UUID
      filters?: FieldFilterCondition[];
      dateRange?: { startDate?: string; endDate?: string; dateFieldId?: string };
      sort?: Array<{ id: string; desc: boolean }>;
      reset?: boolean;
      reason?: string;
    }
    ```
  - `fillFields` / `submitForm` 선검증 Result 동작:
    - 검증 성공 시 `{ success: true, ..., clientAction }` 반환
    - 검증 실패(잘못된 옵션 코드, 필수 필드 누락, 형식 오류) 시 `{ success: false, error: string, fieldErrors?: Record<string, string> }` 반환 (`clientAction` 미발행)

- **오류 처리 규격**:
  - 존재하지 않는 폼/비발행 폼, 허용 외 옵션 값, 필수 필드 미충족, 유효하지 않은 필터 필드/연산자 입력 시 도구 레벨에서 `{ success: false, error }`를 반환하여 LLM이 사용자에게 재입력·보완을 요청하도록 유도합니다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 목록 필터/정렬을 `navigate` 도구 URL 수동 조립에만 의존**
  - 기각 사유: LLM이 `filters` JSON 직렬화 및 `encodeURIComponent`를 직접 조립하면 따옴표 이스케이프 오류와 필드 ID 오타가 빈번하므로, Zod 스키마로 검증하고 `serializeFieldFiltersParam`으로 안전하게 직렬화하는 전용 도구(`applySubmissionListQuery`)가 결정론적이고 안전합니다.
- **대안 B: `submitForm` 선검증을 클라이언트(`useDynamicForm`) 응답 피드백으로만 사후 처리**
  - 기각 사유: `submitForm` 도구가 `success: true`를 반환하면 LLM이 이미 "제출했습니다"라고 텍스트 응답을 생성해 버리므로, 서버 도구 실행 시점에 `validateSubmissionData`로 선검증해 차단하는 편이 채팅 응답-실제 상태 일관성을 보장합니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: `fillFields`/`submitForm` 선검증 시 `findFormById` 1회 조회가 추가되나 PK/UUID 단건 조회라 수 ms 이내입니다.
- **엣지 케이스**:
  1. 동일 턴에서 `fillFields`와 `submitForm`이 연쇄 호출될 때(`trackedDraftValues` 누적) 두 번째 스텝의 `submitForm`이 첫 번째 스텝에서 채운 값을 포함해 검증할 수 있어야 합니다.
  2. `ConsumerFormIdPage`에서 AI가 동일 경로에 쿼리스트링만 변경해 `router.push`할 때 `useSubmissionListTable`의 `sorting` state도 `initialSort` prop 변화에 반응해 동기화되어야 합니다.
  3. `relation` 필드에 사용자가 레코드 이름("삼성전자")을 말할 때 `fillFields`만으로 UUID를 알 수 없으므로, `getFormDetails` + `searchSubmissions` 조회를 통한 UUID 탐색 및 형식 검증을 적용합니다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `ConsumerFormIdPage` & `useSubmissionListTable` `sort` 쿼리 파라미터 연동 및 단위 테스트
  2. `useNavigatorShell` Consumer 컨텍스트(`submission.data` 병합, `availableFields` 메타 확장) 및 RHF-Zustand 양방향 동기화
  3. `consumer-prompt.ts` (`todayYmd`, `currentFormTitle`, 타깃 폼 분기, 필터/정렬 및 `searchSubmissions` 연쇄 조회 지침) 개선 및 테스트
  4. `consumer-tools.ts` (`fillFields` 옵션 정규화·검증, `submitForm` `validateSubmissionData` 선검증, `applySubmissionListQuery`, `searchSubmissions`) 및 `consumer` `maxSteps: 10` 구현 및 테스트
  5. `npm run verify` 통합 검증 완주
- **검증 기준**:
  - `npm test`: 상대 날짜 프롬프트, 타깃 폼 오판 방지, `fillFields` 라벨->코드 정규화, `submitForm` 필수값 누락 차단, `applySubmissionListQuery` 직렬화, `searchSubmissions` 발행 폼 가드 및 `hasMore` 판별, `sort` 파싱 테스트 통과
  - `npm run verify`: 타입체크, ESLint, Prettier, 전체 테스트 결함 0건 통과
