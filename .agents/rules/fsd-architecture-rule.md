# FSD (Feature-Sliced Design) Architecture Rule

당신은 엄격한 프론트엔드 시스템 아키텍트입니다. 코드베이스 내 신규 파일 생성, 디렉터리 구성, 모듈 참조(import)를 작성할 때 아래의 FSD 레이어 원칙과 컨벤션을 반드시 준수하세요.

---

## 1. 계층 구조 (Layer Hierarchy) 및 단방향 의존성 원칙

본 프로젝트는 `eslint-plugin-boundaries`를 통해 단방향 레이어 의존성을 엄격히 통제합니다. **상위 레이어는 오직 하위 레이어만 참조할 수 있으며, 역방향 또는 동일 계층 간 직접 교차 참조는 금지됩니다.**

```
▲ (상위: 비즈니스 결합도 높음)
│  src/app/         # 라우팅, 레이아웃, 전역 Provider, 페이지 진입점
│  src/widgets/     # 독립적으로 완결된 대형 UI 블록 (Page Sections, 복합 패널)
│  src/features/    # 비즈니스 가치를 만드는 사용자 기능 단위 (Form Builder, Runtime Parser 등)
│  src/entities/    # 핵심 비즈니스 도메인 모델, 공통 스키마, 타입 (Form, Field 등)
│  src/shared/      # 도메인 무관 재사용 모듈 (UI Kit, 공통 유틸, 라이브러리 클라이언트)
▼ (하위: 재사용성 높음)
```

### 레이어별 상세 책임

1. **`app` (`src/app/`)**
   - 역할: Next.js App Router 라우팅, 전역 레이아웃, 메타데이터, API Route Handlers.
   - 원칙: **Thin App Router**. 비즈니스 로직이나 복잡한 JSX를 직접 작성하지 않고 하위 레이어(`widgets`, `features`)를 조합하여 페이지를 구성합니다.

2. **`widgets` (`src/widgets/`)**
   - 역할: 특정 화면 영역을 담당하는 대형 복합 컴포넌트 (예: `header`, `form-builder-workspace`, `runtime-inspection-panel`).
   - 참조 허용: `features`, `entities`, `shared`

3. **`features` (`src/features/`)**
   - 역할: 사용자가 특정 인터랙션을 완수하는 기능 단위 (예: `form-builder`, `form-runtime`, `form-engine`).
   - 원칙: 동일 `features` 내 다른 슬라이스를 직접 참조할 수 없습니다(No cross-slice import). 공통 데이터나 타입이 필요하다면 `entities`나 `shared`로 격리/승격합니다.
   - 참조 허용: `entities`, `shared`

4. **`entities` (`src/entities/`)**
   - 역할: 비즈니스 핵심 개체 모델 및 상태 (예: `form`, `submission`).
   - 원칙: 다른 entity나 상위 레이어에 의존하지 않으며, 순수 비즈니스 데이터 구조와 CRUD 성격의 조작 로직만 포함합니다.
   - 참조 허용: `shared`

5. **`shared` (`src/shared/`)**
   - 역할: 비즈니스 도메인 지식이 전혀 없는 범용 컴포넌트 및 유틸리티.
   - 세부 구성: `ui/` (shadcn 컴포넌트), `lib/` (utils, hooks), `api/` (Supabase/Gemini 인스턴스).
   - 원칙: 오직 `shared` 내부 모듈만 상호 참조할 수 있습니다.

---

## 2. 파일 및 디렉터리 명명 규칙 (check-file Rule)

`eslint-plugin-check-file`에 의해 정적 검사됩니다:

- **모든 디렉터리명과 파일명은 반드시 `kebab-case`**를 사용합니다.
  - [Bad] `DynamicRenderer.tsx`, `fieldRegistry.ts`, `FormEngine/`
  - [Good] `dynamic-renderer.tsx`, `field-registry.ts`, `form-engine/`
- 단, 파일 내부의 React 컴포넌트 심볼은 `PascalCase`, 함수/변수는 `camelCase`로 선언합니다.

---

## 3. 슬라이스 내부 세그먼트 표준 (Slice Segments)

`widgets`, `features`, `entities`의 각 슬라이스는 일관된 세그먼트 디렉터리로 분리하며, 동일한 캡슐화 원칙을 적용합니다:

```
# 예시 1: Feature 슬라이스 구조
src/features/form-engine/
├── index.ts                # Public API (외부 공개 진입점)
├── ui/                     # UI 컴포넌트
│   ├── dynamic-renderer.tsx
│   └── field-registry.tsx
├── model/                  # 비즈니스 로직, 훅, Zod 스키마
│   ├── types.ts
│   └── validators.ts
└── api/                    # 슬라이스 전용 API 호출부

# 예시 2: Widget 슬라이스 구조 (features/entities를 조합한 대형 UI 블록)
src/widgets/form-builder-workspace/
├── index.ts                # Public API (외부 공개 진입점)
├── ui/                     # 위젯 컴포넌트 및 하위 뷰
│   └── form-builder-workspace.tsx
├── model/                  # 위젯 단위 로컬 상태 및 훅
└── api/                    # 위젯 전용 BFF 연동 (필요 시)
```

### Public API (`index.ts`) 원칙

- 외부 레이어에서는 반드시 슬라이스의 `index.ts`를 통해서만 모듈을 가져옵니다.
  - [Good] `import { FormBuilderWorkspace } from "@/widgets/form-builder-workspace";`
  - [Good] `import { DynamicRenderer } from "@/features/form-engine";`
  - [Bad] `import { DynamicRenderer } from "@/features/form-engine/ui/dynamic-renderer";` (Deep import 지양)

---

## 4. 경로 별칭 (Path Aliases)

반드시 `tsconfig.json`에 정의된 FSD 레이어 alias를 사용하며, 상대 경로 지옥(`../../../`)을 지양합니다:

- `@/app/*`
- `@/widgets/*`
- `@/features/*`
- `@/entities/*`
- `@/shared/*`

---

## 5. Next.js 16 & Server/Client 경계 가이드

1. **Client Component 최소화**: 인터랙션(`useState`, `useEffect`, 이벤트 핸들러)이 필요한 컴포넌트 리프(Leaf) 단위에만 `'use client'`를 선언합니다.
2. **비밀 키 보호**: AI 호출(`@google/genai`) 및 Supabase Service Role 키는 반드시 서버 환경(`app/api/*` 또는 Server Actions)에서만 격리 실행합니다.
