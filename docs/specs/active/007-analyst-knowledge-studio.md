<!-- 아카이브(동결) 전환 시 아래 WARNING 주석을 해제하고 상단 NOTE 블록을 대체하세요 -->
<!--
> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.
-->

# [Spec-007] Analyst Studio & Analysis View Document Engine

> [!NOTE]
>
> - **상태 (Status)**: Active (기획/구현 중)
> - **브랜치 (Branch)**: `feat/spec-007-analyst-knowledge-studio`
> - **작성일 (Created)**: 2026-11-16
> - **완료일 (Archived)**: -

## 1. 배경 및 문제 정의 (Context & Problem Statement)

- 현재 시스템은 **빌더(`/builder`)**가 좌측 AI Navigator와 대화하며 오른쪽 프리뷰 캔버스에서 동적 폼 스키마(`forms`)를 설계·발행하고, **컨슈머(`/consumer`)**가 발행된 폼에 데이터를 입력·조회·수정·삭제(`form_submissions`)하는 단계까지 구현되어 있습니다.
- 그러나 수집·축적된 데이터를 분석가가 탐색·비교·통계 처리하고, 그 결과를 컨슈머에게 공유·발행할 **분석 뷰(Analysis View) 문서**를 제작하는 전용 앱(`/analyst`)이 부재합니다.
- 컨슈머의 [`src/app/consumer/views/page.tsx`](/src/app/consumer/views/page.tsx)("공유된 뷰 목록") 역시 현재 빈 플레이스홀더로 남아 있어, 데이터 수집 이후 분석과 환류로 이어지는 루프가 끊겨 있습니다.
- 본 스펙은 3자 역할 모델(Builder / Consumer / Analyst)을 완성하는 이번 스프린트의 종착점으로서, **복잡한 자유 배치 BI 대시보드가 아닌 "데이터 분석과 비교가 가능한 블록 기반 분석 뷰 문서"를 AI와 함께 만들고 발행하는 분석가 앱**의 규격을 정의합니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals (이번 작업에서 반드시 달성해야 하는 구체적인 목표)**:
  1. **빌더와 대칭되는 분석가 워크스페이스(`/analyst`) 구축 및 역할별 라우트 정리**:
     - 메인 게이트웨이(`/`)에 빌더/컨슈머/분석가 3자 진입 카드를 배치하고, 각 레이아웃 헤더 간 역할 이동 링크를 제공합니다.
     - 좌측 `NavigatorShell(mode="analyst")` 채팅창과 우측 분석 뷰 문서 캔버스(`/analyst/views`, `/analyst/views/[id]`)를 구성합니다.
     - 분석가는 우측 캔버스에서 AI가 생성·수정한 분석 뷰 문서 결과를 실시간으로 확인하고, 발행/발행 취소(`publish`) 및 삭제할 수 있습니다. (세부 UI를 마우스로 일일이 제어하는 복잡한 편집기는 배제하고, AI 대화 기반 문서 조합에 집중)
     - 3자 역할 분리 원칙에 따라 기존 플레이스홀더인 `/builder/views` 라우트 및 `BuilderLayout`의 "뷰 목록" 탭을 제거하고(빌더 프롬프트/도구 내 관련 참조 포함 정리), 발행된 분석 뷰 열람은 컨슈머(`/consumer/views`) 전용으로 일원화합니다.
  2. **3대 필수 콘텐츠 블록 기반 분석 뷰 문서 규격 (`text`, `table`, `chart`)**:
     - 하나의 분석 뷰 문서는 순서가 있는 블록 배열(`blocks`)로 구성되며, 다음 3가지 필수 블록 타입을 지원합니다:
       - **글 (`text`)**: 분석 요약, 데이터 항목 나열, 비교 해석, 시사점 등을 서술하는 텍스트/마크다운 블록.
       - **데이터 테이블 (`table`)**: 집계 결과, 항목별 비교표, 필터링된 주요 레코드 나열 등을 렌더링하는 표 블록.
       - **차트 (`chart`)**: 비교 및 추이 시각화를 위한 차트 블록 (`bar`, `line`, `pie` 지원, `@/shared/ui/chart` 기반).
  3. **분석 및 비교를 위한 결정론적 서버 통계/조회 엔진**:
     - LLM이 직접 숫자를 계산하거나 대량 데이터를 암산하지 않고, 서버 도구를 통해 정확한 데이터를 조회·집계합니다.
     - 지원 연산:
       - 기본/그룹 집계: 전체 건수(`count`), 숫자 필드 집계(`sum`, `avg`, `min`, `max`), 범주/선택형 필드별 그룹 비교(`groupBy`, `select` 옵션 `value` -> `label` 변환 포함).
       - 시계열 추이 비교: `day`, `week`, `month`, `quarter`(분기) 버킷 기준 집계 (PostgreSQL `DATE_TRUNC` + `AT TIME ZONE` 기반 시간대 경계 보정 및 정규화된 키 포맷: `YYYY-MM-DD`, `YYYY-MM`, `YYYY-Q1`~`YYYY-Q4`).
       - 시리즈 산술 파생 지표 연산: 복수 폼/시리즈 집계 결과 간 차액(`subtract`: 손익 등), 합산(`add`), 비율(`ratio`: 집행률/이익률 백분율)을 서버 도구(`computeSeriesMetric`)로 결정론적 계산.
       - 항목 나열/샘플링: 특정 조건 필터링 및 정렬을 통한 상위 N건 레코드 조회(테이블/글 블록 근거 데이터용).
  4. **분석가 AI Navigator (`mode="analyst"`) 확장**:
     - `NAVIGATOR_MODE_REGISTRY`에 `analyst` 모드를 등록합니다.
     - AI가 분석가 질의에 따라 폼 스키마 조회 -> 서버 집계/레코드 조회 도구 실행 -> 분석 뷰 생성 또는 블록 추가/수정/삭제/재배치 도구를 실행하여 우측 화면을 즉시 갱신합니다.
  5. **분석 뷰 영속화, 발행(Publish) 및 컨슈머 열람 연동**:
     - 신규 물리 테이블 `analysis_views`에 분석 뷰 문서(제목, 설명, `blocks` JSONB, `publishedAt`, `deletedAt`)를 저장합니다. (멀티 소스 분석이 기본이므로 단일 폼 외래키 제약 없이 블록 내 집계/비교 데이터를 스냅샷 형태로 보관합니다.)
     - 컨슈머의 `/consumer/views`에서 발행된(`publishedAt IS NOT NULL`) 분석 뷰 목록을 조회하고, `/consumer/views/[id]`에서 읽기 전용 분석 뷰 문서(글/테이블/차트)를 열람할 수 있도록 연동합니다.

- **Non-Goals (이번 작업에서 의도적으로 배제하는 범위 - 후속 세부 스프린트로 이관)**:
  1. 드래그 앤 드롭 그리드 레이아웃, 위젯 크기 리사이징, 세밀한 마우스 기반 스타일/속성 인스펙터 등 복잡한 BI 대시보드 에디터.
  2. 루트 어드민, 사용자 인증 세션, Tier 1/Tier 2 RBAC 및 대상 그룹별 열람 ACL 매트릭스.
  3. 다중 폼 간 재귀(`WITH RECURSIVE`) 교차 조인 및 임의 문자열 기반 범용 수식 파서(`evaluateExpression`). (단, 복수 폼 집계 결과 간의 기본 사칙연산 파생 지표인 차액/합산/비율은 결정론적 서버 도구 `computeSeriesMetric`으로 지원하며, 복수 폼 집계 결과를 하나의 분석 뷰 문서 내 비교 표/차트/글로 결합하는 것은 허용합니다.)
  4. PDF/PNG/CSV 내보내기 및 개별 서브미션 상세 뷰 하단의 연관 인사이트 자동 탭(`Auto-Discovered Related Lists`) 연동.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - **UI 컴포넌트 사전 준비**:
    - shadcn 공식 레지스트리(`https://ui.shadcn.com/r/index.json`) 조회 결과에 따라 `chart` 컴포넌트(`ui/chart.tsx`, `recharts@3.8.0` 의존성, `card` 레지스트리 의존성)를 `@/shared/ui`에 추가합니다 (`npx shadcn@latest add chart`).
    - 글(`text`) 블록의 안전한 구조화 텍스트/마크다운(제목, 문단, 불릿 리스트, 강조 등) 렌더링은 외부 XSS 위험이 있는 raw HTML 주입 대신 안전한 경량 파서 또는 React 컴포넌트 렌더링으로 처리합니다.
  - `src/shared/tables/analysis-views.table.ts`:
    - `analysis_views` PostgreSQL 테이블 DDL 정의 (`id`, `title`, `description`, `blocks` JSONB, `createdAt`, `updatedAt`, `publishedAt`, `deletedAt`).
  - `src/entities/analysis-view/...`:
    - `schema/analysis-view.schema.ts`: 3종 블록 Discriminated Union(`text`, `table`, `chart`) 및 `analysisView` Zod 스키마.
    - `server/analysis-view.server.ts`: 분석 뷰 목록/상세/발행 목록 조회, 생성, 수정, 발행 토글, 소프트 삭제 Drizzle 쿼리.
    - `queries/`: React Query 키 및 UI 조회/제어 훅 (`useAnalysisViewsQuery`, `usePublishedAnalysisViewsQuery`, `useAnalysisViewDetailQuery`, `usePublishAnalysisViewMutation`, `useDeleteAnalysisViewMutation`).
  - `src/entities/form-submission/...`:
    - `schema/analytics-query.schema.ts`: 서버 통계 집계 요청/응답 Zod 스키마.
    - `server/analytics.server.ts`: 동적 JSONB 필드 집계(`count`, `sum`, `avg`, `min`, `max`, `groupBy`, `timeBucket`), 조건별 레코드 추출 및 다중 폼 비교 시 합집합(Union) 기준 누락 항목 `0` 채움(Zero-fill) 병합/정렬 유틸리티.
  - `src/features/execute-navigator-action/...`:
    - `types/navigator-action.types.ts`: `NavigatorMode`에 `"analyst"` 추가, 분석 뷰 조작 클라이언트 액션(`CREATE_ANALYSIS_VIEW`, `UPDATE_ANALYSIS_VIEW`, `PUBLISH_ANALYSIS_VIEW`, `DELETE_ANALYSIS_VIEWS`, `NAVIGATE`) 및 `AnalysisView` 컨텍스트 필드 추가.
    - `lib/tools/analyst-tools.ts`, `lib/prompts/analyst-prompt.ts`:
      - 폼 데이터 집계/비교/조회 도구, 시리즈 산술 연산 도구(`computeSeriesMetric`), 분석 뷰 문서 블록(`text`, `table`, `chart`) 생성/수정 도구.
      - `computeSeriesMetric`: 두 시리즈(`baseSeries`, `targetSeries`)의 `key` 합집합(Union)을 기준으로 누락 항목을 `0`으로 채운(Zero-fill) 뒤, 항상 `baseSeries(좌항/분자) [연산] targetSeries(우항/분모)` 순서로 `subtract`, `add`, `ratio`를 결정론적으로 계산(분모 `0` 시 `null` 반환).
      - `updateAnalysisView` 도구 설명(`describe`) 및 프롬프트에 단일 블록 추가/수정/삭제/재배치 시 전체 `blocks` 배열을 통째로 덮어쓰지 않고 개별 오퍼레이터(`ADD_BLOCK`, `UPDATE_BLOCK`, `REMOVE_BLOCK`, `REORDER_BLOCKS`, `UPDATE_INFO`)를 우선 사용하도록 명시.
      - 복수 폼의 집계 결과를 공통 축(`groupBy` 또는 `timeBucket`)으로 비교 결합할 때, 전체 항목의 합집합(Union)을 기준으로 특정 폼에 데이터가 없는 항목은 누락하거나 `undefined`로 두지 않고 반드시 `0`으로 채워 정렬하도록 도구/프롬프트 규칙 명시.
    - `server/navigator-engine.server.ts`: `NAVIGATOR_MODE_REGISTRY`에 `analyst` 전략 등록 및 `updatedAnalysisView` 부가 데이터 반환.
  - `src/features/render-analysis-view/...` (및/또는 `src/features/manage-analysis-views/...`):
    - 블록 렌더러: `TextBlockRenderer`, `TableBlockRenderer`, `ChartBlockRenderer`(`@/shared/ui/chart` 활용).
    - 분석가 캔버스(`/analyst/views`, `/analyst/views/[id]`): 분석 뷰 목록 카드/테이블, 문서 프리뷰 캔버스, 발행 스위치/삭제 등 최소 제어 액션.
    - 컨슈머 뷰어(`/consumer/views`, `/consumer/views/[id]`): 발행된 분석 뷰 목록 열람 및 읽기 전용 문서 뷰어.
  - `src/app/api/v1/...`:
    - 통계 집계 및 분석 뷰 생성/블록 수정은 `analyst` AI Navigator(`/api/v1/navigator`)가 서버 도구를 통해 직접 실행합니다.
    - Hono 라우터(`/api/v1/analysis-views`)는 UI가 실제로 호출하는 최소 4개 엔드포인트만 노출합니다:
      - `GET /api/v1/analysis-views` (`?published=true` 지원)
      - `GET /api/v1/analysis-views/:id`
      - `POST /api/v1/analysis-views/:id/publish`
      - `DELETE /api/v1/analysis-views/:id`

- **데이터 계약 (Schema & Interfaces)**:

  ```typescript
  import { z } from "zod";

  // 1. 글 블록 (Text Block): 설명, 데이터 항목 나열, 비교 시사점
  export const textAnalysisBlockSchema = z.object({
    id: z.string().min(1),
    type: z.literal("text"),
    title: z.string().optional(),
    content: z.string().min(1, "본문 내용은 필수입니다."),
  });

  // 2. 데이터 테이블 블록 (Table Block): 집계 비교표, 근거 데이터 목록
  export const tableColumnSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    align: z.enum(["left", "center", "right"]).default("left"),
  });

  export const tableAnalysisBlockSchema = z.object({
    id: z.string().min(1),
    type: z.literal("table"),
    title: z.string().min(1, "테이블 제목은 필수입니다."),
    description: z.string().optional(),
    columns: z.array(tableColumnSchema).min(1),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  });

  // 3. 차트 블록 (Chart Block): 비교 및 추이 시각화
  export const chartSeriesSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
  });

  export const chartAnalysisBlockSchema = z.object({
    id: z.string().min(1),
    type: z.literal("chart"),
    title: z.string().min(1, "차트 제목은 필수입니다."),
    description: z.string().optional(),
    chartType: z.enum(["bar", "line", "pie"]),
    xAxisKey: z.string().min(1),
    series: z.array(chartSeriesSchema).min(1),
    data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  });

  // 분석 뷰 문서 블록 통합 Union
  export const analysisBlockSchema = z.discriminatedUnion("type", [
    textAnalysisBlockSchema,
    tableAnalysisBlockSchema,
    chartAnalysisBlockSchema,
  ]);

  // 서버 통계 집계 요청 파라미터 규격
  export const analyticsAggregationQuerySchema = z.object({
    formId: z.string().uuid(),
    metric: z.enum(["count", "sum", "avg", "min", "max"]).default("count"),
    targetFieldId: z.string().optional(),
    groupByFieldId: z.string().optional(),
    timeBucket: z.enum(["day", "week", "month", "quarter"]).optional(),
    timezone: z.string().default("Asia/Seoul"),
    limit: z.number().int().min(1).max(100).default(50),
  });

  // 결정론적 시리즈 산술 연산 도구(computeSeriesMetric) 계약
  export const seriesMetricPointSchema = z.object({
    key: z.string().min(1),
    value: z.number(),
  });

  export const computeSeriesMetricInputSchema = z.object({
    operation: z
      .enum(["subtract", "add", "ratio"])
      .describe(
        "수행할 연산: 'subtract'(base - target 차액/손익), 'add'(base + target 합산), 'ratio'((base / target) * 100 백분율)"
      ),
    baseSeries: z
      .array(seriesMetricPointSchema)
      .describe("좌항 또는 분자 시리즈 (예: subtract 시 매출, ratio 시 실적 또는 순이익)"),
    targetSeries: z
      .array(seriesMetricPointSchema)
      .describe("우항 또는 분모 시리즈 (예: subtract 시 비용, ratio 시 계획 또는 매출)"),
    resultKey: z.string().min(1).describe("결과 필드 키 이름 (예: 'net_profit', 'execution_rate')"),
  });

  // 분석 뷰 생성/수정 요청 규격 (drizzle-zod 기반, 시스템 관리 타임스탬프 4종 및 id 제외)
  // 물리 테이블 컬럼: id, title, description, blocks(JSONB), createdAt, updatedAt, publishedAt, deletedAt
  // - createdAt / updatedAt / publishedAt / deletedAt 은 PostgreSQL 중앙 시계(defaultNow, sql`now()`)로 UTC 관리
  // - UI 렌더링 시에만 @/shared/lib/date 유틸리티로 로컬 시간대 변환 표시
  export const createAnalysisViewSchema = z.object({
    title: z.string().min(1, "분석 뷰 제목은 필수입니다.").max(255),
    description: z.string().optional(),
    blocks: z.array(analysisBlockSchema).default([]),
  });

  export const analysisViewSchema = createAnalysisViewSchema.extend({
    id: z.string().uuid(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    publishedAt: z.coerce.date().nullable(),
    deletedAt: z.coerce.date().nullable(),
  });

  // 분석 뷰 수정 도구(updateAnalysisView) 오퍼레이터 패턴 계약
  export const analysisViewOperationSchema = z.enum([
    "ADD_BLOCK",
    "UPDATE_BLOCK",
    "REMOVE_BLOCK",
    "REORDER_BLOCKS",
    "UPDATE_INFO",
    "SET_ALL_BLOCKS",
  ]);

  export const updateAnalysisViewInputSchema = z.object({
    viewId: z.string().uuid().describe("수정할 대상 분석 뷰의 고유 ID"),
    operation: analysisViewOperationSchema.describe(
      "수행할 조작 유형. 단일 블록 추가/수정/삭제/재배치 시에는 전체 blocks 배열을 덮어쓰지 말고 반드시 ADD_BLOCK, UPDATE_BLOCK, REMOVE_BLOCK, REORDER_BLOCKS를 사용하세요. 문서 제목/설명만 바꿀 때는 UPDATE_INFO, 전체 구조 재편 시에만 SET_ALL_BLOCKS를 사용합니다."
    ),
    targetBlockId: z
      .string()
      .optional()
      .describe("UPDATE_BLOCK 또는 REMOVE_BLOCK 시 대상 블록의 ID"),
    block: analysisBlockSchema
      .optional()
      .describe("ADD_BLOCK 또는 UPDATE_BLOCK 시 추가하거나 교체할 완성된 블록 객체"),
    insertIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("ADD_BLOCK 시 삽입할 0-based 위치 인덱스 (생략 시 문서 끝에 추가)"),
    orderedBlockIds: z
      .array(z.string())
      .optional()
      .describe("REORDER_BLOCKS 시 기존 블록 ID 전부를 새 순서대로 나열한 배열"),
    blocks: z
      .array(analysisBlockSchema)
      .optional()
      .describe("SET_ALL_BLOCKS 시 전체 블록 배열 일괄 교체용 목록"),
    title: z.string().min(1).max(255).optional().describe("UPDATE_INFO 시 변경할 문서 제목"),
    description: z.string().optional().describe("UPDATE_INFO 시 변경할 문서 설명"),
  });
  ```

- **오류 처리 규격**:
  - 서버 통계 집계, 레코드 조회, 분석 뷰 영속화 로직은 `{ data, error }` Result 패턴 또는 표준 Hono HTTP 에러 규격을 따릅니다.
  - 존재하지 않거나 삭제된 폼 ID 요청, 숫자형이 아닌 필드에 대한 `sum`/`avg` 요청, 잘못된 블록 스키마(예: 차트 `series`가 `data` 키와 불일치)에 대해서는 명확한 검증 오류를 반환합니다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 대시보드 그리드 레이아웃(x, y, w, h) 및 마우스 위젯 편집기 우선 구축**
  - 기각 사유: 초기 스프린트에서 레이아웃 좌표 관리와 드래그 앤 드롭 UI 복잡도가 과도하게 상승하며, 목표인 "AI와 함께 분석·비교 문서를 빠르게 생성하고 발행하는 흐름"을 저해합니다. 세로 흐름의 블록 문서 모델(`text`, `table`, `chart`)이 훨씬 명료하고 확장성이 높습니다.
- **대안 B: 전체 분석 결과를 단일 마크다운 문자열로만 저장**
  - 기각 사유: 마크다운 텍스트만으로는 인터랙티브 차트(`chart`)와 구조화된 데이터 비교표(`table`)를 일관되게 렌더링하거나 특정 블록만 부분 수정하기 어렵습니다. 따라서 `discriminatedUnion` 기반의 3종 구조화 블록 배열을 채택했습니다.
- **대안 C: AI가 응답 원본을 직접 읽어 수치를 계산**
  - 기각 사유: 대량 레코드 처리 시 컨텍스트 한계 및 LLM 산술 오차(환각)가 발생하므로, 반드시 서버 통계 집계 도구를 통해 확정된 수치를 주입합니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**:
  - `form_submissions.data` JSONB에서 숫자형 필드를 추출해 집계할 때, 빈 문자열(`""`)이나 비수치 문자열로 인한 PostgreSQL 타입 캐스팅 오류를 방어해야 합니다.
  - AI가 1턴 내에 `통계 조회 -> 문서 블록 조립`을 수행할 때 `stepCountIs` 상한이 충분한지 확인이 필요합니다.
- **엣지 케이스**:
  - 소프트 삭제된 응답(`deletedAt IS NOT NULL`)과 스키마에서 소프트 삭제된 필드는 집계 및 분석 대상에서 제외해야 합니다.
  - `select` / `radio` / `checkbox` 필드는 저장된 불변 키(`value`) 대신 폼 스키마의 표시명(`label`)으로 매핑해 테이블/차트에 노출해야 가독성이 유지됩니다.
  - `pie` 차트에서 항목이 과도하게 많을 경우(예: 10개 초과) 상위 N개 + 기타 묶음 처리 또는 `bar` 차트 권장을 프롬프트/도구에서 안내해야 합니다.
  - 분석 대상 폼에 제출된 데이터가 0건일 때도 에러 없이 빈 상태 안내 블록 또는 0건 요약을 생성할 수 있어야 합니다.
  - 복수 폼의 집계 결과를 공통 축(`groupBy` 또는 `timeBucket`)으로 비교 결합할 때, 전체 항목의 합집합(Union)을 기준으로 특정 폼에 데이터가 없는 항목은 누락하거나 `undefined`로 두지 않고 반드시 `0`으로 채워 정렬합니다(`timeBucket`은 시간 오름차순, `groupBy`는 일관된 기준 정렬).
  - `updateAnalysisView`에서 `REORDER_BLOCKS` 수행 시 `orderedBlockIds`가 기존 블록 ID 집합과 누락·중복 없이 1:1 일치하는지 검증하고, `UPDATE_BLOCK` 수행 시 기존 블록의 `id`가 변조되지 않도록 보정해야 합니다.
  - `computeSeriesMetric` 실행 시 `ratio` 연산에서 분모(`targetSeries` 값)가 `0`인 경우 `0으로 나누기(division by zero)`를 방어하여 반드시 `null`을 반환해야 하며(테이블은 `-` 등으로 안전 표시, 차트는 null 안전 렌더링), `ratio`는 소수점 둘째 자리 반올림, `add`/`subtract`는 IEEE 754 부동소수점 오차 보정을 적용해야 합니다.
- **미해결 의문**:
  - 현재 단계에서 주요 아키텍처 의사결정 완료 (없음).

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `npx shadcn@latest add chart` 적용 및 `analysis_views` DB 테이블 DDL(`src/shared/tables/analysis-views.table.ts`) 정의
  2. `analysis-view` 엔티티 Zod 스키마(3종 블록: `text`, `table`, `chart`) 및 결정론적 서버 통계 집계/시리즈 산술 연산 엔진 TDD 구현
  3. Hono API 최소 엔드포인트(`/api/v1/analysis-views` 조회·발행·단건삭제) 및 `analyst` AI Navigator 모드(집계/연산/생성/수정/발행/삭제 도구 및 프롬프트) 구현
  4. 분석가 워크스페이스 UI(`/analyst/views`, `/analyst/views/[id]`), `/builder/views` 제거 및 3자 게이트웨이/헤더 연결, 컨슈머 열람(`/consumer/views`, `/consumer/views/[id]`) 연동
- **검증 기준**:
  - `npm test`: 서버 집계 엔진(`count`, `sum`, `avg`, `min`, `max`, `groupBy`, `timeBucket: "day" | "week" | "month" | "quarter"`, KST/UTC 분기 경계, 비정상 수치 방어, `select` 라벨 매핑), `computeSeriesMetric`(`subtract`, `add`, `ratio`, 분모 0 시 `null` 반환, 부동소수점 반올림, key 합집합 Zero-fill), 3종 블록 Zod 스키마 검증, `analyst` Navigator 도구 단위 테스트 전체 통과
  - `npm run verify`: 타입체크, 린트, 포맷, 전체 단위/컴포넌트 테스트 결함 0건 완주
