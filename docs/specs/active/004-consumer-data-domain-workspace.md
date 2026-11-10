# [Spec-004] Consumer Data Domain Workspace & Virtualized TanStack Data Grid (Page-based Infinite Scroll, Multi-Sort, Column Popover Filters)

> [!NOTE]
>
> - **상태 (Status)**: Active (기획 및 구현 진행)
> - **브랜치 (Branch)**: `feat/spec-004-consumer-data-domain-workspace`
> - **작성일 (Created)**: 2026-11-10
> - **완료일 (Archived)**: -

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

1. **설문지 모델에서 '업무 데이터 도메인 모델'로의 화면 흐름 전환**:
   - 기존 컨슈머 라우팅(`/consumer/forms/[id]`)은 특정 폼을 선택했을 때 '빈 응답 작성 폼'이 기본 뷰로 열려 있었습니다.
   - 하지만 컨슈머는 일회성 설문 응답자가 아니라, 특정 데이터 도메인(예: 채용 관리, 고객 문의함)의 데이터를 조회하고 관리하는 실무 운영자입니다.
   - 따라서 도메인 메뉴에 진입했을 때 가장 먼저 열려야 하는 화면은 **"기존에 수집된 데이터 레코드 목록(Table View)"**이어야 하며, 신규 등록은 그 위에서 파생되는 액션이어야 합니다.

2. **동적 데이터에 대한 고도화된 멀티 정렬 및 컬럼별 탐색 필요성**:
   - 수백~수천 건의 응답 데이터에서 사용자가 원하는 레코드를 빠르게 찾기 위해서는, **다중 컬럼 정렬(Multi-Column Sorting)**과 **복수 컬럼 동시 검색(Multi-Column AND Filtering)**이 필수적입니다. 여러 컬럼의 팝오버에서 각각 입력한 검색 조건이 서버에서 `AND` 연산으로 결합되어 정밀한 교집합 필터링을 수행합니다.
   - 동적 JSONB 필드와 복수 정렬 조건이 결합된 환경에서는 Keyset(커서) 조건문의 조합 복잡성을 방지하고 버그를 원천 차단하기 위해 **`page/offset` 기반의 예측 가능한 서버 사이드 페이징**을 적용합니다.

3. **엔터프라이즈 테이블 레이아웃 및 셀 텍스트 거버넌스 (고정 높이 & 전역 말줄임)**:
   - 컬럼이 늘어날 때 컬럼 폭이 억지로 좁아져 헤더 텍스트나 본문 셀 텍스트가 두 줄로 꺾이는 현상을 원천 방지합니다.
   - **헤더와 데이터 셀 공통 규칙**: 모든 텍스트에 줄바꿈 방지(`whitespace-nowrap`)를 강제하고, 셀 너비를 초과하면 **한 줄 말줄임(truncate)** 처리하며, 마우스 오버 시 전체 내용을 확인할 수 있는 툴팁(`title`)을 제공합니다.
   - 이로써 모든 데이터 행이 **동일한 고정 높이(Fixed Row Height)**를 유지하여, 가상화 엔진(TanStack Virtual)의 스크롤 위치 계산이 1픽셀의 오차도 없이 극도로 부드럽게 작동합니다.
   - 각 컬럼의 최소 너비(Min Width)를 보장하며, 전체 컬럼 너비의 합이 뷰포트를 초과할 경우 **자연스러운 가로 스크롤(Horizontal Scroll: overflow-x-auto)**을 지원합니다.
   - 검색 UI는 헤더 공간을 낭비하지 않도록 **헤더 아이콘 클릭 시 열리는 팝오버(Popover) 인풋 창** 방식을 채택합니다.

4. **대용량 무한 스크롤 시 브라우저 DOM 렌더링 부하 원천 차단 (가상화 필수성)**:
   - 무한 스크롤 방식으로 데이터를 계속 누적하여 페칭할 때, 수천 개의 `<tr>`, `<td>` DOM 노드가 브라우저에 적재되면 프레임 드롭(버벅임)과 메모리 폭증이 발생합니다.
   - 따라서 화면 뷰포트에 실제로 보이는 20~30개의 행만 실제 DOM에 렌더링하고 나머지는 가상 여백으로 유지하는 **가상화(Virtualization / Windowing)** 기법을 결합하여, 데이터가 무한히 늘어나도 60 FPS의 부드러운 스크롤 성능을 영구 보장합니다.

5. **정렬/필터 변경 시 표준 UX 리셋 규격 (Reset to Page 1 & Scroll to Top)**:
   - 사용자가 스크롤을 내리다 정렬이나 필터 조건을 변경할 경우, TanStack Query Key 갱신을 통해 기존 누적 데이터를 새 조건의 **`page: 1` (첫 20건)으로 즉시 교체**하고, 가상 스크롤을 **테이블 최상단(1번 행)으로 자동 복귀**시켜 최상위 결과를 즉시 확인할 수 있도록 합니다.

---

## 2. 목표 및 비목표 (Goals & Non-Goals)

### Goals

1. **컨슈머 라우트 정보 구조(IA) 개편 (Table-First)**:
   - `/consumer/forms/[id]`의 기본 뷰를 기존 `ConsumerFormSubmitter`(빈 작성 폼)에서 `ManageFormSubmissions`(데이터 목록 테이블)로 승격.
   - `/consumer/forms/[id]/new` 라우트를 신설하여 빈 폼 작성 전용 화면으로 분리.
2. **서버 사이드 멀티 정렬, 컬럼별 필터 및 페이징 API 구축**:
   - `GET /api/v1/forms/[id]/submissions` 엔드포인트에 `page`, `limit`, `sort`(다중 정렬: `field:order,...`), `filters`(컬럼별 필터 JSON) 쿼리 도입.
   - Drizzle ORM 기반 PostgreSQL JSONB 동적 필드 정렬(`sql`${formSubmissions.data}->>${id}``) 및 `ILIKE` 부분 검색 지원.
   - 표준 페이징 응답 객체 반환 (`items`, `page`, `limit`, `totalCount`, `totalPages`, `hasMore`).
3. **TanStack Table 기반 헤드리스 데이터 그리드 구현 (`@tanstack/react-table`)**:
   - `shared/ui/table.tsx` 및 `shared/ui/popover.tsx` (shadcn/ui 프리미티브) 도입.
   - 폼 활성 필드 기반 동적 `ColumnDef` 생성.
   - **다중 컬럼 정렬(Multi-Sort)**: Shift+클릭 또는 순차 클릭을 통한 복합 정렬 서버 연동 (`manualSorting: true`).
   - **다중 컬럼 팝오버 복합 필터(Multi-Column Popover Filtering)**: 헤더 우측 필터 아이콘 클릭 시 Popover 인풋을 통해 검색어 입력. 단일 컬럼뿐만 아니라 **여러 컬럼에 동시에 필터를 적용(AND 조건 결합)**할 수 있으며, 필터가 적용된 컬럼 헤더는 아이콘 강조색을 표시하고 팝오버 내부 [필터 초기화] 버튼으로 손쉽게 해제 지원.
   - **컬럼 리사이징(Column Resizing)**: 마우스 드래그를 통한 컬럼 너비 조절 지원.
   - **컬럼 가시성(Column Visibility)**: 사용자가 원하는 필드만 선별하여 보거나 숨기는 토글 UI 제공.
   - **레이아웃 가드레일**: 헤더 및 데이터 행(Cell) 전체 텍스트 줄바꿈 방지(`whitespace-nowrap`), 초과 시 말줄임(`truncate`), 마우스 오버 툴팁(`title`), 고정 행 높이(Fixed Row Height) 유지, 최소 너비 보장 및 가로 스크롤(`overflow-x-auto`) 적용.
4. **TanStack Virtual 기반 가상화 렌더링 (`@tanstack/react-virtual`)**:
   - `useVirtualizer` 훅을 연동하여 뷰포트 내 가시 영역(20~30행)만 실제 DOM에 렌더링.
   - 가상 스크롤 하단 도달 시 `useInfiniteQuery`의 `fetchNextPage()`를 자동 트리거하는 부드러운 무한 스크롤 완성.
   - 정렬/필터 변경 시 가상 스크롤 `scrollToIndex(0)` 호출로 테이블 최상단 복귀.
5. **화면 간 물리적 버튼 및 네비게이션 동선 정비**:
   - 데이터 목록 화면 상단에 "신규 데이터 작성" 링크 버튼 배치 및 신규 작성 화면 상단에 "← 데이터 목록으로 돌아가기" 링크 버튼 배치.
   - 신규 응답 제출 완료 후 해당 폼의 데이터 목록 화면(`/consumer/forms/[id]`)으로 자동 이동하여 등록 결과 확인.
6. **AI Navigator 컨슈머 프롬프트 및 도구 라우팅 정규화**:
   - 에이전트가 "A 폼 열어줘/확인할래"라고 하면 데이터 목록(`/consumer/forms/[id]`)으로 이동.
   - "A 폼 작성할래/채워줘"라고 하면 작성 화면(`/consumer/forms/[id]/new`)으로 이동 후 입력.

### Non-Goals

- **셀 단위 인라인 스프레드시트 편집 배제**: 행(Row)별 수정 페이지 이동을 기본 워크플로우로 유지하며, 셀 내부 직접 더블클릭 수정은 배제.
- **물리적 버튼 축소 및 삭제 배제**: 기존의 신규 작성, 수정, 삭제 등 모든 물리적 버튼 인터랙션은 정상 유지.
- **별도 HUD 위젯 신설 배제**: 화면 구성 전환과 데이터 테이블 고도화에 집중.

---

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

### 1) 라우트 구조 맵

```text
src/app/consumer/
├── forms/
│   ├── page.tsx                           # 발행된 도메인 폼 카드 목록
│   └── [id]/
│       ├── page.tsx                       # [승격] 가상화 무한 스크롤 TanStack Table 화면 (기본 랜딩)
│       ├── new/
│       │   └── page.tsx                   # [신설] 신규 데이터 작성 폼 화면
│       └── submissions/
│           ├── page.tsx                   # [호환성 유지] /consumer/forms/[id]로 리다이렉트
│           └── [submissionId]/
│               └── edit/
│                   └── page.tsx           # 기존 데이터 상세 및 수정 화면
```

### 2) 페이징, 멀티 정렬, 컬럼 필터 계약 (Schema & Interfaces)

```typescript
// GET /api/v1/forms/[id]/submissions 쿼리 파라미터 스키마
export const submissionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // 1. 다중 정렬 포맷 (예: "f_experience:desc,createdAt:desc")
  sort: z.string().optional().default("createdAt:desc"),
  // 2. 컬럼별 필터 포맷 (예: '{"f_applicant":"홍길동","f_role":"엔지니어"}')
  filters: z.string().optional(),
});

export type SubmissionQueryParams = z.infer<typeof submissionQuerySchema>;

// 페이징 응답 계약
export interface PaginatedSubmissionsResponse {
  items: FormSubmission[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}
```

### 3) FSD 아키텍처 계층 배치

```text
src/
├── shared/
│   └── ui/
│       ├── table.tsx                      # [신설] shadcn/ui Table 프리미티브
│       └── popover.tsx                    # [신설] shadcn/ui Popover 프리미티브 (헤더 필터용)
├── entities/
│   └── form-submission/
│       ├── schema/
│       │   └── submission-query.schema.ts # [신설] 페이징/멀티정렬/컬럼필터 스키마 및 타입
│       ├── server/
│       │   └── form-submission.server.ts  # [확장] findSubmissionsPaginated (OFFSET 페이징, JSONB 멀티 정렬 및 ILIKE 필터)
│       └── queries/
│           ├── form-submission.queries.ts # [확장] useInfiniteFormSubmissionsQuery
│           └── form-submission.keys.ts    # [확장] 정렬/필터 캐시 키 팩토리
├── features/
│   ├── manage-form-submissions/
│   │   └── ui/
│   │       ├── submission-list-table.tsx  # [개선] 가상 스크롤, 팝오버 필터, 말줄임/가로스크롤 적용
│   │       └── manage-form-submissions.tsx # [개선] 상단 '신규 작성' 버튼 및 헤더 동선 정비
└── app/
    └── api/v1/forms/[id]/submissions/
        └── route.ts                       # [확장] GET 요청 쿼리 파싱 및 페이징 응답 반환
```

---

## 4. 마일스톤 및 검증 계획 (Milestones & Verification)

- **마일스톤 1**: 패키지 설치 (`@tanstack/react-table`, `@tanstack/react-virtual`) 및 shadcn/ui 컴포넌트(`table.tsx`, `popover.tsx`) 추가
- **마일스톤 2**: 서버 페이징/멀티정렬/컬럼필터 인프라 구현 (스키마 -> 서버 함수 -> API 라우트) 및 단위 테스트
- **마일스톤 3**: 클라이언트 무한 스크롤 쿼리 훅(`useInfiniteFormSubmissionsQuery`) 및 쿼리 키 팩토리 구축
- **마일스톤 4**: 라우트 재배치 (`[id]` 목록 승격 + `[id]/new` 작성 뷰 신설)
- **마일스톤 5**: `SubmissionListTable`에 가상화 TanStack Table 구현 (멀티정렬, 팝오버 필터, 리사이징, 가로스크롤, 텍스트 말줄임)
- **마일스톤 6**: 상단 동선 버튼 연결 및 제출 완료 후 목록 자동 이동 연동
- **마일스톤 7**: AI Navigator 컨슈머 프롬프트 및 도구 라우팅 갱신
- **마일스톤 8**: 올인원 통합 검증 (`npm run verify`) 완주 (타입체크, 린트, 포맷, 단위/컴포넌트 테스트 0건 결함)
