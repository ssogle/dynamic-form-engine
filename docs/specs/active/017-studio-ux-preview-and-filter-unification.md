<!-- 아카이브(동결) 전환 시 아래 WARNING 주석을 해제하고 상단 NOTE 블록을 대체하세요 -->
<!--
> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.
-->

# [Spec-017] 스튜디오 편집 UX·프리뷰 정합성 및 드릴다운 필터 통합

> [!NOTE]
>
> - **상태 (Status)**: Active (기획/구현 중)
> - **브랜치 (Branch)**: `feat/spec-017-studio-ux-preview-and-filter-unification`
> - **작성일 (Created)**: 2026-11-21
> - **완료일 (Archived)**: -

## 1. 배경 및 문제 정의 (Context & Problem Statement)

3차 포트폴리오 QA 결과, 핵심 기능 외에 첫 화면 데모 안내, 스튜디오 편집 동선, 프리뷰/드릴다운 UI 일치성 및 발행 상태 표기 측면에서 다음 5가지 UX·정합성 공백이 확인되었다.

1. **랜딩 첫 화면 데모 맥락 부재 (`/`)**: 역할 카드 3종(빌더·컨슈머·분석가)만 배치되어 있어, 처음 방문한 사용자가 사전 적재된 데모 도메인 규모와 권장 체험 순서를 바로 파악하기 어렵다.
2. **발행 상태 UI·문구·버튼 파편화**: 미발행 상태 명칭이 `초안`·`미발행 초안`·`작성 중`으로 혼재되고, 배지 스타일(`bg-emerald-600` vs `default`), 발행 버튼 문구(`공식 발행`/`발행하기`/`발행 취소`/`초안 회수`/`발행 취소 (초안)`), 위치(빌더 상세는 폼 카드 헤더 내부, 분석가 상세는 상단 액션 바)가 제각각이며 컨슈머 화면에서도 불필요한 `발행됨` 배지가 노출된다.
3. **빌더·분석가 캔버스 AI 편집 동선 불명확**:
   - 빌더 캔버스(`/builder/forms/[id]`)에 `FormFieldWrapper.onFieldClick`이 연결되지 않았고 AI 수정 안내·필드 타입 배지가 빠져 있다.
   - 분석가 캔버스(`/analyst/views/[id]`, `!publishedOnly`)에서도 블록이 이미 채워져 있는 경우 블록별 AI 수정 멘션 버튼이나 편집 안내가 없어 사용자가 특정 필드/블록을 AI에게 지목해 수정하기 어렵다.
4. **빌더 프리뷰 <-> 컨슈머 동작/테이블 불일치**:
   - `/builder/forms/[id]`가 `widgets/relational-form-picker` 대신 슬롯 없는 `DynamicFormRenderer`를 직접 호출해 구버전 관계형 피커(`RelationPickerDialogBody`)·구버전 4열 `<Table>`이 노출된다.
   - `BuilderDataPreviewDialog` / `useSubmissionListTable`의 `mode="preview"`는 실데이터 조회를 차단하고 정적 헤더(`renderStaticHeader`)만 렌더링하여 이미 데이터가 있는 폼도 실제 필터·정렬 테이블을 미리볼 수 없다.
5. **분석가 `sourceLinks` <-> 컨슈머 컬럼 필터 UI 불일치**:
   - `?startDate&endDate&dateFieldId`가 별도 `dateRangeFilter` 상태로 유지되어 `ColumnHeaderFilter`의 날짜 컬럼 아이콘 불빛·팝오버 달력과 연동되지 않으며, 사용자가 날짜 컬럼 필터를 추가 조작 시 2중 필터 충돌이 발생한다. 또한 선택형 필터에 라벨 문자열이 인입될 때 체크박스 복원이 어긋날 여지가 있다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  - `@/shared/ui/publish-status-badge.tsx` 신설(`발행됨` / `초안` 단일 규격) 및 전 화면 발행 배지·버튼(`공식 발행` / `발행 취소`)·`/builder/forms/[id]` 상단 액션 바 통일, 컨슈머 뷰 불필요 상태 배지 숨김
  - 빌더 캔버스(`Click-to-Mention` + 타입 배지 + AI 수정 안내/추가 요청 버튼) 및 분석가 캔버스(블록별 `AI로 수정` 멘션 + 상시 편집 안내/추가 요청 버튼 + `/analyst/views` 맥락 안내) 대칭 구현
  - `widgets/relational-form-picker`에 `RelationalDynamicFormRenderer`를 추가해 빌더 프리뷰 관계형 피커/선택 테이블 통합, 및 `preview` 모드 목록에서 실데이터 존재 시 실데이터·필터·정렬 허용(0건 시 샘플 폴백, 라우팅·삭제·URL 동기화는 계속 차단)
  - `useSubmissionListTable` 초기화 시 `initialDateRange`를 `columnFilters[resolvedDateFieldId ?? "createdAt"]`(`op: "between"`)로 승격 통합(기존 URL 쿼리 하위 호환 유지) 및 선택형 필터 라벨 -> 코드 UI 정규화
  - 랜딩(`/`) 3열 카드 하단에 컴팩트 데모 환경 요약 및 3단계 추천 체험 흐름 카드 추가
- **Non-Goals**:
  - 빌더 캔버스 내 GUI 직접 폼 편집기(드래그앤드롭/모달 필드 생성기) 도입
  - `DynamicField`의 비-RHF(`FormProvider` 미존재) 단독 폴백 분기(`Branch B`) 대규모 개편
  - 랜딩(`/`) 진입 시 실시간 DB `count(*)` 집계 API 호출
  - 시드 스크립트(`notes/seed-portfolio.ts`) 가상 이메일 도메인 변경

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `shared/ui/publish-status-badge.tsx`: 공통 `PublishStatusBadge` (`isPublished: boolean`, `발행됨` / `초안` 시맨틱 컬러 통일)
  - `features/manage-builder-forms/`:
    - `builder-form-list.tsx`, `builder-relation-graph.tsx`: `PublishStatusBadge` 및 `초안` 명칭, `공식 발행` / `발행 취소` 버튼 통일
    - `builder-form-publish-button.tsx`: `/builder/forms/[id]` 상단 액션 바용 발행 토글 버튼 신설 및 Public API 노출
  - `features/manage-analysis-views/`: `analysis-view-list.tsx`, `analysis-view-action-bar.tsx` 배지·발행일 메타·버튼(`공식 발행` / `발행 취소`) 통일, `/analyst/views` 분석 안내 보강
  - `features/render-dynamic-form/`:
    - `DynamicFormRenderer`(`mode="preview"`): `onFieldClick` 미주입 시 기본 `dispatchFocusNavigator({ prefillText: "'[라벨](id)' 필드를 " })` 연결, 필드 타입 배지 노출, 하단 AI 수정 안내 및 `"AI에게 필드 추가 요청"` 버튼 추가, 카드 헤더 내부 중복 발행 버튼 정리
  - `features/render-analysis-view/`:
    - `AnalysisViewRenderer`(`!publishedOnly`): 각 블록 카드 헤더/상단에 `AI로 수정` 멘션 버튼(`dispatchFocusNavigator({ prefillText: "'[블록제목](id)' 블록을 " })`), 블록 존재 시에도 하단 AI 편집 안내 및 `"AI에게 블록 추가 요청"` 버튼 노출
  - `widgets/relational-form-picker/`: `RelationalDynamicFormRenderer` 추가 및 `src/app/(workspace)/builder/forms/[id]/page.tsx` 교체
  - `features/manage-form-submissions/`:
    - `use-submission-list-table.hook.ts`:
      - `initialDateRange` -> `columnFilters[resolvedDateFieldId ?? "createdAt"] = { fieldId, op: "between", min: startDate, max: endDate }` 병합 초기화 (기존 `columnFilters` 동일 키 미존재 시 승격)
      - `mode === "preview"`: 실데이터 쿼리 활성화하되 `serverSubmissions.length === 0 && !activeFilterCount`일 때 `sampleSubmissions` 폴백 (`isSamplePreview`), 컬럼 헤더는 실데이터 모드와 동일하게 `ColumnHeaderFilter` 렌더링(삭제/상세이동/URL 동기화는 계속 비활성)
    - `lib/filter-summary.ts` & `ui/column-header-filter.tsx`: 선택형 옵션(`select`/`radio`/`checkbox`) 라벨 입력을 옵션 `value` 코드로 정규화하는 순수 헬퍼 공유
  - `app/page.tsx`: 3열 역할 카드 하단 컴팩트 데모 환경 및 3단계 체험 동선 안내 카드 배치
- **데이터 계약 (Schema & Interfaces)**:
  ```typescript
  // src/shared/ui/publish-status-badge.tsx
  export interface PublishStatusBadgeProps {
    readonly isPublished: boolean;
    readonly className?: string | undefined;
  }

  // useSubmissionListTable URL -> columnFilters 승격 규칙
  // initialDateRange = { startDate, endDate, dateFieldId } 수신 시
  // targetAxisId = activeFields.some(f => f.id === dateFieldId && f.type === "date") ? dateFieldId : "createdAt"
  // columnFilters[targetAxisId] ??= { fieldId: targetAxisId, op: "between", min: startDate, max: endDate }
  ```
- **오류 처리 규격**:
  - `startDate`만 있거나 `endDate`만 있는 불완전 기간 링크도 `op: "between"`(`min` 또는 `max` 단독)으로 안전 승격하여 `fieldFilterConditionSchema`를 통과시킨다.
  - `mode === "preview"`에서 실데이터 쿼리 중 일시 로딩이나 빈 데이터일 때 `sampleSubmissions` 폴백으로 빈 화면이 노출되지 않게 보호한다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 빌더/분석가 캔버스에 GUI 직접 편집 폼(모달/드래그앤드롭) 추가**
  - 기각 사유: AI Navigator 자연어 편집 정체성과 충돌하고 발행 잠금·낙관적 락·옵션 보존 로직이 UI에 중복된다. Click-to-Mention 연동이 최소 코드로 더 높은 일관성을 제공한다.
- **대안 B: `dateRangeFilter`를 그대로 두고 `ColumnHeaderFilter`에 별도 prop으로 동기화**
  - 기각 사유: `dateRangeFilter`와 `columnFilters[dateFieldId]` 두 상태가 공존하면 상단 칩, URL 직렬화, 초기화가 계속 이원화되어 충돌한다. `columnFilters` 단일 진실 원천으로 통합하고 URL 진입점(`?startDate&endDate&dateFieldId`)만 호환 파싱하는 편이 깔끔하다.
- **대안 C: 랜딩(`/`)에서 실시간 DB `count(*)` 쿼리를 조회해 수치 표기**
  - 기각 사유: 정적 SSR 랜딩 페이지 진입마다 3만 건 집계 부하가 발생하므로 정적 요약 안내로 유지한다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: `mode="preview"`에서 `BuilderDataPreviewDialog`를 열 때 `useInfiniteFormSubmissionsQuery`가 실데이터(1페이지 20건)를 조회하지만 `limit: 20` 페이지네이션과 기존 React Query 캐시를 공유하므로 지연이 미미하다.
- **엣지 케이스**:
  - 기존 테스트(`use-submission-list-table.hook.test.ts` 내 `initialDateRange` 및 `preview` 모드 테스트)가 `dateRangeFilter` 단독 반환값 또는 `preview` 쿼리 비활성화를 검증하고 있으므로, 통합 규격에 맞춰 단위 테스트 기대값을 함께 정비해야 한다.
  - `AnalysisViewRenderer` 블록별 `AI로 수정` 버튼이 블록 하단의 `[원본 데이터 보기]` 링크나 테이블 스크롤/툴바 클릭과 이벤트 전파 충돌하지 않도록 헤더 우측 독립 버튼으로 분리한다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. **Step 1 (발행 상태 UI·문구 통일)**: `PublishStatusBadge` 신설, 빌더·분석가 목록/상세/렌더러 배지·버튼(`공식 발행`/`발행 취소`) 통일, `/builder/forms/[id]` 상단 발행 토글 추가, 컨슈머 뷰 불필요 배지 숨김
  2. **Step 2 (빌더·분석가 캔버스 AI 편집 UX & 프리뷰 일치화)**: `RelationalDynamicFormRenderer` + `/builder/forms/[id]` 연결, 빌더 필드 Click-to-Mention·타입 배지·편집 안내, 분석가 블록 `AI로 수정` 버튼·상시 편집 안내·목록 맥락 안내, `useSubmissionListTable` `preview` 실데이터/샘플 분기 정비 + 단위 테스트
  3. **Step 3 (`sourceLinks` <-> 컨슈머 컬럼 필터 통합)**: `initialDateRange` -> `columnFilters` `between` 승격 통합, 선택형 옵션 라벨 -> 코드 정규화 유틸/UI 반영 + 단위 테스트
  4. **Step 4 (랜딩 데모 안내 및 전체 검증)**: `src/app/page.tsx` 데모 가이드 카드 배치, `npm run fix && npm run verify` 결함 0건 확인
- **검증 기준**:
  - `npm test`: `use-submission-list-table.hook.test.ts`, `filter-summary.test.ts`, `use-builder-form-preview.hook.test.ts` 및 신규 헬퍼/컴포넌트 테스트 통과
  - `npm run verify`: TypeScript, ESLint(FSD 경계 포함), Prettier, 전체 Vitest 스위트 결함 0건 완주
