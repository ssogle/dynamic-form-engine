> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-016] 공통 데이터 테이블 통합 및 AI 필터·파생 정렬 엔진 정합성

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-016-unified-table-and-ai-sort-engine`
> - **작성일 (Created)**: 2026-11-21
> - **완료일 (Archived)**: 2026-11-21

## 1. 배경 및 문제 정의 (Context & Problem Statement)

2차 포트폴리오 QA에서 데이터 테이블 일관성과 AI Navigator 필터·정렬 정밀도 측면의 다음 문제들이 확인되었다.

1. **관계형 테이블 파편화**: `RelationFieldInput` 피커(`render-dynamic-form`)가 별도의 간이 `<Table>`과 단일 대표 필드 실시간 검색(디바운스 없음)만 제공해 타깃 폼의 다중 컬럼 세부 필터·정렬·관계 라벨 치환을 활용할 수 없으며, `SubmissionDetailView`의 정방향 `relation` 필드 역시 `RelatedSubmissionSubtable`의 구형 4열 테이블로 폴백 렌더링되고 있다.
2. **테이블 상단 상태 가시성 및 포맷 불일치**: 상단 툴바에 필터 칩은 표시되나 활성 정렬(`sorting`) 상태 칩이 없어 해제가 번거롭고, 숫자 필터 칩에 천 단위 콤마가 빠지며, AI(`applySubmissionListQuery`)가 `eq`/`contains`로 `relation` 필터를 걸거나 결과가 0건일 때 UUID가 그대로 칩에 노출되고 컬럼 필터 팝오버와 동기화되지 않는다.
3. **Consumer AI 원격 목록 필터 제한 및 경계 모호**: `consumer-prompt.ts`가 `applySubmissionListQuery`를 현재 보고 있는 목록 화면 조작으로만 좁게 안내해 대시보드(`/consumer`) 등에서 조건별 목록 이동을 요청할 때 활용이 제한되며, 집계/계산 질문의 Analyst 위임 기준이 명확하지 않다.
4. **Analyst 파생 지표 및 기존 블록 정렬 불가**: `computeSeriesMetric`이 계산 결과(순이익, 달성률 등)를 무조건 한글 가나다순으로만 반환해 값 기준 정렬이 안 되며, 이미 생성된 차트·표 블록은 `summarizeCurrentAnalysisView`가 수치를 생략하는 구조에서 서버 측 블록 정렬 오퍼레이션도 없어 후속 정렬 요청("순이익 내림차순 정렬")이 실패한다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  - `ManageFormSubmissions` / `SubmissionListTable`에 선택 모드(`selectionMode`)와 컴팩트 모드(`compact`)를 추가하고, FSD 위젯(`widgets/relational-form-picker`) 조립을 통해 `RelationFieldInput` 다이얼로그 테이블을 공통 테이블로 통합 (+ `RelationColumnFilterPicker` 300ms 디바운스 적용)
  - `SYSTEM_FIELD_CAPABILITIES.id` 및 `buildSystemFieldConditionSql`에 `"in"` 연산자를 추가하여 `SubmissionDetailView` 정방향 `relation` 필드도 `ManageFormSubmissions` 공통 테이블(`lockedFilters`)로 통합
  - `SubmissionListTable` 상단 툴바에 비기본 활성 정렬(`sorting`) 배지/칩 및 1클릭·일괄 해제 UI 추가
  - `filter-summary.ts` 숫자 천 단위 콤마·`eq` relation 라벨 치환, `useRelationLookup`의 `columnFilters` UUID 포함, `ColumnHeaderFilter`의 `eq` → `in` 정규화 및 Consumer AI `relation` 필터 규격(`op: "in"`) 통일
  - `consumer-prompt.ts`에 원격 조건 목록 자동 이동(`applySubmissionListQuery`) 허용 및 집계·교차 도메인 질문 Analyst 위임 경계 명시
  - `computeSeriesMetric`에 `sortBy`/`sortOrder` 추가 및 `updateAnalysisView`에 기존 `chart`/`table` 블록 데이터를 서버에서 결정론적으로 정렬하는 `SORT_BLOCK_DATA` 오퍼레이션 추가
- **Non-Goals**:
  - 신규 DB 테이블 DDL 마이그레이션 (기존 `forms`, `form_submissions`, `relations`, `analysis_views` 스키마 그대로 활용)
  - `SubmissionListTable` 자체의 서버 API 페이지네이션 스키마 변경

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/shared/lib/debounce/`: 공용 `useDebouncedValue<T>(value: T, delayMs?: number)` 훅
  - `src/shared/lib/virtual-table/virtual-table.tsx`: 네임드 `group/resizer` 적용으로 상위 래퍼 호버 간섭 격리
  - `src/shared/schema/uuid.schema.ts`: 공용 `uuidSchema` (`z.uuid()`) 및 `isUuid` 판별 헬퍼 단일 진실 원천화
  - `src/shared/schema/field-capability.schema.ts`: `SYSTEM_FIELD_CAPABILITIES.id.filterOperators`에 `"in"` 추가
  - `src/entities/form-submission/server/field-filter-sql.server.ts`: `buildSystemFieldConditionSql`에 `id` `"in"` 필터 SQL (`inArray` / UUID 검증) 구현
  - `src/entities/form-submission/schema/analytics-query.schema.ts` & `src/entities/form-submission/lib/analytics-calculator.ts`: `computeSeriesMetric` `sortBy` / `sortOrder` 확장
  - `src/features/manage-form-submissions/`:
    - `types/submission-view.types.ts`, `manage-form-submissions.tsx`, `use-submission-list-table.hook.ts`, `submission-list-table.tsx`: `selectionMode` / `compact` / `onRemoveSelectedRow`(`__unlink` 열) 지원, 활성 정렬 칩/해제 핸들러, 상단 툴바 `컬럼 표시` 우측 고정, `columnFilters` `relation` UUID 룩업 포함
    - `lib/filter-summary.ts`: 숫자 천 단위 콤마 및 `eq` `relation` 라벨 치환
    - `ui/column-header-filter.tsx`, `ui/relation-column-filter-picker.tsx`: `eq` → `in` 정규화 및 `useDebouncedValue(300)` 적용
    - `ui/submission-detail-view.tsx`: 정방향 `relation` 영역 `ManageFormSubmissions` 공통 테이블로 교체
  - `src/features/render-dynamic-form/`: `renderRelationPicker`, `renderRelationSelectedTable` 슬롯을 통해 FSD 수평 참조 없이 피커 및 선택 결과 테이블 주입 수용
  - `src/widgets/relational-form-picker/`: `render-dynamic-form`과 `manage-form-submissions`를 결합해 `RelationalFormSubmitter`, `RelationalSubmissionEditor` 조립 (각 App 페이지에서 사용)
  - `src/features/execute-navigator-action/`: `consumer-prompt.ts`, `consumer-tools.ts`, `navigator-tools.schema.ts`, `analyst-tools.ts`, `analyst-prompt.ts` 업데이트 (`SORT_BLOCK_DATA`, `computeSeriesMetric` 정렬, `relation` `in` 통일, 원격 이동/위임 지침)
- **데이터 계약 (Schema & Interfaces)**:
  ```typescript
  // ManageFormSubmissions 선택/컴팩트 모드 계약
  export interface SubmissionSelectionMode {
    readonly multiple: boolean;
    readonly selectedIds: readonly string[];
    readonly onToggleSelect: (submissionId: string) => void;
  }

  // computeSeriesMetricInputSchema 확장 필드
  sortBy?: "key" | "baseValue" | "targetValue" | "result"; // 기본값: "key"
  sortOrder?: "asc" | "desc"; // 기본값: "asc"

  // updateAnalysisView SORT_BLOCK_DATA 오퍼레이션 계약
  operation: "SORT_BLOCK_DATA";
  targetBlockId: string;
  sortKey: string; // chart.xAxisKey / chart.series[].key / table.columns[].key
  sortOrder?: "asc" | "desc"; // 기본값: "desc"
  ```
- **오류 처리 규격**:
  - `id` `"in"` 필터는 유효한 UUID 문자열만 필터링하고 빈 배열이면 결과 0건 조건(`sql\`FALSE\``)으로 안전 처리한다.
  - `SORT_BLOCK_DATA`는 대상 블록이 `chart`/`table`이 아니거나 `sortKey`가 해당 블록의 축/시리즈/컬럼에 존재하지 않을 경우 명시적 에러 메시지를 반환하며 기존 블록 데이터를 훼손하지 않는다(`null`/`undefined` 값은 오름/내림차순 모두 하단에 배치).

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: `RelationFieldInput` 내부에 컬럼별 필터/가상화 UI를 별도로 재구현**
  - 기각 사유: `SubmissionListTable`과 동일한 필터/가상 스크롤/라벨 치환 로직이 중복되고 유지보수 비용이 2배로 늘어난다.
- **대안 B: `features/render-dynamic-form`에서 `features/manage-form-submissions`를 직접 import**
  - 기각 사유: FSD 아키텍처의 피처 간 수평 참조 금지 원칙에 위배된다. 슬롯 주입 + `widgets/` 상향 조립이 규격에 정확히 부합한다.
- **대안 C: `summarizeCurrentAnalysisView`에 차트/표 전체 `data`/`rows`를 다시 실어 보내 LLM이 직접 정렬하게 함**
  - 기각 사유: 토큰 비용과 지연 시간이 다시 증가하고, LLM이 배열 재작성 중 수치 누락·오타를 낼 수 있다. 서버 측 결정론적 `SORT_BLOCK_DATA` 오퍼레이션이 0오류·최소 토큰으로 안전하다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: `RelationColumnFilterPicker`에 300ms 디바운스를 적용해 한글 조합 중 불필요한 API 폭주를 방지한다.
- **엣지 케이스**:
  - `SubmissionDetailView`에서 정방향 단일 선택 `relation`(1건)도 공통 테이블을 쓰면 상단 툴바/필터가 다소 높게 보일 수 있으므로, `compact` 모드에서는 툴바 여백과 테이블 최대 높이를 컴팩트하게 유지한다(`lockedFilters`는 상단 해제 가능 배지에서 제외되어 실수로 풀리지 않도록 보호).
  - `ManageFormSubmissions` 선택 피커 다이얼로그 내부에서 `ColumnHeaderFilter` `Popover`가 다이얼로그 포커스 트랩/z-index와 충돌하지 않는지 확인한다.
- **확정된 설계 결정**:
  - `compact` 모드에서도 사용자가 필터/정렬 기능을 활용할 수 있도록 최소 1줄 상단 툴바는 유지하되 페이지 타이틀과 액션 열(`수정`/`삭제`)만 생략한다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. 공용/엔티티 계층(`useDebouncedValue`, `SYSTEM_FIELD_CAPABILITIES.id` `in`, `field-filter-sql.server.ts`, `analytics-calculator.ts` 정렬) + 단위 테스트(TDD)
  2. `ManageFormSubmissions` 선택/컴팩트 모드·활성 정렬 칩·필터 콤마/UUID 룩업·`SubmissionDetailView` 통합 + `widgets/relational-form-picker` 조립
  3. AI Navigator(`consumer-prompt.ts`, `consumer-tools.ts`, `analyst-tools.ts` `SORT_BLOCK_DATA`, `analyst-prompt.ts`) + 단위 테스트 보강
- **검증 기준**:
  - `npm test`: `field-filter-sql`, `analytics-calculator`, `filter-summary`, `use-submission-list-table`, `analyst-tools`, `consumer-prompt`, `use-debounced-value` 단위 테스트 전체 통과
  - `npm run verify`: TypeScript, ESLint(FSD 경계 포함), Prettier, 전체 Vitest 스위트 결함 0건 통과
