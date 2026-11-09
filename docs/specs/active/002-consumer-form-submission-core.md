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
   - 피처: `features/execute-navigator-action` (단일 통합 에이전트 엔진)
   - 위젯: `widgets/navigator-shell` (단일 통합 대화형 상주 패널)
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
│   ├── form/                                  # [수정] findPublishedForms, extractActiveFields, 동적 스키마 빌더 추가
│   │   ├── schema/
│   │   │   ├── form.schema.ts                 # 폼 클라이언트 검증 Zod 스키마
│   │   │   ├── form-field.schema.ts           # 4종 코어 필드 및 활성 폼 규격 Zod 스키마
│   │   │   ├── dynamic-form.schema.ts         # [승격] 동적 Zod 스키마 조립 및 런타임 검증 엔진
│   │   │   └── dynamic-form.schema.test.ts
│   │   ├── lib/
│   │   │   └── extract-active-fields.ts       # ActiveForm 및 Form 공통 활성 필드 추출 헬퍼
│   │   ├── types/
│   │   │   └── dynamic-form.types.ts          # SubmissionValidationResult 타입
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
│   ├── execute-navigator-action/              # [통합] 빌더/컨슈머 단일 AI 네비게이터 액션 엔진
│   │   ├── types/
│   │   ├── schema/
│   │   ├── lib/
│   │   │   ├── tools/                         # 빌더 6종 및 컨슈머 3종 Vercel AI SDK 도구
│   │   │   └── prompts/                       # 지능형 프롬프트 및 맥락 빌더
│   │   ├── server/                            # 단일 오케스트레이션 엔진 (generateText + toolCalls 순회 통일)
│   │   ├── queries/                           # useNavigatorMutation 단일 훅
│   │   ├── index.ts
│   │   └── server.ts
│   ├── manage-builder-forms/                  # [신규] 빌더 폼 목록 열람 및 소프트 삭제 기능
│   │   ├── ui/
│   │   │   ├── builder-form-list.tsx
│   │   │   └── builder-form-list.test.tsx
│   │   └── index.ts
│   ├── manage-form-submissions/               # [강화] 제출 응답 목록 열람, 테이블 시각화, 삭제 기능
│   │   ├── ui/
│   │   │   ├── manage-form-submissions.tsx
│   │   │   ├── submission-list-table.tsx
│   │   │   └── manage-form-submissions.test.tsx
│   │   └── index.ts
│   └── render-dynamic-form/                   # [강화] 동적 폼 렌더러 + 폼 작성/제출기 + 기제출 응답 수정기
│       ├── types/
│       │   └── render-dynamic-form.types.ts   # 모드(preview | submission), Props 타입
│       ├── ui/
│       │   ├── dynamic-form-renderer.tsx      # React Hook Form 연동 메인 폼 뷰어 (mode: preview | submission)
│       │   ├── dynamic-field.tsx              # 필드별 shadcn 인풋 매퍼
│       │   ├── form-field-wrapper.tsx         # 라벨, 필수 표시, 에러 메시지 공통 래퍼
│       │   ├── consumer-form-submitter.tsx    # 폼 입력 및 실시간 일괄 제출 기능
│       │   └── consumer-submission-editor.tsx # 기제출 응답 수정 전용 워크스페이스 기능
│       └── index.ts
├── widgets/
│   └── navigator-shell/                       # [유일 위젯] 빌더/컨슈머 공통 단일 네비게이터 상주 패널 (384px)
└── app/                                       # [Thin App Router] 완성된 피처들을 직접 조립하는 15~25줄 내외의 페이지
    ├── builder/
    │   └── forms/
    │       ├── page.tsx                       # <BuilderFormList /> 조립
    │       └── [slug]/
    │           └── page.tsx                   # <DynamicFormRenderer mode="preview" /> 조립
    └── consumer/
        ├── layout.tsx                         # 좌측 네비게이터 + 상단 탭 헤더
        ├── page.tsx                           # redirect("/consumer/forms")
        ├── forms/
        │   ├── page.tsx                       # 발행된 폼 목록 그리드
        │   └── [slug]/
        │       ├── page.tsx                   # <ConsumerFormSubmitter /> 조립
        │       └── submissions/
        │           ├── page.tsx               # <ManageFormSubmissions /> 조립
        │           └── [submissionId]/
        │               └── edit/
        │                   └── page.tsx       # <ConsumerSubmissionEditor /> 조립
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

### 3) 런타임 동적 Zod 스키마 조립 및 검증 명세 (`entities/form/schema`)

클라이언트의 실시간 React Hook Form 검증과 서버 API의 무결성 검증이 단일 진실 원천(DRY)을 공유하도록 `buildDynamicFormSchema`를 단일 엔진으로 구축합니다:

```typescript
export interface SubmissionValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  cleanedData?: Record<string, unknown> | undefined;
}

/**
 * 폼 필드 메타데이터 배열을 바탕으로 React Hook Form zodResolver 및 safeParse에서 재사용 가능한 ZodObject를 동적 조립
 */
export function buildDynamicFormSchema(
  fields: CoreFormField[]
): z.ZodObject<Record<string, z.ZodType>>;

/**
 * 원시 제출 데이터를 정규화(id -> name)하고 동적 스키마로 검증 및 정제 수행
 */
export function validateSubmissionData(
  fields: CoreFormField[],
  rawData: Record<string, unknown>
): SubmissionValidationResult;
```

---

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: API 엔드포인트를 `/api/v1/consumer/...` 네임스페이스로 완전 분리**
  - 기각 사유: 폼 응답 데이터(`submissions`)는 컨슈머가 제출하지만 차후 빌더(관리자)에서도 동일하게 열람하고 분석해야 하므로, RESTful 리소스 계층 구조(`/api/v1/forms/[id]/submissions`)로 통일하는 것이 DRY 원칙과 자원 지향 설계에 부합합니다.
- **대안 B: 위젯 및 피처를 빌더/컨슈머 단일 쉘로 통합 (`<NavigatorShell mode="builder" | "consumer" />`, `execute-navigator-action`) [채택]**
  - 채택 사유: 툴 콜링 파이프라인의 일관성 확보, 코드 중복 70% 제거, 그리고 동일한 384px 패널 UI를 단일 컴포넌트에서 선언형 설정으로 관리하는 것이 유지보수성과 아키텍처 정합성에 훨씬 부합하여 전격 통합 채택했습니다.
- **대안 C: 폼 진입 시 빈 응답 레코드를 선(先) 생성하는 방식**
  - 기각 사유: 컨슈머(응답자)는 단발성 참여가 지배적이므로 단순 이탈 시 DB에 쓰레기 데이터(Ghost Record)가 쌓입니다. 따라서 브라우저 상태에서 입력을 유지하다가 [제출하기] 시점에 1회 일괄 전송하는 방식을 채택합니다.
- **대안 D: 프리뷰(`preview-dynamic-form`)와 컨슈머 제출(`submit-form-response`)을 별도 피처로 분리 유지**
  - 기각 사유: 폼 필드 렌더링 UI, 유효성 검사 규칙, 인풋 상태 바인딩의 90% 이상이 동일한 도메인 표현입니다. 이를 분리하면 신규 필드(날짜, 체크박스 등) 추가 시 양쪽을 매번 수동 동기화해야 하는 중복 유지보수 비용과 결함 위험이 발생합니다. 따라서 `features/render-dynamic-form` 단일 피처로 통합하고 `mode="preview" | "submission"`으로 분기 제어하는 단일 진실 공급원 방식을 채택했습니다.

---

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **필드 식별자 정합성**: `CoreFormField`의 `id`와 `name` 중 어떤 것을 키값으로 저장할 것인가?
  - 결정: 폼 빌더 생성 시의 일관성을 위해 `name`(바인딩 키)을 기본 데이터 키로 사용하되, `id` 기반 매핑도 호환 지원하도록 밸리데이터를 작성합니다.
- **AI 네비게이터와 클라이언트 폼 입력 상태 간 실시간 동기화**:
  - 해결: Zustand 스토어(`consumer-form-draft.store.ts`)를 도입하여 좌측 네비게이터의 도구 실행 결과(`fillConsumerField`)가 우측 입력 화면 컴포넌트의 폼 상태에 즉각 양방향 반영되도록 설계합니다.

---

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

### 단계별 구현 계획

1. **Phase 1: DB 스키마 & Drizzle 엔티티 (`entities/form-submission`) [완료]**
   - `form_submissions` 물리 테이블 및 외래키/인덱스 DDL 생성
   - RDBMS 실제 마이그레이션 적용 (`npm run db:migrate`)
   - CRUD 서버 함수(`insertSubmission`, `findSubmissionsByFormId`, `updateSubmissionById`, `softDeleteSubmissionById`) 및 단위 테스트 완료
2. **Phase 2: 프리뷰/제출 통합 폼 렌더러 및 동적 Zod 검증 엔진 (`features/render-dynamic-form`) [완료]**
   - 동적 Zod 스키마 조립 엔진(`buildDynamicFormSchema`, `validateSubmissionData`) 구축
   - React Hook Form(`useForm`, `FormProvider`, `zodResolver`) 연동 및 shadcn/ui 인풋 매퍼
   - `DynamicFormRenderer` 통합 컴포넌트(`mode: "preview" | "submission"`) 구현
   - 빌더 라이브 캔버스(`/builder/forms/[slug]`) 연동 및 구 디렉터리 정리
   - 스키마 9개 + 컴포넌트 8개 = 17개 단위 테스트 100% 통과
3. **Phase 3: 표준 RESTful API 엔드포인트 (`app/api/v1/...`) [완료]**
   - 발행된 폼 조회 필터(`?published=true`), 응답 제출/목록/수정/삭제 REST API 구현 및 통합 테스트 완료
4. **Phase 4: 컨슈머 라우터 & 레이아웃 구축 (`app/consumer/...`) [완료]**
   - 리다이렉트, 상단 탭 헤더(폼 목록 / 뷰 목록), 발행 폼 목록 페이지, 뷰 목록 페이지 구축 완료
5. **Phase 5: 폼 입력/제출 화면 및 응답 관리 화면 (`manage-form-submissions`) [완료]**
   - 동적 폼 입력 렌더러, 제출 처리, 응답 데이터 테이블, 삭제 액션 구현 완료
   - 기제출 응답 수정 시 모달 팝업 대신 전용 페이지(`/consumer/forms/[slug]/submissions/[submissionId]/edit`)로 이동하는 넓은 워크스페이스 UX 구축
   - PostgreSQL UUID 바인딩 에러(`invalid input syntax for type uuid`) 방어벽 및 `findFormByIdOrSlug` 공통 헬퍼 적용
6. **Phase 6: 컨슈머 AI 네비게이터 통합 연동 (`features/execute-navigator-action`, `widgets/navigator-shell`) [완료]**
   - 빌더 및 컨슈머 도구 카탈로그 단일화 및 Vercel AI SDK 표준 `toolCalls` 순회 패턴 통일
   - 단일 통합 `NavigatorShell(mode)` 위젯 및 실시간 양방향 폼 반영 완료
   - 신규 폼 제출 모드뿐만 아니라 기제출 응답 수정 페이지에서도 실시간 필드 동기화 및 "수정 완료/저장" 자율 제출 파이프라인 연동
7. **Phase 7: 전체 검증 완주 (`npm run verify`) [완료]**
   - TypeScript 0 errors, ESLint 0 errors, Prettier 100% 매칭
   - 총 43개 테스트 파일, 234개 단위/컴포넌트/통합 테스트 100% 통과 (Pass 100%)
