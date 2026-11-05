# FSD (Feature-Sliced Design) Architecture Rule

당신은 엄격한 프론트엔드 및 풀스택 시스템 아키텍트입니다. 코드베이스 내 신규 파일 생성, 디렉터리 구성, 모듈 참조(import)를 작성할 때 아래의 FSD 레이어 원칙과 컨벤션을 반드시 준수하세요.

---

## 1. 계층 구조 (Layer Hierarchy) 및 단방향 의존성 원칙

본 프로젝트는 `eslint-plugin-boundaries`를 통해 단방향 레이어 의존성을 엄격히 통제합니다. **상위 레이어는 오직 하위 레이어만 참조할 수 있으며, 역방향 또는 동일 계층 간 직접 교차 참조는 금지됩니다.**

```text
▲ (상위: 비즈니스 결합도 높음)
│  src/app/         # 라우팅, 레이아웃, 전역 Provider, 페이지 진입점, 백엔드 Route Handler
│  src/widgets/     # 독립적으로 완결된 대형 UI 블록 (Page Sections, 복합 패널)
│  src/features/    # 비즈니스 가치를 만드는 사용자 기능/인터랙션 단위
│  src/entities/    # 핵심 비즈니스 도메인 모델, Drizzle 스키마, Zod 검증, 서버 트랜잭션 로직
│  src/shared/      # 도메인 무관 재사용 모듈 (UI Kit, DB 인프라, 공통 유틸, HTTP 클라이언트)
▼ (하위: 재사용성 높음)
```

### 레이어별 상세 책임

1. **`app` (`src/app/`)**
   - 역할: Next.js App Router 라우팅, 전역 레이아웃, 메타데이터, API Route Handlers.
   - 원칙: **Thin App Router**. 비즈니스 로직이나 복잡한 JSX를 직접 작성하지 않고 하위 레이어(`widgets`, `features`, `entities`)를 조합하여 페이지 및 엔드포인트를 구성합니다.

2. **`widgets` (`src/widgets/`)**
   - 역할: 특정 화면 영역을 담당하는 대형 복합 컴포넌트 (예: 헤더, 복합 편집 보드 등).
   - 참조 허용: `features`, `entities`, `shared`

3. **`features` (`src/features/`)**
   - 역할: 사용자가 특정 인터랙션을 완수하는 기능 단위.
   - 원칙: 동일 `features` 내 다른 슬라이스를 직접 참조할 수 없습니다(No cross-slice import). 공통 데이터나 타입이 필요하다면 `entities`나 `shared`로 격리/승격합니다.
   - 참조 허용: `entities`, `shared`

4. **`entities` (`src/entities/`)**
   - 역할: 비즈니스 핵심 개체 모델, 영속성 로직 및 상태.
   - 원칙: 다른 entity나 상위 레이어에 의존하지 않으며, 순수 비즈니스 데이터 구조와 CRUD 성격의 조작 로직만 포함합니다.
   - 세부 구성:
     - `schema/`: Drizzle ORM 테이블 정의(`pgTable`) 및 `drizzle-zod` 파생 검증 스키마
     - `server/`: `db.transaction()` 기반의 코드 레벨 트랜잭션 및 DB 쿼리 순수 함수
   - 참조 허용: `shared`

5. **`shared` (`src/shared/`)**
   - 역할: 비즈니스 도메인 지식이 전혀 없는 범용 컴포넌트, 코어 인프라 클라이언트 및 유틸리티.
   - 세부 구성:
     - `ui/`: shadcn/ui 기반 원자 컴포넌트 (Button, Card, Dialog 등)
     - `db/`: [코어 인프라] Drizzle ORM 싱글톤 인스턴스 및 Supabase Transaction Pooler(포트 6543) 연결
     - `lib/`: 순수 범용 유틸리티(`utils.ts`, `httpClient`), Gemini AI SDK 통합
     - `types/`: 전역 공통 유틸리티 타입 (Result 패턴 등)
     - `store/`: 테마, 전역 알림 등 도메인 무관 전역 상태
   - 원칙: 오직 `shared` 내부 모듈만 상호 참조할 수 있습니다.

---

## 2. 파일 및 디렉터리 명명 규칙 (check-file Rule)

`eslint-plugin-check-file`에 의해 정적 검사됩니다:

- **모든 디렉터리명과 파일명은 반드시 `kebab-case`**를 사용합니다.
  - [Bad] `DynamicRenderer.tsx`, `fieldRegistry.ts`, `FormEngine/`
  - [Good] `dynamic-renderer.tsx`, `field-registry.ts`, `form-engine/`
- 단, 파일 내부의 React 컴포넌트 심볼은 `PascalCase`, 함수/변수는 `camelCase`로 선언합니다.

---

## 3. 슬라이스 내부 표준 세그먼트 규칙 (Slice Segments)

모호한 명칭인 `model/`과 `api/`는 도메인 슬라이스 내부에서 사용하지 않습니다. 역할이 명확한 아래 7개 표준 세그먼트만 허용됩니다.

### 7대 표준 세그먼트 및 파일 확장자 접미사(Suffix) 규격

ESLint(`eslint-plugin-check-file`)에 의해 기계적으로 강제되며, 세그먼트별로 고유 접미사(`.xxx.ts`)를 준수해야 합니다:

| 세그먼트  | 실행 환경       | 주 역할                                                           | 필수 파일명 접미사 (Suffix)                  | 예시 파일명                         |
| :-------- | :-------------- | :---------------------------------------------------------------- | :------------------------------------------- | :---------------------------------- |
| `ui`      | Client / Server | 뷰 레이어                                                         | `[name].tsx`                                 | `form-card.tsx`                     |
| `queries` | Client          | 클라이언트 데이터 패칭                                            | `*.query.ts` / `*.mutation.ts` / `*.keys.ts` | `use-form.query.ts`, `form.keys.ts` |
| `server`  | Server 전용     | 백엔드 데이터 영속성 (Drizzle 쿼리 및 `db.transaction` 트랜잭션)  | `*.server.ts`                                | `form-db.server.ts`                 |
| `store`   | Client 전용     | 클라이언트 전역 상태                                              | `*.store.ts`                                 | `form-editor.store.ts`              |
| `schema`  | 공통            | 런타임 데이터 검증 (Drizzle `pgTable` 및 `drizzle-zod` 단일 진실) | `*.schema.ts`                                | `form.schema.ts`                    |
| `types`   | 컴파일 타임     | 정적 타입 정의                                                    | `*.types.ts` / `*.dto.ts` / `index.ts`       | `form.types.ts`, `health.dto.ts`    |
| `lib`     | 공통            | 순수 함수/도구                                                    | `*.util.ts` 또는 `[name].ts`                 | `calculate-score.util.ts`           |

- 단위 테스트 파일은 해당 접미사 뒤에 `.test.ts`를 부착합니다 (예: `form-editor.store.test.ts`, `form.schema.test.ts`).

### 슬라이스 템플릿 및 YAGNI 원칙

모든 슬라이스가 7개 세그먼트를 억지로 갖출 필요는 없습니다. **해당 슬라이스에 실제로 필요한 세그먼트만 선택적으로 생성**합니다.

```text
# 범용 슬라이스 디렉터리 구조 예시
src/[layer]/[slice-name]/
├── index.ts                # Public API (외부 공개 진입점 - 필수)
├── ui/                     # [선택] 화면 컴포넌트
│   └── [slice-name].tsx
├── queries/                # [선택] TanStack Query 훅 (useQuery, useMutation)
├── server/                 # [선택] Drizzle DB 직접 쿼리 및 트랜잭션 함수 (서버 전용)
├── store/                  # [선택] Zustand 상태 스토어
├── schema/                 # [선택] Drizzle 테이블 정의 및 Zod 검증 스키마
├── types/                  # [선택] 내부 공유 TypeScript 인터페이스
└── lib/                    # [선택] 순수 데이터 변환 유틸리티
```

### Public API (`index.ts`) 원칙

- 외부 레이어에서는 반드시 슬라이스 루트의 `index.ts`를 통해서만 모듈을 가져옵니다.
  - [Good] `import { FormCard } from "@/entities/form";`
  - [Bad] `import { FormCard } from "@/entities/form/ui/form-card";` (Deep import 차단)
- 내부 구현용으로만 쓰는 파일이나 서버 전용 코드가 외부로 무분별하게 노출되지 않도록 `index.ts`에서 선별적으로 export합니다.

---

## 4. 데이터 흐름 파이프라인 (Data Flow Pipeline)

Next.js App Router, TanStack Query, Drizzle ORM 환경에서 표준 데이터 흐름은 다음과 같습니다:

```mermaid
flowchart TD
    subgraph Client ["브라우저 환경 (Client Layer)"]
        direction TD
        UI["features/ui 또는 entities/ui (컴포넌트)"]
        Queries["features/queries 또는 entities/queries (useQuery / useMutation)"]
        HTTPClient["shared/lib/http (httpClient)"]

        UI -->|"호출"| Queries
        Queries -->|"API 요청"| HTTPClient
    end

    subgraph Server ["서버 환경 (Next.js Server / BFF)"]
        direction TD
        RouteHandler["src/app/api/[resource-name]/route.ts (withErrorHandler)"]
        EntityServer["entities/[entity-name]/server (db.transaction 트랜잭션 실행)"]
        DBInstance["shared/db (Drizzle ORM 싱글톤)"]
        Database[("Supabase PostgreSQL DB (Transaction Pooler 포트 6543)")]

        RouteHandler -->|"비즈니스 로직 호출"| EntityServer
        EntityServer -->|"쿼리 및 트랜잭션 실행"| DBInstance
        DBInstance -->|"TCP PostgreSQL"| Database
    end

    HTTPClient -->|"HTTP Request: /api/[resource-name]"| RouteHandler
```

---

## 5. Drizzle 멀티 스키마 & 무중단 마이그레이션 규칙

1. **분산 스키마 단일 수집 (Glob Matching)**:
   - 각 도메인의 물리적 테이블 구조는 `src/entities/**/schema/*.schema.ts`에 독립적으로 작성합니다.
   - `drizzle.config.ts`는 Glob 패턴으로 모든 엔티티의 스키마를 자동 탐색하여 중앙 수집합니다.
2. **코드 레벨 트랜잭션 (No Logic Fragmentation)**:
   - DB 트리거나 Stored Procedure로 비즈니스 로직을 파편화하지 않고, `entities/*/server/` 파일 안에서 `db.transaction(async (tx) => ...)` 블록으로 원자성을 투명하게 통제합니다.
3. **무중단 마이그레이션 파이프라인 (Expand & Contract)**:
   - DDL SQL 마이그레이션 파일은 `npm run db:generate`를 통해 `drizzle/` 디렉터리에 버전 관리 파일(`.sql`)로 영구 보관합니다.
   - Vercel 배포 시 `npm run db:migrate && next build`를 통해 서버 중단 없이 원격 DB에 안전하게 선(先) 반영됩니다.

---

## 6. 경로 별칭 (Path Aliases)

반드시 `tsconfig.json`에 정의된 FSD 레이어 alias를 사용하며, 상대 경로 지옥(`../../../`)을 지양합니다:

- `@/app/*`
- `@/widgets/*`
- `@/features/*`
- `@/entities/*`
- `@/shared/*`

---

## 7. Next.js 16 & Server/Client 경계 가이드

1. **Client Component 최소화**: 인터랙션(`useState`, `useEffect`, 이벤트 핸들러)이 필요한 컴포넌트 리프(Leaf) 단위에만 `'use client'`를 선언합니다.
2. **비밀 키 보호**: AI 호출(`@google/genai`) 및 데이터베이스 접속 주소(`DATABASE_URL`)는 반드시 서버 환경(`app/api/*`, `shared/db/`, 또는 `server/` 세그먼트)에서만 격리 실행합니다.
3. **서버 코드 브라우저 누출 차단**: 서버 전용 파일(`src/shared/db/connection.ts` 및 `server/` 세그먼트의 모든 파일) 상단에는 반드시 `import "server-only";`를 선언하여 브라우저 번들에 실수로 포함될 경우 빌드 타임에 컴파일 에러로 차단합니다.
