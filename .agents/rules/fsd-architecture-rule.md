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
     - `schema/`: 클라이언트 요청 검증용 Zod 스키마(`createInsertSchema`, `z.object`) 및 `z.infer` 파생 도메인 모델 (물리 DB 테이블 DDL은 `shared/db/tables` 참조)
     - `server/`: `db.transaction()` 기반의 코드 레벨 트랜잭션 및 DB 쿼리 순수 함수
   - 참조 허용: `shared`

5. **`shared` (`src/shared/`)**
   - 역할: 비즈니스 도메인 지식이 전혀 없는 범용 컴포넌트, 코어 인프라 클라이언트 및 유틸리티.
   - 세부 구성:
     - `ui/`: shadcn/ui 기반 원자 컴포넌트 (Button, Card, Dialog 등)
     - `db/`: [코어 인프라] Drizzle ORM 싱글톤 인스턴스, PostgreSQL DB 연결, 및 물리 테이블 DDL (`tables/*.table.ts`)
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

## 3. 스키마, 타입, 테이블 분리 거버넌스 (Schema vs Types vs Tables)

에이전트와 개발자 간의 모호성을 원천 차단하기 위해 데이터 정의 파일은 다음 단일 기준을 엄격히 준수합니다:

1. **`src/shared/db/tables/*.table.ts` (DB 테이블 정의)**:
   - Drizzle ORM의 `pgTable` 정의 전용입니다.
   - RDBMS 외래키, 인덱스, CASCADE 무결성을 보장하기 위해 모든 물리 테이블 DDL은 이곳에 집중 배치합니다.
2. **`src/{entities,features}/*/schema/*.schema.ts` (Zod 검증 스키마)**:
   - 런타임에 실행되는 Zod 유효성 검증기(`z.object`, `createInsertSchema` 등) 및 정규식, 도구 파라미터 스키마 전용입니다.
   - 스키마로부터 파생되는 TypeScript 정적 타입(`z.infer`)은 해당 스키마 파일 하단에서 함께 export합니다.
3. **`src/{entities,features}/*/types/*.types.ts` (순수 TypeScript 타입)**:
   - 컴파일 타임에만 존재하는 순수 TypeScript `type` 및 `interface` 전용입니다.
   - **가드레일**: `types/` 폴더 내부 파일에서는 `import { z } from "zod"`를 통한 런타임 검증기 선언이 엄격히 금지됩니다.

---

## 4. 슬라이스 내부 표준 세그먼트 규칙 (Slice Segments)

모호한 명칭인 `model/`과 `api/`는 도메인 슬라이스 내부에서 사용하지 않습니다. 역할이 명확한 아래 7개 표준 세그먼트만 허용됩니다.

### 7대 표준 세그먼트 및 파일 확장자 접미사(Suffix) 규격

ESLint(`eslint-plugin-check-file`)에 의해 기계적으로 강제되며, 세그먼트별로 고유 접미사(`.xxx.ts`)를 준수해야 합니다:

| 세그먼트  | 실행 환경       | 주 역할                                                             | 필수 파일명 접미사 (Suffix)                  | 예시 파일명                         |
| :-------- | :-------------- | :------------------------------------------------------------------ | :------------------------------------------- | :---------------------------------- |
| `ui`      | Client / Server | 뷰 레이어                                                           | `[name].tsx`                                 | `form-card.tsx`                     |
| `queries` | Client          | 클라이언트 데이터 패칭                                              | `*.query.ts` / `*.mutation.ts` / `*.keys.ts` | `use-form.query.ts`, `form.keys.ts` |
| `server`  | Server 전용     | 백엔드 데이터 영속성 (Drizzle 쿼리 및 `db.transaction` 트랜잭션)    | `*.server.ts`                                | `form-db.server.ts`                 |
| `store`   | Client 전용     | 클라이언트 전역 상태                                                | `*.store.ts`                                 | `form-editor.store.ts`              |
| `schema`  | 공통            | 런타임 데이터 검증 (Zod `z.object` 및 `drizzle-zod` 파생 스키마)    | `*.schema.ts`                                | `form.schema.ts`                    |
| `types`   | 컴파일 타임     | 순수 정적 타입 정의 (**Zod import 금지**, 순수 type/interface)      | `*.types.ts` / `*.dto.ts` / `index.ts`       | `action.types.ts`, `health.dto.ts`  |
| `lib`     | 공통            | 순수 함수/도구                                                      | `*.util.ts` 또는 `[name].ts`                 | `calculate-score.util.ts`           |
| `tables`  | 공통 (shared)   | 물리 DB 테이블 DDL (`pgTable`, `src/shared/db/tables/` 인프라 전용) | `*.table.ts`                                 | `forms.table.ts`                    |

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

### Public API (`index.ts` & `server.ts`) 원칙

- 외부 레이어에서는 반드시 슬라이스 루트의 공인된 진입점을 통해서만 모듈을 가져옵니다. 내부 구현 파일의 직통 참조는 금지됩니다.
  - [Good] `import { useFormsQuery } from "@/entities/form";`
  - [Bad] `import { FormCard } from "@/entities/form/ui/form-card";` (Deep import 차단)
- **Next.js App Router Server/Client 경계 분리 (`server-only` 가드레일)**:
  - 브라우저 클라이언트 컴포넌트(`"use client"`)에 DB 연결 라이브러리(`postgres`, `drizzle-orm`)나 `server-only` 모듈이 유출되는 것을 원천 차단하기 위해 슬라이스 루트 진입점을 2개로 분리합니다:
    - **`index.ts` (클라이언트 및 범용 진입점)**: 브라우저가 안전하게 참조할 수 있는 Zod 스키마, 정적 타입, TanStack Query 훅만 export합니다.
    - **`server.ts` (서버 전용 진입점)**: `server-only`가 선언된 Drizzle DB 직접 쿼리, 트랜잭션 함수를 export합니다.
    - 서버 환경인 `app` 레이어(Route Handlers, Server Actions)는 `@/entities/[slice]/server`를 통해 서버 로직을 안전하게 참조합니다.

---

## 5. 데이터 흐름 파이프라인 (Data Flow Pipeline)

Next.js App Router, TanStack Query, Drizzle ORM 환경에서 표준 데이터 흐름은 다음과 같습니다:

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자 (User)
    participant UI as Feature UI (features/*/ui)
    participant Query as TanStack Query (features/*/queries)
    participant HTTP as httpClient (shared/lib/http)
    participant Router as Route Handler (app/api/*)
    participant Server as Entity Server (entities/*/server)
    participant Drizzle as Drizzle ORM (shared/db)
    participant DB as PostgreSQL DB

    User->>UI: 사용자 인터랙션 (조회 / 폼 제출)
    UI->>Query: useQuery / useMutation 트리거
    Query->>HTTP: httpClient 요청 전송
    HTTP->>Router: HTTP Request (GET/POST /api/v1/*)

    rect rgb(240, 248, 255)
        Note over Router: 1. withErrorHandler 전역 예외 가드<br/>2. Zod 스키마 런타임 검증 (insertFormSchema)
        Router->>Server: 순수 영속성 함수 호출 (findActiveForms / insertForm)
        Server->>Drizzle: db.select() / db.insert() 실행
        Drizzle->>DB: TCP SQL 쿼리 전송 (포트 6543/5432)
        DB-->>Drizzle: 영속 레코드 반환
        Drizzle-->>Server: Form 레코드 반환 (typeof forms.$inferSelect)
        Server-->>Router: 데이터 반환
        Router-->>HTTP: 200 OK / 201 Created (apiResponse)
    end

    HTTP-->>Query: JSON 응답 파싱 완료
    Query-->>UI: 상태 머신 갱신 (data, isLoading, isError)
    UI-->>User: 화면 렌더링 갱신
```

---

## 6. Drizzle 테이블 DDL 및 무중단 마이그레이션 규칙

1. **중앙 집중식 물리 테이블 DDL (`src/shared/db/tables/*.table.ts`)**:
   - RDBMS 외래키 참조 및 물리 삭제 시의 CASCADE 제약조건을 온전히 보장하기 위해 물리적 테이블 구조는 `src/shared/db/tables/*.table.ts`에 독립적으로 작성합니다.
   - `drizzle.config.ts`는 `./src/shared/db/tables/*.table.ts` Glob 패턴으로 모든 테이블 정의를 자동 탐색하여 중앙 수집합니다.
2. **코드 레벨 트랜잭션 (No Logic Fragmentation)**:
   - DB 트리거나 Stored Procedure로 비즈니스 로직을 파편화하지 않고, `entities/*/server/` 파일 안에서 `db.transaction(async (tx) => ...)` 블록으로 원자성을 투명하게 통제합니다.
3. **무중단 마이그레이션 파이프라인 (Expand & Contract)**:
   - DDL SQL 마이그레이션 파일은 `npm run db:generate`를 통해 `drizzle/` 디렉터리에 버전 관리 파일(`.sql`)로 영구 보관합니다.
   - Vercel 배포 시 `npm run db:migrate && next build`를 통해 서버 중단 없이 원격 DB에 안전하게 선(先) 반영됩니다.

---

## 7. 경로 별칭 (Path Aliases)

반드시 `tsconfig.json`에 정의된 FSD 레이어 alias를 사용하며, 상대 경로 지옥(`../../../`)을 지양합니다:

- `@/app/*`
- `@/widgets/*`
- `@/features/*`
- `@/entities/*`
- `@/shared/*`

---

## 8. Next.js 16 & Server/Client 경계 가이드

1. **Client Component 최소화**: 인터랙션(`useState`, `useEffect`, 이벤트 핸들러)이 필요한 컴포넌트 리프(Leaf) 단위에만 `'use client'`를 선언합니다.
2. **비밀 키 보호**: AI 호출(`@google/genai`) 및 데이터베이스 접속 주소(`DATABASE_URL`)는 반드시 서버 환경(`app/api/*`, `shared/db/`, 또는 `server/` 세그먼트)에서만 격리 실행합니다.
3. **서버 코드 브라우저 누출 차단**: 서버 전용 파일(`src/shared/db/connection.ts` 및 `server/` 세그먼트의 모든 파일) 상단에는 반드시 `import "server-only";`를 선언하여 브라우저 번들에 실수로 포함될 경우 빌드 타임에 컴파일 에러로 차단합니다.
