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

### 5) UI 컴포넌트 재사용 원칙

- 새로운 태그나 임의의 UI를 바로 작성하지 말고, 반드시 `@/shared/ui` 디렉터리에 이미 존재하는 컴포넌트(shadcn/ui 기반)를 최우선으로 재사용하세요.
- 필요한 컴포넌트(예: Slider, Popover 등)가 없다면 임의로 만들지 말고, 사용자에게 `npx shadcn@latest add [컴포넌트명]` 실행을 먼저 제안하세요.

### 6) FSD 단방향 의존성 및 Public API 준수

- 상위 레이어는 하위 레이어만 참조하며, 동일 레이어 간 교차 참조는 금지됩니다.
- `widgets`, `features`, `entities`의 세부 내부 구현 파일을 직통 import하지 말고, 슬라이스 루트의 `index.ts`를 통해서만 참조하세요.

---

## 3. 세부 거버넌스 규칙 문서 인덱스 (`.agents/rules/`)

구체적인 작업 단계에서는 반드시 아래의 세부 규칙 문서를 읽고 엄격히 준수하세요:

| 분야                  | 규칙 문서 경로                                                                             | 핵심 가이드 내용                                           |
| :-------------------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **아키텍처 & 네이밍** | [.agents/rules/fsd-architecture-rule.md](.agents/rules/fsd-architecture-rule.md)           | FSD 레이어 계층, kebab-case 파일/폴더 네이밍, Public API   |
| **코딩 패러다임**     | [.agents/rules/coding-paradigm-rule.md](.agents/rules/coding-paradigm-rule.md)             | 함수형 지향, class/this 금지, { data, error } Result 패턴  |
| **테스트 전략 (TDD)** | [.agents/rules/testing-strategy-rule.md](.agents/rules/testing-strategy-rule.md)           | ROI 중심 테스트, 테스트 대상(도메인/인터랙션) vs 제외 대상 |
| **UI & 스타일링**     | [.agents/rules/ui-and-styling-rule.md](.agents/rules/ui-and-styling-rule.md)               | shadcn/ui 재사용, Tailwind v4 시맨틱 토큰, 배럴 파일 금지  |
| **커밋 컨벤션**       | [.agents/rules/git-commit-automation-rule.md](.agents/rules/git-commit-automation-rule.md) | Conventional Commits 규격 (feat, fix, refactor 등)         |

---

## 4. 기술 스택 & 런타임 주의사항 (Critical Tech Stack)

- **프레임워크**: Next.js 16.4.4 (App Router, Turbopack)
  - `cookies()`, `headers()`, `params`, `searchParams` 등 비동기 API 접근 시 반드시 `await` 사용
- **코어 라이브러리**: React 19, TypeScript 5 (Strict Options)
- **스타일링**: Tailwind CSS v4, shadcn/ui
- **테스트 러너**: Vitest 3.x, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`
- **도메인 인프라**: Zod, Supabase (`@supabase/supabase-js`, `pgvector`), Google Gen AI (`@google/genai`)

---

## 5. 작업 완료 전 필수 검증 파이프라인 (Verification Loop)

에이전트는 코드 작성을 마친 후 사용자에게 보고하기 전에, 반드시 터미널에서 아래 4대 검증을 순차 실행하여 **결함 0건**을 확인해야 합니다:

```bash
# 1. 단위 및 컴포넌트 테스트 검증
npm test

# 2. TypeScript 정적 타입 검증
npm run typecheck

# 3. FSD 경계 및 네이밍 린트 검증
npm run lint

# 4. Prettier 포맷팅 검증
npm run format:check
```
