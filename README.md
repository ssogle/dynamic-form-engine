# AI Dynamic Form Builder & Runtime Engine

[![CI](https://github.com/ssogle/dynamic-form-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/ssogle/dynamic-form-engine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **자연어 기반 관계형 도메인 폼 빌더, 비정형 데이터 정제 런타임 및 결정론적 데이터 분석 엔진**  
> Next.js 16 (App Router) · FSD(Feature-Sliced Design) · SDD(Spec-Driven Development) · TDD Harness  
> **Live Demo**: [https://dynamic-form-engine-bay.vercel.app/](https://dynamic-form-engine-bay.vercel.app/) _(분할 캔버스·가상화 테이블·3D 그래프를 위해 **데스크톱 `1024px` 이상** 환경 권장)_

---

## 1. Why & Executive Summary

### 왜 만들었는가 (Problem Statement -> Solution)

기존의 업무 데이터 도구와 단순 AI 연동 앱은 **워크플로 단절**과 **LLM 신뢰성 부족**이라는 두 가지 구조적 한계를 가집니다:

| 해결하려는 문제 (Problem)                                                                                                                                                        | 본 프로젝트의 해결 방식 (Solution)                                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1) 설계·수집·분석 워크플로의 파편화**<br/>폼/테이블 설계, 비정형 문서·이미지 수기 입력, 조건부 필터링과 집계 리포트가 별도 도구로 분리되어 있고 변경마다 개발·수작업 병목 발생 | **통합 3-Workspace 파이프라인**<br/>자연어 관계형 스키마 설계(`Builder`), 비정형 Vision 정제·입력(`Consumer`), PostgreSQL 집계 기반 리포트(`Analyst`)를 단일 엔진으로 통합    |
| **2) LLM 도입 시 신뢰성·안전성·비용의 딜레마**<br/>AI가 없는 필드를 지어내거나 응답이 쌓인 스키마를 파괴하고, 수치 암산 오류(환각)·무단 변경·전체 DB 덤프로 인한 지연/토큰 폭증  | **결정론적 검증·집계 분리 + 제어된 에이전트 루프**<br/>Zod/낙관적 락 가드, PostgreSQL 서버 집계, 온디맨드 도구 호출, 파괴적 작업 HITL 승인 게이트로 AI 자유도와 안전성을 양립 |

### 핵심 해결 아키텍처 요약

본 프로젝트는 단순 설문 생성기가 아닌 **관계형 도메인 스키마 설계(Builder) -> 정형/멀티모달 데이터 수집(Consumer) -> 서버 집계 기반 분석(Analyst)을 완결하는 통합 데이터 엔진**으로, 애플리케이션 레벨과 엔지니어링 하네스로 다음 3가지 원칙을 강제합니다:

1. **On-Demand Tool Calling & HITL Gate**: 사전 전량 컨텍스트 덤프 대신 온디맨드 조회 도구(`searchForms`, `getFormDetails`, `searchSubmissions`, `getRelatedSubmissions`)와 종단 스텝 조기 종료(`shouldStopAfterTerminalStep`)로 지연과 토큰을 절감하며, 발행·삭제·제출/수정 저장 전 인라인 `[승인]`/`[취소]` 사전 확인 루프를 강제합니다.
2. **Data Integrity & Schema Governance**: 소프트 삭제(`deletedAt`), `version` 컬럼 기반 낙관적 락(`409 Conflict`), 발행 중 폼 수정 보호, 응답 보유 폼의 파괴적 스키마 변경 차단, 단일 진실 원천 `FIELD_CAPABILITY_BY_TYPE` 필터·집계 규격을 적용했습니다.
3. **Deterministic Server Analytics**: LLM 암산을 금지하고 Drizzle + PostgreSQL 집계(`aggregateFormSubmissions`) 및 결정론적 교차 연산기(`computeSeriesMetric`) 결과만을 근거로 `text`, `table`, `chart` 블록 분석 뷰를 생성합니다.

### Live Demo & Quick Walkthrough (1분 체험 시나리오)

사전 구성된 샘플 폼과 연결 데이터를 기준으로 배포된 [Live Demo](https://dynamic-form-engine-bay.vercel.app/)에서 전체 흐름을 바로 확인할 수 있습니다:

1. **Builder (`/builder/forms`)**: 3D 관계 그래프와 폼 목록을 탐색한 뒤, 개별 폼 캔버스에서 필드 카드의 `AI로 수정`을 눌러 예) `"우선순위 선택 필드를 추가해줘"`를 실행해 실시간 스키마 갱신 및 데이터 미리보기를 확인합니다.
2. **Consumer (`/consumer`)**: 발행된 폼에 신규 데이터를 제출하거나(이미지 첨부 시 Gemini Vision 자동 입력 + `[승인]`/`[취소]` HITL 카드), 다중 컬럼 필터·정렬·관계형 레코드 피커로 실데이터를 탐색합니다.
3. **Analyst (`/analyst/views`)**: 예) `"최근 매출과 비용을 프로젝트별로 비교하는 차트와 요약 표를 만들어줘"`로 서버 집계 기반 분석 뷰를 작성하고, 블록 하단 `[원본 데이터 보기]` 링크로 컨슈머 필터링 목록까지 드릴다운합니다.

---

## 2. 3-Workspace Product Architecture

```text
/ (Landing Gateway + 자동 회전 3D 온톨로지 배경)
├── /builder   (Builder Workspace: 스키마 설계, 라이브 프리뷰, 3D 도메인 관계 그래프)
├── /consumer  (Consumer Workspace: 데이터 입력/수정/검색, 멀티모달 Vision 입력, 가상화 테이블)
└── /analyst   (Analyst Workspace: 서버 집계 기반 블록형 분석 뷰 문서 작성 및 발행)
```

| 워크스페이스 | 주요 경로                                                                                                   | 핵심 기능 및 책임                                                                                                                                                                                                                                         |
| :----------- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Landing**  | `/`                                                                                                         | DB 무조회 자동 회전 3D 온톨로지 배경(`LandingOntologyBackground`), 빠른 체험 가이드 카드, 전역 `error.tsx` / `not-found.tsx` 복구 화면 및 3개 역할 포털 게이트웨이                                                                                        |
| **Builder**  | `/builder/forms`, `/builder/forms/[id]`                                                                     | 9종 도메인 필드 설계, `primaryFieldId` 지정, 필드 타입 배지 및 Click-to-Mention(`AI로 수정`), 관계형 피커 위젯 연동, 실데이터 우선 목록 프리뷰, 상단 발행 토글(`공식 발행`/`발행 취소`), `/builder/forms` 3D 관계 그래프 + 목록 스플릿 뷰                 |
| **Consumer** | `/consumer`, `/consumer/forms/[id]`, `/new`, `/submissions/[submissionId]`, `/edit`, `/consumer/views/[id]` | 발행된 폼 입력/수정, 영수증/명세서 이미지 첨부 Gemini Vision 자동 입력(`fillFields`), 제출/수정 저장 HITL 승인, TanStack Virtual 테이블 + URL 동기화 통합 필터(기간·옵션 코드 정규화 포함)/정렬, `relations` 역참조 목록, 발행 스냅샷 분석 뷰 열람        |
| **Analyst**  | `/analyst/views`, `/analyst/views/[id]`                                                                     | PostgreSQL 서버 레벨 `count`/`sum`/`avg`/`min`/`max` · 시계열 · `relation`/옵션 기준 그룹 집계, Zero-fill 교차 연산, 파생 지표·기존 블록 정렬(`SORT_BLOCK_DATA`), Recharts(`bar`, `line`, `pie`) 차트·테이블·마크다운 블록별 `AI로 수정` 및 `sourceLinks` |

> [!NOTE]
> `/builder`, `/consumer`, `/analyst` 작업 공간은 좌/우 도킹형 AI Navigator 패널(`w-80 lg:w-96`), 라이브 캔버스, 가상화 데이터 테이블, 3D 그래프의 사용성을 보장하기 위해 **데스크톱(`1024px` 이상) 전용**으로 설계되었으며, `1024px` 미만 뷰포트 진입 시 `WorkspaceSplitShell`이 데스크톱 안내 가드 카드를 표시합니다.

### Product Screenshots

#### 1) Builder — 3D 도메인 관계 그래프 & 폼 목록 분할 보기

등록된 도메인 폼과 `relation` 연결 구조를 WebGL 3D 그래프(`react-force-graph-3d`)로 시각화하고, 발행/초안 상태별 폼 목록과 함께 탐색합니다.

![Builder 3D 도메인 관계 그래프 및 목록 분할 보기](assets/builder-relation-graph.jpg)

#### 2) Builder — 자연어 폼 스키마 생성 & 실시간 라이브 캔버스

자연어 요청만으로 대표 필드(`PRIMARY`), 다른 폼과의 관계 참조(`relation`), 선택 옵션이 포함된 폼 스키마를 즉시 생성하고 실시간으로 편집합니다.

![Builder 자연어 폼 생성 및 실시간 캔버스](assets/builder-live-canvas.jpg)

#### 3) Builder — 고위험 작업 실행 전 HITL 사전 승인 게이트

삭제·발행·제출 등 데이터 변이를 수반하는 도구는 LLM이 즉시 실행하지 않고 인라인 `[취소]`/`[승인]` 카드로 사용자 확인을 거친 뒤 결정론적으로 실행합니다.

![AI Navigator HITL 사전 승인 카드](assets/builder-hitl-confirmation.jpg)

#### 4) Consumer — AI 상대 날짜/수치 필터링 & 가상화 데이터 목록

`"이번달 10만원 이상 비용 목록"` 같은 자연어 질의를 날짜 범위(`2026-11-01 ~ 2026-11-30`)와 수치 필터로 변환해 URL·필터 칩·TanStack Virtual 테이블에 즉시 동기화합니다.

![Consumer AI 필터링 및 가상화 데이터 목록](assets/consumer-filtered-list.png)

#### 5) Analyst — 관계형 서버 집계·교차 연산 & 블록 단위 AI 차트 수정

PostgreSQL 서버 집계(`매출 청구` + `비용 지출`)와 `computeSeriesMetric` 교차 연산 결과를 바탕으로 차트·표 리포트를 생성하고, 특정 블록만 지정해 수정하며 `[원본 데이터 보기]`로 드릴다운합니다.

![Analyst 서버 집계 차트 및 블록 AI 수정](assets/analyst-comparison-chart.png)

---

## 3. System Architecture & Runtime Pipeline

### 1) AI Navigator 오케스트레이션 (`POST /api/v1/navigator?stream=1`)

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant Shell as NavigatorShell (Client)
    participant API as Next Route (/api/v1/navigator)
    participant Engine as runNavigatorEngine (Server)
    participant Gemini as Gemini (Vercel AI SDK)
    participant DB as PostgreSQL (Drizzle ORM)

    User->>Shell: 자연어 요청 또는 이미지 첨부 + [전송]
    Shell->>API: currentContext 스냅샷 + 최근 6개 대화 + stream=1
    API->>Engine: NAVIGATOR_MODE_REGISTRY[mode] 전략 선택
    Engine->>Gemini: 온디맨드 도구 + 화면 맥락 전달 (NDJSON 진행 상태 스트리밍)
    opt 정보 탐색 필요 시
        Gemini-->>Engine: searchForms / getFormDetails / searchSubmissions / aggregateFormSubmissions
        Engine->>DB: Zod 검증 후 정형 조회/집계
        DB-->>Gemini: 조회 결과 반환
    end
    alt 사전 승인 대상 도구 (publish*, delete*, submitForm)
        Engine-->>Shell: PENDING_CONFIRMATION 인라인 승인 카드 반환 (즉시 조기 종료)
        User->>Shell: [승인] 클릭
        Shell->>API: confirmedAction 전송 -> LLM 재호출 없이 결정론적 직접 실행
    else 일반 종단 UI 액션 (navigate, fillFields, createForm, updateSchema 등)
        Engine-->>Shell: clientActions 즉시 반환 (2단계 LLM 왕복 생략)
    end
    Shell->>Shell: Zustand/React Hook Form/TanStack Query 반영 및 라우팅
```

### 2) 데이터베이스 물리 스키마 (`src/shared/tables/`)

- `forms.table.ts`: 폼 메타데이터, JSONB `schemaDefinition` (`primaryFieldId` + `fields`), `publishedAt`, `version`(낙관적 락), `deletedAt`
- `form-submissions.table.ts`: 제출 응답 JSONB `data`, `formId` FK(`forms.id`, CASCADE), `version`, `deletedAt`, 활성 부분 인덱스(`idx_form_submissions_active`)
- `relations.table.ts`: `relation` 필드 저장 시 동기화되는 경량 엣지 인덱스 — 복합 PK `(sourceId, targetId, fieldId)`, `sourceId`/`targetId` FK(`form_submissions.id`, CASCADE), 정방향/역방향 인덱스(`idx_relations_source`, `idx_relations_target`)로 단건 상세 역참조 및 AI `getRelatedSubmissions` 추적 지원
- `analysis-views.table.ts`: 블록(`text`, `table`, `chart`) 기반 분석 뷰 JSONB `blocks`, `publishedAt`, `version`, `deletedAt`, 활성/발행 부분 인덱스

### 3) API 엔드포인트 (`src/app/api/v1/`)

- `GET/POST /api/v1/forms`, `GET/PATCH/DELETE /api/v1/forms/:id`, `POST /api/v1/forms/:id/publish` (Hono Router)
- `GET/POST /api/v1/forms/:id/submissions`, `GET/PATCH/DELETE /api/v1/forms/:id/submissions/:submissionId` (Hono Router — 다중 필터·정렬·기간·배치 ID 조회 포함)
- `GET /api/v1/analysis-views`, `GET/DELETE /api/v1/analysis-views/:id`, `POST /api/v1/analysis-views/:id/publish` (Hono Router — 뷰 생성·블록 편집은 Navigator Analyst 도구로 수행)
- `GET /api/v1/relations` (Hono Router — 역참조 연결 내역 조회)
- `POST /api/v1/navigator` (Next.js Route Handler, `maxDuration = 60` — NDJSON 스트리밍 `?stream=1` 및 JSON 응답 AI 실행)

---

## 4. Tech Stack

| 계층                      | 채택 기술                                                                                                                             |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework / UI**        | Next.js `16.4.6` (App Router, Turbopack), React `19.3.0`, TypeScript `5` (Strict), Tailwind CSS `v4`, shadcn/ui, Lucide Icons, Sonner |
| **State / Query / Table** | TanStack Query `v5`, TanStack Table `v8`, TanStack Virtual `v3`, React Hook Form `v7`, Zod `v4`, Zustand `v5`                         |
| **Visualization**         | Recharts `v3` (Bar/Line/Pie), `react-force-graph-3d` + `three-spritetext` (WebGL 3D 관계 그래프), `react-markdown` + `remark-gfm`     |
| **Backend / DB**          | Hono `v4`, Drizzle ORM + `drizzle-zod`, PostgreSQL (`postgres`)                                                                       |
| **AI Runtime**            | Vercel AI SDK (`ai` `v7`) + `@ai-sdk/google` (`gemini-flash-latest` / `gemini-flash-lite-latest`)                                     |
| **Test / Quality**        | Vitest `v3`, ESLint (`eslint-plugin-boundaries`, `eslint-plugin-check-file`), Prettier, Husky, Commitlint                             |

---

## 5. Architecture & Engineering Harness

### Feature-Sliced Design (FSD) & Evolutionary Architecture

단방향 결합도와 관심사 분리를 보장하기 위해 **FSD(Feature-Sliced Design)** 레이어 구조를 따르며, 코드의 크기나 UI 외형이 아닌 **유스케이스와 공유 관계**를 기준으로 레이어를 결정합니다:

```text
▲ (상위: 비즈니스 결합도 높음 — 상위 레이어는 하위 레이어만 참조 가능)
│
├── src/app/       # [최상위 진입점] Thin App Router, 워크스페이스 쉘, Hono/Next API Route Handlers
├── src/widgets/   # [피처 조립 레이어] 2개 이상의 Feature/Entity가 결합하는 복합 독립 구획
│                  #   (navigator-shell, builder-form-preview, relational-form-picker)
├── src/features/  # [유스케이스 출발점] 모든 사용자 비즈니스 행위와 상호작용의 기본 단위
│                  #   (execute-navigator-action, manage-builder-forms, manage-form-submissions,
│                  #    manage-analysis-views, browse-published-forms, render-dynamic-form, render-analysis-view)
├── src/entities/  # [하향된 도메인 모델] 복수 피처가 공유하는 도메인 스키마·쿼리·스토어·서버 영속성
│                  #   (form, form-submission, analysis-view)
└── src/shared/    # [하향된 기술 도구] 도메인 무관 공용 UI(shadcn/ui, 배럴 금지), DB DDL, HTTP/Date/AI/Zod 유틸리티
│
▼ (하위: 재사용성 높음 — 동일 레이어 간 수평 참조 및 역방향 참조 금지)
```

- **Feature-First 진화적 3단계 라이프사이클 (위젯 모놀리스 방지)**:
  1. **기능 우선 (`features/`)**: 모든 신규 유스케이스는 `features/*`에서 시작하여 비즈니스 로직이 없는 Thin App Router(`app/*`)에 직접 배치합니다. (단일 피처만 감싸는 껍데기 위젯 금지)
  2. **공유 시 하향 추출 (`entities/` vs `shared/`)**: 동일 레이어 간 수평 참조(`cross-feature import`)를 금지하고, 여러 피처가 함께 쓰는 코드는 도메인 의미가 있으면 `entities/*`(예: 초안 스토어, 엔티티 쿼리/스키마)로, 도메인 무관 순수 도구면 `shared/*`로 하향 추출합니다.
  3. **복합 구획 조립 시 상향 승격 (`widgets/`)**: 2개 이상의 독립된 Feature/Entity가 한 화면 구획에서 유기적으로 맞물려야 할 때만 `widgets/*`로 승격 조립합니다.
- **표준 세그먼트 & Public API (`index.ts` / `server.ts`) 경계 분리**:
  - 모호한 `model/`·`api/` 대신 역할이 명확한 세그먼트(`ui`, `hooks/use-*.hook.ts`, `queries`, `server/*.server.ts`, `store`, `schema`, `types`, `lib`, `tables`) 중 필요한 것만 선택 구성하며, `eslint-plugin-check-file`로 전 경로 `kebab-case`를 강제합니다.
  - 외부 레이어는 반드시 슬라이스 루트 진입점만 참조하며, 클라이언트·공용 진입점(`index.ts`)과 `import "server-only"` 기반 서버 전용 진입점(`server.ts`)을 분리해 브라우저 번들로의 DB/비밀키/서버 로직 유출을 빌드 타임에 차단합니다.

### Engineering Harness Guardrails

| 분류              | 가드레일 / 규칙                                              | 핵심 목적                                                                                   | 문서                                                                                                                |
| :---------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| **FSD & 네이밍**  | `eslint-plugin-boundaries`, `check-file`                     | 레이어 단방향 의존성, Public API(`index.ts`/`server.ts`) 강제, `kebab-case` 통일            | [.agents/rules/fsd-architecture-rule.md](.agents/rules/fsd-architecture-rule.md)                                    |
| **코딩 패러다임** | `no-restricted-syntax`, Result 패턴                          | 함수형 지향(`class`/`this` 금지), `{ data, error }` 반환, YAGNI                             | [.agents/rules/coding-paradigm-rule.md](.agents/rules/coding-paradigm-rule.md)                                      |
| **Zod SSOT**      | Schema-First 거버넌스                                        | `tables/*.table.ts` vs `schema/*.schema.ts` vs `types/*.types.ts` 역할 분리                 | [.agents/rules/zod-schema-governance-rule.md](.agents/rules/zod-schema-governance-rule.md)                          |
| **날짜/시간**     | `no-restricted-imports` + `@/shared/lib/date` + `sql`now()`` | Store in UTC, Display in Local, 중앙 DB 시계 권한, 서드파티 직접 import 차단                | [.agents/rules/date-and-time-rule.md](.agents/rules/date-and-time-rule.md)                                          |
| **UI & 스타일링** | `@/shared/ui` 직접 임포트, Tailwind v4 시맨틱 토큰           | 배럴 파일 금지, 시스템 팝업(`alert`/`confirm`) 금지, `Thin View` + `use-*.hook.ts` 분리     | [.agents/rules/ui-and-styling-rule.md](.agents/rules/ui-and-styling-rule.md)                                        |
| **테스트 전략**   | Vitest (`*.test.ts`, `dom`/`node` 분리)                      | 85개 테스트 파일 / 598개 단위 테스트 (`jsdom` 훅·쿼리 vs `node` 서버·스키마·로직 분리 실행) | [.agents/rules/testing-strategy-rule.md](.agents/rules/testing-strategy-rule.md)                                    |
| **SDD & Git**     | `docs/specs/{active,archived}`, Husky + Commitlint           | 스펙 선설계 후 구현·완료 시 아카이빙 동결, GitHub Flow 및 PR 템플릿 준수                    | [SDD 규칙](.agents/rules/spec-driven-development-rule.md) / [Git 규칙](.agents/rules/git-commit-automation-rule.md) |
| **CI 자동 검증**  | GitHub Actions (`.github/workflows/ci.yml`)                  | Node 24 기반 `check`(정적 검사) + `test`(Vitest) 병렬 게이트                                | [ci.yml](.github/workflows/ci.yml)                                                                                  |

### Schema-First Development (Zod Single Source of Truth)

정적 데이터 계약과 동적 폼 런타임 검증 모두 단일 스키마에서 파생해 계층 간 불일치를 원천 차단합니다:

- **단일 진실 원천(`schema/*.schema.ts`)**: `z.infer`/`z.input`으로 TypeScript 타입을 파생하여 수동 인터페이스 중복 선언을 금지하고, Hono API 경계 검증(`parseRequestData`)과 AI Tool 입출력 스키마까지 동일한 Zod 계약을 공유합니다.
- **동적 런타임 스키마 파생**: 저장된 폼 스키마(`schemaDefinition`)로부터 `buildDynamicFormSchema` / `validateSubmissionData`가 클라이언트 React Hook Form 검증기와 서버 제출 검증기를 결정론적으로 생성하며, 조회·정렬·집계 가능 여부는 `FIELD_CAPABILITY_BY_TYPE`에서 일관되게 파생됩니다.

### Agentic Engineering Workflow (Harness-Driven Development)

본 프로젝트는 AI 코딩 에이전트를 단순 코드 생성기가 아닌 **규칙과 테스트로 통제되는 협업 파트너**로 운영하기 위해 다음 4단계 하네스 루프를 적용했습니다:

1. **명세 선행(Spec-First)**: 구현 전 [AGENTS.md](AGENTS.md)와 `.agents/skills/spec-authoring/` 스킬을 통해 Goals/Non-Goals, FSD 배치, Zod 계약을 합의하고 `docs/specs/active/`에 기록합니다.
2. **정적 가드레일(Static Guardrails)**: `eslint-plugin-boundaries`, `check-file`, `no-restricted-imports`(날짜 라이브러리 직접 import 차단), `no-restricted-syntax`(`class`/`this` 금지)로 아키텍처 드리프트를 컴파일·린트 단계에서 즉시 차단합니다.
3. **로직 중심 TDD(High-ROI Unit Tests)**: 외부 인프라(DB/LLM)에 의존하지 않는 순수 비즈니스 로직·스키마·스토어·서버 계약을 Vitest 단위 테스트로 고정합니다.
4. **PR 단위 CI 게이트 및 아카이빙**: `npm run verify` 통과 후 완료된 스펙을 `docs/specs/archived/`로 동결하고, GitHub Actions CI를 통과한 PR만 `master`에 머지합니다.

---

## 6. Spec-Driven Evolution (Archived Specs 001 ~ 018)

완료된 모든 기능 명세와 기술 의사결정 이력은 [`docs/specs/archived/`](docs/specs/archived/)에 읽기 전용으로 보존되어 있습니다.

| 번호 | 스펙 문서                                                                                                                | 핵심 구현 내용                                                                                                               |
| :--- | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| 001  | [001-autonomous-navigator-core.md](docs/specs/archived/001-autonomous-navigator-core.md)                                 | 동적 폼 엔진 기반 및 AI Builder 프로토타입 구축                                                                              |
| 002  | [002-consumer-form-submission-core.md](docs/specs/archived/002-consumer-form-submission-core.md)                         | 컨슈머 동적 폼 렌더링, Zod 동적 검증 및 제출 파이프라인                                                                      |
| 003  | [003-on-demand-navigator-engine.md](docs/specs/archived/003-on-demand-navigator-engine.md)                               | 전략 레지스트리 및 온디맨드 도구 호출 기반 AI 오케스트레이션 통합                                                            |
| 004  | [004-consumer-data-domain-workspace.md](docs/specs/archived/004-consumer-data-domain-workspace.md)                       | TanStack Virtual 기반 컨슈머 데이터 워크스페이스 및 상세/수정 CRUD                                                           |
| 005  | [005-relational-domain-link-and-select-options.md](docs/specs/archived/005-relational-domain-link-and-select-options.md) | `relation` 외래키 연결, `relations` 인덱스 테이블, `select` 옵션 메타데이터                                                  |
| 006  | [006-hono-api-router.md](docs/specs/archived/006-hono-api-router.md)                                                     | `/api/v1/*` Hono API 라우터 도입 및 검증 미들웨어 표준화                                                                     |
| 007  | [007-analyst-knowledge-studio.md](docs/specs/archived/007-analyst-knowledge-studio.md)                                   | 서버 집계 기반 Analyst Studio 및 `text`/`table`/`chart` 분석 뷰                                                              |
| 008  | [008-unified-field-filter-engine.md](docs/specs/archived/008-unified-field-filter-engine.md)                             | `FIELD_CAPABILITY_BY_TYPE` 통합 필드/기간/정렬 필터 엔진                                                                     |
| 009  | [009-workspace-app-switcher-layout.md](docs/specs/archived/009-workspace-app-switcher-layout.md)                         | 글로벌 앱 바 및 3-Workspace 좌우 분할 레이아웃 통일                                                                          |
| 010  | [010-builder-form-multi-view-preview.md](docs/specs/archived/010-builder-form-multi-view-preview.md)                     | 빌더 다중 뷰 미리보기(폼/목록/상세/분석) 지원                                                                                |
| 011  | [011-data-integrity-and-schema-governance.md](docs/specs/archived/011-data-integrity-and-schema-governance.md)           | `version` 낙관적 락, 발행 폼 수정 보호, `select`/`relation` 배열 포맷 통일                                                   |
| 012  | [012-consumer-ai-accuracy-and-filtering.md](docs/specs/archived/012-consumer-ai-accuracy-and-filtering.md)               | 상대 날짜 컨텍스트, 옵션 코드 정규화, `submitForm` 선검증, 목록 필터·검색 도구                                               |
| 013  | [013-ai-chat-multimodal-hitl-and-ux-polish.md](docs/specs/archived/013-ai-chat-multimodal-hitl-and-ux-polish.md)         | 마크다운 통합 렌더러, Gemini Vision 이미지 입력, HITL 사전 승인 카드, 역참조 테이블 통합                                     |
| 014  | [014-relation-graph-visualization.md](docs/specs/archived/014-relation-graph-visualization.md)                           | `react-force-graph-3d` + `three-spritetext` 3D 관계 그래프, 랜딩 3D 배경, 제출 HITL·지연 최적화, 모바일 가드                 |
| 015  | [015-workspace-ux-shell-and-focus-polish.md](docs/specs/archived/015-workspace-ux-shell-and-focus-polish.md)             | 랜딩 헤더·다크 테마 통합, `BackLink` 통일, AI 패널 좌/우 도킹·`Cmd+K`, 3D 그래프 드래그/시점·블록 포커스 개선                |
| 016  | [016-unified-table-and-ai-sort-engine.md](docs/specs/archived/016-unified-table-and-ai-sort-engine.md)                   | 관계형 피커·선택결과·상세 테이블 `ManageFormSubmissions` 통합, 정렬 칩·UUID 스키마 통일, AI 파생 지표·`SORT_BLOCK_DATA` 정렬 |
| 017  | [017-studio-ux-preview-and-filter-unification.md](docs/specs/archived/017-studio-ux-preview-and-filter-unification.md)   | 랜딩 데모 안내, 발행 상태 UI 통일, 빌더·분석가 AI 편집 동선, 프리뷰·드릴다운 필터 통합                                       |
| 018  | [018-production-hardening-and-ci.md](docs/specs/archived/018-production-hardening-and-ci.md)                             | `maxDuration=60`, 프로덕션 500 마스킹, `error`/`not-found`, 전용 파비콘, ESLint 0 warnings 및 CI 구축                        |

---

## 7. Intentional Scope Boundaries & Future Extensions

핵심 도메인 엔진 검증에 집중하기 위해 아래 항목은 의도적으로 스코프에서 분리했으며, 현행 구조 위에서 자연스럽게 확장 가능하도록 경계를 유지했습니다:

- **인증 및 멀티테넌트(Auth/RBAC)**: 공개 데모 체험 장벽을 없애고 핵심 엔진에 집중하기 위해 로그인·권한 계층 제외 (Hono 미들웨어 및 테이블 테넌트 키 추가로 확장 가능)
- **추가 필드 타입 확장 (`file`, `email`, `phone`, `rich-text` 등)**: 현재는 관계·정제·집계 검증에 집중해 9종 코어 필드(`text`, `textarea`, `number`, `select`, `radio`, `checkbox`, `date`, `switch`, `relation`)에 한정했으나, 필터·정렬·집계 능력이 `FIELD_CAPABILITY_BY_TYPE` 단일 규격에 선언되어 있어 신규 필드 타입과 입력 컴포넌트를 일관된 계약으로 확장 가능
- **버전 변경 이력 & 시점 롤백 UI**: `version` 기반 낙관적 락(`409 Conflict`)은 구현되었으며, append-only 이력 테이블 및 diff 롤백 UI는 운영 단계 확장에 위임
- **조건부 상태 전이·자동화 워크플로우 엔진**: 도메인 데이터 수집·관계·분석 레이어와 분리해 향후 제출 이벤트 기반 룰 엔진으로 확장
- **모바일 반응형 워크스페이스 / 다국어(i18n) / 추가 차트 유형**: 한국어 단일화 및 데스크톱(`1024px+`) 전용 하드 가드 적용, 차트는 핵심 3종(`bar`, `line`, `pie`)에 집중

---

## 8. Getting Started

### 1) Requirements

- Node.js 22.x 이상 (CI 기준 24.x)
- npm 10.x 이상
- PostgreSQL 데이터베이스 (로컬 Docker, Supabase, Neon 등)

### 2) Environment Variables

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
DIRECT_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3) Database Setup & Run

```bash
npm install
npm run db:migrate
npm run dev
```

### 4) Available Scripts

| 명령어                  | 설명                                                                         |
| :---------------------- | :--------------------------------------------------------------------------- |
| `npm run dev`           | Next.js 로컬 개발 서버 실행 (Turbopack)                                      |
| `npm run build`         | 프로덕션 빌드 생성                                                           |
| `npm run start`         | 프로덕션 서버 실행                                                           |
| `npm run verify`        | `[통합 검증]` 타입체크 -> ESLint -> Prettier 체크 -> Vitest 전체 테스트 완주 |
| `npm run check`         | `[정적 검사]` `typecheck` + `lint` + `format:check`                          |
| `npm run fix`           | `[자동 교정]` Prettier 포맷팅 및 ESLint 자동 수정                            |
| `npm test`              | Vitest 단위 테스트 1회 실행                                                  |
| `npm run test:watch`    | 파일 변경 감지 실시간 TDD 루프                                               |
| `npm run test:coverage` | V8 기반 테스트 커버리지 리포트 생성                                          |
| `npm run typecheck`     | TypeScript 정적 타입 검사 (`tsc --noEmit`)                                   |
| `npm run lint`          | ESLint 검사 (FSD 경계 및 파일 컨벤션 포함)                                   |
| `npm run db:generate`   | Drizzle 마이그레이션 SQL 생성                                                |
| `npm run db:migrate`    | Drizzle 마이그레이션 적용                                                    |
| `npm run db:push`       | 스키마 직접 푸시 (개발용)                                                    |
| `npm run db:studio`     | Drizzle Studio 실행                                                          |
