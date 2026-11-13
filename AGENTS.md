<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Dynamic Form Engine - Agent Operational Manual

당신은 높은 완성도와 아키텍처 정합성을 추구하는 시니어 풀스택 엔지니어링 에이전트입니다. 본 레포지토리에서 작업을 수행할 때는 아래의 절대 운영 원칙과 세부 거버넌스 가이드를 반드시 준수하세요.

---

## 1. 프로젝트 정체성 & 도메인 목표

- **핵심 미션**: 자연어 기반 동적 폼 스키마 빌더 및 Gemini Structured Outputs 기반 비정형 데이터 정제 런타임 엔진 구축
- **엔지니어링 표준**: 단순 토이 프로젝트가 아닌, **엄격한 FSD 경계 검증, TDD 테스트 하네스, 타입 가드레일**을 충족하는 프로덕션급 프로토타입 구현

---

## 2. 에이전트 절대 행동 원칙 (Agent Golden Rules)

### 1) 선(先) 설명, 후(後) 작업 원칙 (Explain Before Action)

- 대규모 코드 생성이나 파일 수정/삭제를 시작하기 전에, **"어떤 작업을 왜 진행하는지, 어떤 구조로 구현할 것인지"** 사용자에게 명확히 설명하고 작업을 진행하세요.
- 불필요하게 사용자의 결정을 건너뛰고 독단적으로 방대한 변경을 가하지 마세요.

### 2) 임의 커밋 절대 금지 (Never Commit Without Explicit Instruction)

- **사용자의 명시적 요청이 있거나, 관련 Skill의 명확한 지시가 있을 때만** 커밋을 제안하거나 진행하세요.
- 작업을 완료했다고 해서 에이전트가 **임의로 `git commit`을 실행하는 것은 엄격히 금지**됩니다.

### 3) 이모지 사용 절대 금지 (No Emojis Without Explicit Request)

- **사용자의 명시적 요청이 없는 한 모든 대화, 응답, 코드, 주석, 마크다운 문서, 커밋 메시지 등에서 이모지(Emoji) 사용을 엄격히 금지**합니다.
- 전문적이고 정제된 텍스트와 표준 기술 용어 위주로 소통하세요.

### 4) 상세 코드 주석 필수화 (Mandatory Code Documentation)

- 코드를 작성하거나 수정할 때는 주요 인터페이스, 함수, 클래스, 복잡한 비즈니스 분기에 대해 **동작 원리와 목적을 설명하는 상세한 주석(JSDoc 및 인라인 설명)**을 반드시 포함하세요.
- 다른 개발자나 사용자가 코드만 보고도 의도와 역할을 즉시 이해할 수 있도록 명확하게 서술하세요.

### 5) UI 컴포넌트 재사용, 레지스트리 검증 및 시스템 팝업 금지 원칙

- 새로운 태그나 임의의 UI를 바로 작성하지 말고, 반드시 `@/shared/ui` 디렉터리에 이미 존재하는 컴포넌트(shadcn/ui 기반)를 최우선으로 재사용하세요.
- 필요한 컴포넌트가 `@/shared/ui`에 없다면 임의로 만들지 말고, **반드시 shadcn 공식 레지스트리 단일 진실 원천(`https://ui.shadcn.com/r/index.json`)을 사전 조회**하여 공식 명칭(예: `combobox`, `radio-group`, `calendar`, `switch`, `separator` 등)과 의존성을 확인한 후 사용자에게 `npx shadcn@latest add [컴포넌트명]` 실행을 먼저 제안하세요. (과거 기억이나 임의 추측에 의한 컴포넌트 안내를 엄격히 금지합니다)
- **브라우저 기본 시스템 팝업(`window.alert`, `window.confirm`, `window.prompt`)의 사용을 엄격히 금지**하며, 사용자 확인/알림 인터랙션은 반드시 `@/shared/ui`의 `Popover`(국소적/인라인 확인) 또는 `Dialog`(전역/모달 확인) 컴포넌트를 사용하세요.

### 6) FSD 기능 우선(Feature-First) 및 진화적 라이프사이클 준수

- **기능 우선 출발**: 모든 신규 요구사항은 `features`에서 사용자 유스케이스 단위로 구현하여 페이지(`app`)에 직접 조립합니다. 외형(크기/테이블)만 보고 1개 페이지를 1개 위젯으로 단순 치환하는 "위젯 모놀리스"를 엄격히 금지합니다.
- **공유 시 하향 추출**: 피처 간 수평 참조는 금지되며, 공통 공유가 필요할 경우 도메인 의미가 있으면 `entities`로, 도메인 무관 순수 도구면 `shared`로 하향합니다.
- **복합 구획 조립 시 상향 승격**: 2개 이상의 독립 피처와 엔티티를 화면의 한 구획에서 유기적으로 결합해야 할 때만 `widgets`로 승격 조립합니다.
- **Public API 준수**: 세부 내부 구현 파일을 직통 import하지 말고, 슬라이스 루트의 `index.ts`를 통해서만 참조하세요.

### 7) 공식 npm 스크립트 실행 준수 (Never Use npx for Defined Scripts)

- 테스트, 타입 검사, 린트, 마이그레이션 등 프로젝트 내부 도구를 실행할 때 임의로 `npx vitest`, `npx tsc`, `npx eslint` 등을 직접 호출하는 것을 엄격히 금지합니다.
- 반드시 `package.json`의 `"scripts"`에 정의된 공식 스크립트(`npm test`, `npm run check`, `npm run verify`, `npm run typecheck` 등)만 사용하세요. 특정 테스트 파일만 실행할 때도 반드시 `npm test -- [파일경로]` 형식을 준수하세요.

### 8) 스펙 주도 개발 (SDD) 및 아카이브 가드레일 준수

- 신규 기능 개발 및 대규모 리팩터링은 반드시 `docs/specs/active/`에 표준 스펙을 정의하고 해당 식별자 브랜치(`feat/spec-...`)에서 진행하세요.
- `docs/specs/archived/` 디렉터리의 문서는 과거 동결된 기록입니다. 새로운 코드 작성 시 이를 현재 시스템의 단일 진실 원천(Source of Truth)으로 참조하는 것을 금지하며, 오직 `/src` 최신 코드와 `docs/specs/active/`만 참조하세요.
- 코드 작성 전에는 반드시 파일 및 테스트 단위의 에이전트 실행 계획(Task Plan)을 먼저 제시하고 사용자 승인을 받으세요.

### 9) YAGNI 및 조기 추상화 금지 (YAGNI & Anti-Overengineering)

- **지금 당장 스펙과 테스트 케이스에 명시되지 않은 미래의 기능, 미사용 제네릭, 막연한 추측성 유틸리티 함수나 설정 옵션을 임의로 미리 작성하지 마세요.**
- "나중에 쓸지도 모른다"는 가정으로 과도한 추상화 레이어나 불필요한 팩토리/플러그인 구조를 도입하는 것을 엄격히 금지합니다.
- 항상 현재 요구사항을 가장 단순하고 명료하게 만족하는 최소한의 코드(KISS 원칙)만 작성하세요.

### 10) GitHub Flow 및 PR 기반 머지/브랜치 삭제 원칙 (GitHub Flow & PR Lifecycle)

- **`master` 브랜치 직접 푸시 절대 금지**: `master`는 상시 배포 가능한 상태를 유지해야 하며, 모든 코드는 단명 작업 브랜치에서 분기 후 **반드시 Pull Request(PR)를 통해서만 머지**합니다.
- **머지 후 브랜치 즉시 삭제**: PR이 `master`로 머지 완료된 즉시 해당 원격 및 로컬 작업 브랜치는 삭제하여 레포지토리를 청정하게 유지합니다.
- **PR 공식 템플릿 준수 (Single Source of Truth)**: PR 서식의 단일 진실 원천은 [`.github/pull_request_template.md`](file://.github/pull_request_template.md)입니다. 에이전트가 PR 본문을 작성할 때는 반드시 해당 템플릿 파일을 직접 읽고 양식과 체크리스트를 누락 없이 100% 준수하여 작성합니다.

### 11) 날짜 및 시간 처리 가드레일 (Date & Time Single Source of Truth)

- **Store in UTC, Display in Local 원칙**: 시스템에 저장/전송되는 모든 시간 데이터는 UTC 표준을 엄수하며, 사용자 화면 렌더링 시점에만 로컬 시간대로 변환합니다.
- **서드파티 라이브러리 직접 import 원천 금지**: `date-fns` 등 외부 라이브러리를 `app`, `features`, `entities` 등에서 직접 import하는 것을 ESLint 규칙으로 전면 금지하며, 반드시 `@/shared/lib/date` 공통 래퍼만 사용합니다.
- **중앙 DB 시계 권한 (Central Clock Authority)**: Drizzle ORM 및 DB 갱신 쿼리에서는 애플리케이션 서버의 `new Date()` 대신 PostgreSQL 중앙 시계인 `sql`now()``를 사용하여 분산 컨테이너 환경의 Clock Drift를 원천 방지합니다.
- **Null-safe 공통 유틸리티 사용**: UI 포맷팅(`formatDate`, `formatDateTime`, `formatRelativeTime`, `formatUtc`) 및 직렬화(`nowUtcIso`, `toUtcIso`)는 `@/shared/lib/date`에 정의된 함수를 통해서만 수행합니다.

### 12) 데이터 정의 파일 거버넌스 (Tables vs Schema vs Types)

- **DB 물리 테이블 DDL**: 반드시 `src/shared/tables/*.table.ts`에만 작성합니다. (Drizzle `pgTable`, 외래키 및 CASCADE 제약조건 중앙화)
- **런타임 검증 Zod 스키마**: 반드시 `src/{entities,features}/*/schema/*.schema.ts`에만 작성합니다. (`z.object`, `createInsertSchema` 및 파생 타입 `z.infer`)
- **순수 TypeScript 정적 타입**: 반드시 `src/{entities,features}/*/types/*.types.ts`에만 작성하며, **Zod 런타임 스키마 선언(`import { z } from 'zod'`)은 엄격히 금지**됩니다.

---

## 3. 세부 거버넌스 규칙 문서 인덱스 (`.agents/rules/`)

구체적인 작업 단계에서는 반드시 아래의 세부 규칙 문서를 읽고 엄격히 준수하세요:

| 분야                         | 규칙 문서 경로                                                                                 | 핵심 가이드 내용                                                       |
| :--------------------------- | :--------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **아키텍처 & 네이밍**        | [.agents/rules/fsd-architecture-rule.md](.agents/rules/fsd-architecture-rule.md)               | FSD 레이어 계층, kebab-case 파일/폴더 네이밍, Public API               |
| **코딩 패러다임**            | [.agents/rules/coding-paradigm-rule.md](.agents/rules/coding-paradigm-rule.md)                 | 함수형 지향, class/this 금지, { data, error } Result 패턴              |
| **테스트 전략 (TDD)**        | [.agents/rules/testing-strategy-rule.md](.agents/rules/testing-strategy-rule.md)               | ROI 중심 로직 TDD, UI 테스트 배제 및 비즈니스 로직 단위 검증 집중      |
| **UI & 스타일링**            | [.agents/rules/ui-and-styling-rule.md](.agents/rules/ui-and-styling-rule.md)                   | shadcn/ui 재사용, Tailwind v4 시맨틱 토큰, 배럴 파일 금지              |
| **스펙 주도 개발 (SDD)**     | [.agents/rules/spec-driven-development-rule.md](.agents/rules/spec-driven-development-rule.md) | 5단계 SDD 라이프사이클, TEMPLATE 기반 스펙, 아카이브 가드레일          |
| **Git 워크플로우 & 커밋/PR** | [.agents/rules/git-commit-automation-rule.md](.agents/rules/git-commit-automation-rule.md)     | GitHub Flow, PR 템플릿 준수, 머지 후 브랜치 삭제, Conventional Commits |
| **날짜 & 시간 처리 (UTC)**   | [.agents/rules/date-and-time-rule.md](.agents/rules/date-and-time-rule.md)                     | Store in UTC, Display in Local, DB `sql`now()``, 공통 유틸리티 래핑    |

---

## 4. 기술 스택 & 런타임 주의사항 (Critical Tech Stack)

- **프레임워크**: Next.js 16.4.4 (App Router, Turbopack)
  - `cookies()`, `headers()`, `params`, `searchParams` 등 비동기 API 접근 시 반드시 `await` 사용
- **코어 라이브러리**: React 19, TypeScript 5 (Strict Options)
- **스타일링**: Tailwind CSS v4, shadcn/ui
- **테스트 러너**: Vitest 3.x, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`
- **도메인 인프라**: Zod, PostgreSQL (`pgvector`, Drizzle ORM), Google Gen AI (`@google/genai`)

---

## 5. 작업 완료 전 필수 검증 파이프라인 (Verification Loop)

에이전트는 코드 작성을 마친 후 사용자에게 보고하기 전에, 반드시 터미널에서 통합 검증 스크립트를 실행하여 **결함 0건**을 확인해야 합니다:

```bash
# [올인원 검증] 타입체크 -> 린트 -> 포맷체크 -> 비즈니스 로직 단위 테스트 전체 자동 완주
npm run verify

# (참고) 서식 어긋남 발생 시 자동 교정
npm run fix

# (참고) 테스트 제외 정적 분석 3종만 빠르게 검사할 때
npm run check
```
