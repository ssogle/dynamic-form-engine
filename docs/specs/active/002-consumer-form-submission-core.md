# [Spec-002] Consumer Form Workspace, Submission CRUD & AI Navigator

> [!NOTE]
>
> - **상태 (Status)**: Active (구현 진행 중)
> - **브랜치 (Branch)**: `feat/spec-002-consumer-form-submission-core`
> - **작성일 (Created)**: 2026-11-08
> - **완료일 (Archived)**: -

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

기존 시스템은 자연어 대화를 통해 폼 스키마를 정의하고 프리뷰하는 빌더 환경(`Spec-001`)에 집중되어 있었습니다. 이제 공식 발행(Published)된 폼을 엔드유저(컨슈머)가 조회하고, 입력값을 검증 및 제출하여 영속화하며, 기제출된 응답 데이터를 열람, 수정, 삭제할 수 있는 종합 컨슈머 포털 환경이 필요합니다.

컨슈머 포털 역시 빌더와 동일한 **"AI Navigator 중심의 인터랙션 패러다임"**과 대칭형 레이아웃 구조를 계승합니다:

1. **상시 상주형 Consumer AI Navigator (좌측 384px)**: 엔드유저와 대화하며 적절한 폼으로 화면을 자동 이동시키고, 자연어로 질문에 답변하면 입력 필드를 대신 채워주며, 제출까지 대행하는 자율주행 도우미 역할을 수행합니다.
2. **빌더 대칭형 2-컬럼 쉘 & 상단 탭 헤더**: 빌더의 라우팅 UX와 대칭을 이루도록 `/consumer` 접속 시 `/consumer/forms`로 즉시 리다이렉트하며, 상단 헤더에 "폼 목록"(`forms`)과 "뷰 목록"(`views`) 탭을 배치하여 사용자가 일관된 멘탈 모델로 서비스를 탐색할 수 있도록 합니다.
3. **독립적 제출 데이터(Submission) 전체 CRUD 및 런타임 무결성 보장**: 발행된 폼 메타데이터를 기반으로 런타임에 동적으로 유효성을 검증하며, 생성(POST), 조회(GET), 수정(PATCH), 소프트 삭제(DELETE)를 완벽하게 지원합니다. (권한 시스템은 배제하여 전체 수정/삭제 허용)
4. **일괄 제출 방식 (Form Batch Submission)**: 단발성 참여가 주를 이루는 컨슈머 UX 특성에 맞춰, 브라우저 상태에서 입력을 유지하다가 최종 제출 시점에 서버로 전송하여 DB 쓰레기 데이터(Ghost Record)를 원천 차단합니다.

---

## 2. 목표 및 비목표 (Goals & Non-Goals)

### Goals

1. **제출 데이터(Submission) 엔티티 및 전체 CRUD 영속화**:
   - `form_submissions` 테이블 신설 및 Drizzle ORM 엔티티(`entities/form-submission`) 구축.
   - 생성(POST), 목록 및 단건 조회(GET), 수정(PATCH), 소프트 삭제(DELETE) 서버 함수 구현.
2. **동적 런타임 유효성 검증기 (Dynamic Runtime Validator)**:
   - 4종 필드(`text`, `textarea`, `number`, `select`)의 데이터 타입 일치 검증.
   - 필수 입력(`required: true`) 필드의 누락 방지.
   - `select` 필드의 정의된 선택지(`options`) 포함 여부 검증.
   - 신규 제출(POST) 및 기존 데이터 수정(PATCH) 모두에 동일한 유효성 검증 파이프라인 적용.
3. **발행 상태(Published State) 엄격 가드레일**:
   - 미발행 폼(`publishedAt IS NULL`) 및 소프트 삭제된 폼에 대한 컨슈머 접근 및 제출 차단 (`404` / `403`).
4. **컨슈머 라우터 & 레이아웃 구축**:
   - `/consumer` -> `/consumer/forms` 리다이렉트.
   - `src/app/consumer/layout.tsx`: 좌측 Consumer AI Navigator 패널(384px) + 우측 상단 탭(폼 목록 / 뷰 목록) 헤더.
   - `src/app/consumer/forms/page.tsx`: 참여 가능한 발행된 폼 카드 그리드 (입력하기 / 응답 내역 보기 바로가기).
   - `src/app/consumer/forms/[slug]/page.tsx`: 폼 입력 및 실시간 저장/제출 화면.
   - `src/app/consumer/forms/[slug]/submissions/page.tsx`: 해당 폼의 제출된 데이터 목록 테이블 및 수정 다이얼로그 / 삭제 UI.
   - `src/app/consumer/views/page.tsx`: 컨슈머 뷰 목록 화면 (빌더 뷰와 대칭 플레이스홀더).
5. **컨슈머 AI 네비게이터 파이프라인 구축**:
   - 컨슈머 전용 시스템 프롬프트 및 도구 카탈로그:
     - `navigateConsumer`: 발행된 폼 목록, 특정 폼 입력 화면, 응답 목록 화면 자율 라우팅.
     - `fillConsumerField`: 대화 맥락을 기반으로 현재 폼의 특정 필드 값 자동 주입.
     - `submitConsumerForm`: 현재 입력된 폼 데이터 검증 및 원클릭 자율 제출.
6. **표준 RESTful API 통합 및 대칭 FSD 네이밍**:
   - 피처: `execute-navigator-builder-action` ↔ `execute-navigator-consumer-action`
   - 위젯: `navigator-builder-shell` ↔ `navigator-consumer-shell`
   - API: `/api/v1/forms/[id]/submissions` 및 `/api/v1/navigator` 단일 엔드포인트 통합
7. **TDD 기반 단위 및 통합 테스트 100% 완주 (`npm run verify`)**.

### Non-Goals

- **인증 및 인가 (Authentication & RBAC)**: 사용자 요구사항에 따라 권한 체크를 배제하고 누구나 수정/삭제 가능하도록 공개 처리.
- **고급 BI 차트 및 데이터 시각화**: 응답 데이터는 순수 테이블/카드 뷰로 제공하며, 차트/통계 뷰어는 차기 스펙으로 분리.
- **고급 필드군 (파일 첨부, 슬라이더, 레이팅 등)**: 1단계 코어 4종 필드(`text`, `textarea`, `number`, `select`)에 집중.

---

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

### 1) FSD 아키텍처 계층 배치

```text
src/
├── shared/
│   └── db/
│       └── tables/                            # [중앙화] 물리 DB 테이블 DDL 정의 (외래키 및 CASCADE 무결성)
│           ├── forms.table.ts
│           └── form-submissions.table.ts
├── entities/
│   ├── form/                                  # [수정] findPublishedForms, findPublishedFormBySlug 추가
│   │   ├── schema/
│   │   │   ├── form.schema.ts                 # 폼 클라이언트 검증 Zod 스키마
│   │   │   └── form-field.schema.ts           # 4종 코어 필드 및 활성 폼 규격 Zod 스키마
│   │   └── server/
│   │       └── form.server.ts
│   └── form-submission/                       # [신규] 제출 데이터 도메인 엔티티
│       ├── schema/
│       │   └── form-submission.schema.ts      # 폼 응답 검증 Zod 스키마 및 파생 타입
│       ├── server/
│       │   └── form-submission.server.ts      # CRUD 쿼리 함수 (insert, find, update, delete)
│       ├── queries/
│       │   ├── form-submissions.keys.ts       # TanStack Query 캐시 키 팩토리
│       │   ├── use-form-submissions.query.ts  # 폼 응답 목록 조회 훅
│       │   └── use-form-submissions.mutation.ts # 폼 응답 제출/수정/삭제 뮤테이션 훅
│       ├── index.ts
│       └── server.ts
├── features/
│   ├── execute-navigator-builder-action/      # [기존] 빌더 AI 액션 실행 피처
│   │   ├── schema/
│   │   │   └── action.schema.ts               # 액션 Zod 스키마
│   │   └── types/
│   │       └── action.types.ts                # 순수 TypeScript 인터페이스
│   ├── execute-navigator-consumer-action/     # [신규] 컨슈머 AI 액션 실행 피처
│   │   ├── schema/
│   │   │   └── consumer-action.schema.ts      # 컨슈머 액션 Zod 스키마
│   │   ├── types/
│   │   │   └── consumer-action.types.ts       # 순수 TypeScript 인터페이스
│   │   ├── queries/
│   │   │   └── use-consumer-navigator.mutation.ts
│   │   ├── lib/
│   │   │   ├── consumer-navigator-tools.ts
│   │   │   └── consumer-action-parser.ts
│   │   ├── server/
│   │   │   └── execute-consumer-action.server.ts
│   │   ├── index.ts
│   │   └── server.ts
│   ├── submit-form-response/                  # [신규] 폼 런타임 유효성 검증 및 입력 화면
│   │   ├── lib/
│   │   │   └── dynamic-submission-validator.ts
│   │   ├── ui/
│   │   │   └── consumer-form-renderer.tsx
│   │   └── index.ts
│   └── manage-form-submissions/               # [신규] 제출 데이터 목록 및 수정/삭제 인터랙션
│       ├── ui/
│       │   ├── submission-list-table.tsx
│       │   └── edit-submission-dialog.tsx
│       └── index.ts
├── widgets/
│   ├── navigator-builder-shell/               # [기존] 빌더 좌측 네비게이터 대화 패널
│   └── navigator-consumer-shell/              # [신규] 컨슈머 좌측 네비게이터 대화 패널
│       ├── ui/
│       │   └── navigator-consumer-shell.tsx
│       ├── store/
│       │   └── navigator-consumer-chat.store.ts
│       └── index.ts
└── app/
    ├── consumer/
    │   ├── layout.tsx                         # 좌측 네비게이터 + 상단 탭 헤더
    │   ├── page.tsx                           # redirect("/consumer/forms")
    │   ├── forms/
    │   │   ├── page.tsx                       # 발행된 폼 목록 그리드
    │   │   └── [slug]/
    │   │       ├── page.tsx                   # 폼 입력 화면
    │   │       └── submissions/
    │   │           └── page.tsx               # 응답 목록 및 수정/삭제
    │   └── views/
    │       └── page.tsx                       # 뷰 목록 화면
    └── api/v1/
        ├── forms/
        │   ├── route.ts                       # GET(?published=true) / POST(폼 생성)
        │   └── [id]/
        │       ├── route.ts                   # GET / PATCH / DELETE
        │       └── submissions/
        │           ├── route.ts               # GET(목록) / POST(제출)
        │           └── [submissionId]/
        │               └── route.ts           # GET(단건) / PATCH(수정) / DELETE(삭제)
        └── navigator/
            └── route.ts                       # POST (mode: "builder" | "consumer" 분기 처리)
```

### 2) 데이터베이스 DDL 명세 (`src/shared/db/tables/form-submissions.table.ts`)

```typescript
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // 최초 제출 일시 (UTC)
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // 사후 수정 일시 (UTC)
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // 소프트 삭제 일시 (UTC)
  },
  (table) => [
    index("idx_form_submissions_form_id").on(table.formId),
    index("idx_form_submissions_active")
      .on(table.formId, table.createdAt)
      .where(sql`deleted_at IS NULL`),
  ]
);
```

### 3) 런타임 유효성 검증 함수 시그니처

```typescript
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  cleanedData: Record<string, unknown>;
}

export function validateSubmissionData(
  fields: CoreFormField[],
  rawData: Record<string, unknown>
): ValidationResult;
```

---

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: API 엔드포인트를 `/api/v1/consumer/...` 네임스페이스로 완전 분리**
  - 기각 사유: 폼 응답 데이터(`submissions`)는 컨슈머가 제출하지만 차후 빌더(관리자)에서도 동일하게 열람하고 분석해야 하므로, RESTful 리소스 계층 구조(`/api/v1/forms/[id]/submissions`)로 통일하는 것이 DRY 원칙과 자원 지향 설계에 부합합니다.
- **대안 B: 위젯 하나로 빌더/컨슈머 통합 (`<NavigatorShell mode="builder" | "consumer" />`)**
  - 기각 사유: 외형은 유사하나 호출 피처, 액션 디스패치, 상태 스토어, 프롬프트 힌트가 완전히 다릅니다. 단일 컴포넌트에 두 도메인의 분기를 넣으면 결합도가 증가하므로 `navigator-builder-shell`과 `navigator-consumer-shell`로 명확히 분리합니다.
- **대안 C: 폼 진입 시 빈 응답 레코드를 선(先) 생성하는 방식**
  - 기각 사유: 컨슈머(응답자)는 단발성 참여가 지배적이므로 단순 이탈 시 DB에 쓰레기 데이터(Ghost Record)가 쌓입니다. 따라서 브라우저 상태에서 입력을 유지하다가 [제출하기] 시점에 1회 일괄 전송하는 방식을 채택합니다.

---

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **필드 식별자 정합성**: `CoreFormField`의 `id`와 `name` 중 어떤 것을 키값으로 저장할 것인가?
  - 결정: 폼 빌더 생성 시의 일관성을 위해 `name`(바인딩 키)을 기본 데이터 키로 사용하되, `id` 기반 매핑도 호환 지원하도록 밸리데이터를 작성합니다.
- **AI 네비게이터와 클라이언트 폼 입력 상태 간 실시간 동기화**:
  - 해결: Zustand 스토어(`consumer-form-draft.store.ts`)를 도입하여 좌측 네비게이터의 도구 실행 결과(`fillConsumerField`)가 우측 입력 화면 컴포넌트의 폼 상태에 즉각 양방향 반영되도록 설계합니다.

---

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

### 단계별 구현 계획

1. **Phase 1: DB 스키마 & Drizzle 엔티티 (`entities/form-submission`)**
   - 테이블 정의, 마이그레이션 생성, CRUD 서버 함수 및 단위 테스트
2. **Phase 2: 런타임 유효성 검증 모듈 (`features/submit-form-response/lib`)**
   - 4종 필드 타입/필수값/선택지 검증 로직 및 TDD 단위 테스트
3. **Phase 3: 표준 RESTful API 엔드포인트 (`app/api/v1/...`)**
   - 발행된 폼 조회 필터(`?published=true`), 응답 제출/목록/수정/삭제 REST API 구현 및 통합 테스트
4. **Phase 4: 컨슈머 라우터 & 레이아웃 구축 (`app/consumer/...`)**
   - 리다이렉트, 상단 탭 헤더(폼 목록 / 뷰 목록), 발행 폼 목록 페이지, 뷰 목록 페이지
5. **Phase 5: 폼 입력/제출 화면 및 응답 관리 화면**
   - 동적 폼 입력 렌더러, 제출 처리, 응답 데이터 테이블, 수정 다이얼로그, 삭제 액션
6. **Phase 6: 컨슈머 AI 네비게이터 연동 (`features/execute-navigator-consumer-action`)**
   - 컨슈머 전용 도구 정의, Zustand 스토어 연동, 네비게이터 쉘 조립
7. **Phase 7: 전체 검증 완주 (`npm run verify`)**
