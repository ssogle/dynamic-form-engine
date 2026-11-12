# [Spec-005] Relational Domain Links, Primary Field Governance & Comprehensive Form Field Expansion

> [!NOTE]
>
> - **상태 (Status)**: Active (구현 완료 및 최종 검증 진행)
> - **브랜치 (Branch)**: `feat/spec-005-relational-domain-link-and-select-options`
> - **작성일 (Created)**: 2026-11-12
> - **완료일 (Archived)**: -

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

1. **독립된 폼 도메인 간의 연결성(Relational Link) 부재**:
   - 기존 시스템(Spec-001 ~ 004)은 단일 폼 내에서 독립적인 데이터 레코드 CRUD를 지원하지만, 여러 폼 간의 비즈니스 관계(예: 프로젝트 <-> 비용, 프로젝트 <-> 작업 기록)를 맺을 수 없습니다.
   - 실무자는 비용 등록 시 기존 프로젝트를 표(Table) 형태로 탐색하여 선택하고, 상세 화면에서는 선택된 레코드의 전체 주요 컬럼과 역참조 내역을 한눈에 확인하기를 원합니다.

2. **관계형 대표 식별 기준(`primaryFieldId`) 및 UX 개선 필요**:
   - 매번 관계형 필드를 추가할 때마다 `displayField`를 중복 선언하면, 타깃 도메인의 대표 컬럼이 바뀌거나 폼마다 서로 다른 기준을 가리켜 일관성이 깨집니다.
   - 따라서 타깃 폼 자체가 **"이 도메인 행(Row)을 대표하는 1개의 식별 필드(`primaryFieldId`)"**를 필수로 선언(Single Source of Truth)하고, 관계형 필드는 `targetFormId`와 `multiple`만 보유하는 구조가 적합합니다.
   - 또한 단순 좁은 드롭다운(Combobox)만으로는 타깃 레코드의 여러 속성을 비교해 선택하기 어렵기 때문에, **선택 완료 상태는 Selected Rows Mini Table**로, **탐색/선택은 Target Form Table Picker (`Dialog`)**로 분리하고, 상위 응답 목록 테이블의 단일 셀(Cell)에서는 `primaryFieldId` 기반 요약 라벨(`"대표값"` / `"대표값 외 N건"`)을 표기합니다.

3. **가벼운 선택지(Select / Radio / Checkbox)의 라벨 무결성 딜레마**:
   - 우선순위, 상태값 등 고정 선택지를 다룰 때 옵션이 폐기되거나 삭제되면 DB에 저장된 과거 데이터의 한글 라벨이 유실되거나 수정 화면(`/edit`)에서 빈칸 버그가 발생합니다.
   - 따라서 **"소프트 비활성화(`disabled: true`)"**, **"수정 폼 렌더링 예외 공식"**, 그리고 **필드 및 옵션별 필수 `description` 명세**를 도입하여 라벨 무결성과 AI 컨텍스트 이해도를 동시에 보장합니다.

4. **엔터프라이즈 업무 서식을 위한 정예 데이터 도메인 필드 확장**:
   - 기존 `text`, `textarea`, `number`, `select` 4종에 더해 `radio`, `checkbox`, `date`, `switch`, `relation`을 추가하여 총 9종의 순수 데이터 도메인 필드를 제공합니다.
   - 자유 입력 태그(`tags`)나 비데이터 레이아웃 요소(`section`)는 배제하여 순수 데이터 스키마 거버넌스를 유지합니다.

5. **폼 빌더 철학: AI Navigator 단일 관제와 순수 라이브 캔버스**:
   - 빌더 화면(`/builder/forms/[id]`)에 수동 GUI 설정 패널이나 마우스 편집 버튼을 두지 않고, **AI Navigator 대화형 제어**로만 스키마와 `primaryFieldId`를 설정/변경하며 우측 캔버스는 실시간 프리뷰와 `PrimaryFieldBadge` 시각화 역할만 수행합니다.

6. **엣지 테이블 기반 경량 온톨로지(`relations` 테이블) 및 배치 조회**:
   - PostgreSQL 내부에 초경량 `relations` 엣지 테이블(`source_id`, `target_id`, `field_id`, `created_at`)과 `onDelete: "cascade"` 외래키를 두고, 역방향 탐색(`GET /api/v1/relations`)과 정방향/테이블 셀 요약 일괄 조회(`GET /api/v1/forms/[id]/submissions?ids=...`)를 결합한 **Two-Phase Query** 아키텍처를 구현합니다.

---

## 2. 목표 및 비목표 (Goals & Non-Goals)

### Goals

1. **코어 데이터 도메인 필드 9종 스키마 및 UI 확장**:
   - **기본 입력**: `text` (단문), `textarea` (장문), `number` (숫자)
   - **정형 인라인 선택**: `select` (드롭다운 단일), `radio` (라디오 버튼 단일), `checkbox` (다중 선택 체크박스 그룹)
   - **날짜 및 불리언**: `date` (달력 날짜 선택 `YYYY-MM-DD`), `switch` (참/거짓 토글 스위치)
   - **도메인 간 관계형 연결**: `relation` (Selected Rows Mini Table + Target Form Table Picker `Dialog`)
   - 모든 필드 정의(`coreFormFieldSchema`)에 도메인 의미 파악용 `description` 필드를 필수로 부여합니다.

2. **도메인 대표 식별 필드(`primaryFieldId`) 거버넌스 및 UI 배지화**:
   - `formSchemaDefinitionSchema`에서 `primaryFieldId`와 최소 1개 이상의 활성 필드를 필수로 검증하며, `validatePrimaryFieldSelection` 유틸리티를 통해 `checkbox`(배열)와 `relation`(UUID 참조) 타입이 대표 필드로 지정되는 것을 원천 차단합니다.
   - `PrimaryFieldBadge` 공용 엔티티 UI 컴포넌트를 신설하여 빌더 프리뷰, 컨슈머 입력/수정 폼(`FormFieldWrapper`), 응답 목록 컬럼 헤더(`ColumnHeaderFilter`), 상세 뷰(`SubmissionDetailView`), 관계형 서브테이블(`RelatedSubmissionSubtable`)에서 대표 필드를 일관되게 식별 표시합니다.

3. **인라인 옵션 고도화 및 소프트 비활성화 (`select`, `radio`, `checkbox`)**:
   - 옵션 규격을 `{ label: string, value: string, description: string, disabled: boolean }`로 표준화합니다.
   - **신규 입력 폼 (`/new`)**: `!opt.disabled` 활성 옵션만 노출합니다.
   - **수정 폼 (`/edit`)**: `!opt.disabled || isSelected` 예외 공식을 적용하여 과거 비활성 옵션 선택값이 유실되지 않도록 보존합니다.

4. **도메인 간 관계형 필드 구축 (`type: "relation"`) 및 Table Picker UX**:
   - `relationConfigSchema`를 `{ targetFormId: uuid, multiple: boolean }`으로 단순화하여 타깃 폼의 `primaryFieldId`를 단일 진실 원천으로 재사용합니다.
   - `RelationFieldInput`은 선택된 레코드들을 타깃 폼 컬럼(`primaryFieldId` 우선 정렬) 기준의 **Selected Rows Mini Table**로 렌더링하고, **Target Form Table Picker (`Dialog`)**를 통해 타깃 폼의 전체 레코드를 검색/정렬/페이지네이션하며 선택할 수 있도록 구현합니다.
   - 단건 조회를 위한 `GET /api/v1/forms/[id]/submissions?ids=uuid1,uuid2,...` 배치 필터 API 및 `useFormSubmissionsByIdsQuery` 훅을 제공합니다.

5. **경량 온톨로지 `relations` 테이블 신설 및 양방향 서브테이블 렌더링**:
   - `src/shared/tables/relations.table.ts` DDL(`sourceId`, `targetId`, `fieldId`, `createdAt`) 및 `form_submissions.id`에 대한 `onDelete: "cascade"` 외래키를 구축합니다.
   - 상세 뷰에서 정방향 `relation` 필드 역시 `RelatedSubmissionSubtable`로 미니 테이블을 재사용 렌더링하고, 하단 역참조 `[연결된 내역]` 탭으로 역방향 엣지를 자동 탐색해 표시합니다.
   - 목록 뷰의 `relation` 셀은 `useRelationLookup` 배치 조회 결과를 바탕으로 `"대표값"` 또는 `"대표값 외 N건"` 요약 텍스트로 렌더링합니다.

6. **AI Navigator 자율주행 빌더 도구 고도화**:
   - `createForm`, `updateSchema` (신규 연산 `SET_PRIMARY_FIELD` 포함), `addRelationField`, `updateFieldOptions` 도구를 개선하여 대화형 스키마 편집 시 `primaryFieldId`가 항상 유효하게 지정/보호되도록 강제합니다.
   - 타깃 폼에 `primaryFieldId`가 없거나 유효하지 않을 경우 `addRelationField` 단계에서 연결을 차단하고 안내합니다.

### Non-Goals

- **폼 빌더 화면에서의 직접 GUI 편집 버튼/모달 배제**: `primaryFieldId` 변경을 포함한 모든 스키마 편집은 오직 AI Navigator 대화형 명령을 통해서만 수행합니다.
- **비정형 자유 태그(`type: "tags"`) 및 비데이터 레이아웃(`type: "section"`) 배제**: 스키마 순수성 유지를 위해 본 스펙에서 제외합니다.
- **레거시(`primaryFieldId` 미보유) 폼 하위 호환 마이그레이션 배제**: 기존 테스트 데이터는 리셋을 전제로 엄격한 `primaryFieldId` 필수 검증을 적용합니다.
- **파일 첨부(`type: "file"`) 및 계정 RBAC 통합 배제**: 차기 전용 스펙으로 격리합니다.

---

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

### 1) FSD 계층별 책임 및 핵심 파일 구조

```text
src/
├── shared/
│   ├── tables/
│   │   ├── forms.table.ts                           # [확장] schemaDefinition에 primaryFieldId 포함 타입 선언
│   │   ├── relations.table.ts                       # [신설] 경량 온톨로지 엣지 테이블 DDL (Cascade FK)
│   │   └── index.ts                                 # 테이블 Public API export
│   └── ui/
│       ├── radio-group.tsx                          # [신설] shadcn/ui 공식 라디오 그룹
│       ├── calendar.tsx                             # [신설] shadcn/ui 공식 캘린더
│       ├── combobox.tsx                             # [신설] shadcn/ui 공식 콤보박스
│       ├── switch.tsx                               # [신설] shadcn/ui 공식 토글 스위치
│       ├── separator.tsx                            # [신설] shadcn/ui 공식 구분선
│       ├── dialog.tsx                               # Table Picker 모달 재사용
│       └── table.tsx                                # 미니 테이블 및 피커 테이블 재사용
├── entities/
│   ├── form/
│   │   ├── lib/
│   │   │   └── primary-field.ts                     # [신설] validatePrimaryFieldSelection, resolvePrimaryFieldId, extractPrimaryFieldValue
│   │   ├── schema/
│   │   │   ├── form-field.schema.ts                 # [확장] 9종 필드 타입, selectOptionSchema(description 포함), 간소화된 relationConfigSchema
│   │   │   └── form.schema.ts                       # [확장] formSchemaDefinitionSchema (필수 primaryFieldId 및 정합성 검증)
│   │   ├── types/
│   │   │   └── dynamic-form.types.ts                # [확장] FormSchemaDefinition 및 파생 타입
│   │   └── ui/
│   │       └── primary-field-badge.tsx              # [신설] 대표 식별 필드 공용 시각 배지
│   └── form-submission/
│       ├── queries/
│       │   ├── form-submissions.keys.ts             # [확장] ids 배치 조회용 byIds 키 추가
│       │   ├── use-form-submissions.query.ts        # [확장] getFormSubmissionsByIds, useFormSubmissionsByIdsQuery
│       │   └── use-related-submissions.query.ts     # [신설] 특정 targetId 역참조 데이터 페칭 훅
│       ├── schema/
│       │   └── submission-query.schema.ts           # [확장] 쉼표 구분 UUID ids 파라미터 및 parseIdsParam
│       └── server/
│           └── form-submission.server.ts            # [확장] ids batch 필터 조회 및 relations 엣지 동기화
├── features/
│   ├── render-dynamic-form/
│   │   ├── lib/
│   │   │   └── relation-table.ts                    # [신설] 피커 컬럼 빌더 및 단일/다중 ID 토글 순수 로직
│   │   └── ui/
│   │       ├── dynamic-field.tsx                    # [확장] 9종 컨트롤 매핑 및 isPrimary 연동
│   │       ├── dynamic-form-renderer.tsx            # [확장] primaryFieldId 기반 isPrimary 전달
│   │       ├── form-field-wrapper.tsx               # [확장] PrimaryFieldBadge 표기
│   │       └── relation-field-input.tsx             # [신설] Selected Rows Mini Table + Table Picker Dialog
│   ├── manage-form-submissions/
│   │   ├── hooks/
│   │   │   ├── use-relation-lookup.hook.ts          # [신설] relation 필드 일괄 메타/서브미션 배치 조회 공용 훅
│   │   │   ├── use-submission-list-table.hook.ts    # [확장] relation 셀 대표값 요약 렌더링 연동
│   │   │   └── use-submission-detail-view.hook.ts   # [확장] primaryDisplayValue 및 정방향 relation 서브테이블 구성
│   │   ├── lib/
│   │   │   └── relation-summary.ts                  # [신설] 배치 요청 수집 및 "대표값 외 N건" 요약 포맷터
│   │   └── ui/
│   │       ├── column-header-filter.tsx             # [확장] 컬럼 헤더 내 PrimaryFieldBadge 표기
│   │       ├── related-submission-subtable.tsx      # [신설] primaryFieldId 우선 정렬 + PrimaryFieldBadge 서브테이블
│   │       └── submission-detail-view.tsx           # [확장] 정방향/역방향 relation 서브테이블 및 대표값 헤더 표시
│   └── execute-navigator-action/
│       ├── lib/tools/builder-tools.ts               # [확장] SET_PRIMARY_FIELD 및 primaryFieldId 보호 로직
│       ├── lib/prompts/builder-prompt.ts            # [확장] primaryFieldId 지정 규칙 및 9종 필드 가이드라인
│       └── schema/navigator-request.schema.ts       # [확장] SET_PRIMARY_FIELD 및 primaryFieldId 계약 반영
├── widgets/
│   └── navigator-shell/
│       └── hooks/use-navigator-shell.hook.ts        # [확장] currentForm.primaryFieldId 및 대표값 기반 컨슈머 컨텍스트
└── app/
    └── api/v1/
        ├── forms/[id]/submissions/route.ts          # [확장] ids 쿼리 파라미터를 통한 다건 배치 조회 지원
        └── relations/route.ts                       # [신설] 특정 타깃 엔티티의 역참조 링크 조회 API
```

---

### 2) 데이터 계약 (Schema & Interfaces)

#### (1) 코어 필드, 옵션 및 관계 설정 스키마 (`form-field.schema.ts`, `form.schema.ts`)

```typescript
export const coreFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "switch",
  "relation",
]);

export const selectOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  description: z.string().trim().min(1),
  disabled: z.boolean().default(false),
});

export const relationConfigSchema = z.object({
  targetFormId: z.uuid(),
  multiple: z.boolean().default(false),
});

export const formSchemaDefinitionSchema = z
  .object({
    primaryFieldId: z.string().trim().min(1),
    fields: z.array(coreFormFieldSchema).min(1),
  })
  .superRefine((val, ctx) => {
    const result = validatePrimaryFieldSelection(val.fields, val.primaryFieldId);
    if (!result.isValid) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryFieldId"],
        message: result.reason ?? "유효하지 않은 대표 필드 지정입니다.",
      });
    }
  });
```

#### (2) 경량 온톨로지 테이블 DDL (`relations.table.ts`)

```typescript
export const relations = pgTable(
  "relations",
  {
    sourceId: uuid("source_id")
      .notNull()
      .references(() => formSubmissions.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => formSubmissions.id, { onDelete: "cascade" }),
    fieldId: varchar("field_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.targetId, table.fieldId] }),
    index("idx_relations_source").on(table.sourceId),
    index("idx_relations_target").on(table.targetId),
  ]
);
```

---

### 3) 프론트엔드 렌더링 및 조회 공식

1. **수정 폼 비활성 옵션 보존 공식**:
   - 단일 선택(`select`, `radio`): `!opt.disabled || opt.value === currentValue`
   - 다중 선택(`checkbox`): `!opt.disabled || selectedValues.includes(opt.value)`

2. **관계형 셀 대표값 요약 규칙 (`relation-summary.ts`)**:
   - 참조 ID가 없으면 `"-"` 반환.
   - 단건이면 타깃 폼의 `primaryFieldId` 값을 포맷팅해 반환(미존재 시 `id` 앞 8자리 폴백).
   - 다건이면 첫 번째 대표값 + `" 외 N건"` 형태로 요약 반환.

3. **관계형 배치 조회 (`useRelationLookup`)**:
   - 현재 폼 스키마의 `relation` 필드들이 참조하는 고유 `targetFormId`를 모아 `useFormDetailQuery`로 타깃 스키마를 병렬 조회하고, 필요한 레코드 UUID 집합을 모아 `useFormSubmissionsByIdsQuery`(`GET /api/v1/forms/[id]/submissions?ids=...`)로 일괄 조회하여 N+1 요청을 방지합니다.

---

### 4) 향후 필터 확장을 위한 설계 고려사항 (Design Considerations)

`field.type`에 따른 결정론적 필터 매핑 가이드라인은 다음과 같습니다:

- `number` -> `range` (`min` ~ `max`)
- `date` -> `dateRange` (`from` ~ `to`)
- `select`, `radio` -> `in` (`values[]`)
- `switch`, `checkbox` -> `booleanEquals` (`true` / `false`)
- `relation` -> `relationIn` (`targetIds[]`)
- `text`, `textarea` -> `contains` (`ILIKE`)

---

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: `relationConfig`에 매번 `displayField`를 중복 선언**:
  - _기각 사유_: 동일한 타깃 도메인을 여러 폼에서 참조할 때 대표 컬럼 기준이 파편화됩니다. 타깃 폼 스키마가 `primaryFieldId`를 필수 선언하여 단일 진실 원천으로 관리하는 구조로 대체했습니다.
- **대안 B: `relation` 입력 UI를 단순 검색형 콤보박스(`Combobox`)로만 구현**:
  - _기각 사유_: 사용자는 타깃 레코드의 대표값 외에 다른 보조 속성 컬럼도 표로 확인한 뒤 선택하고 싶어합니다. 따라서 선택 완료 목록은 Selected Rows Mini Table로, 선택 과정은 검색/정렬/페이지네이션을 지원하는 Target Form Table Picker (`Dialog`)로 구현했습니다.
- **대안 C: 빌더 화면에 GUI `primaryFieldId` 드롭다운 설정 추가**:
  - _기각 사유_: 빌더의 단일 관제탑은 AI Navigator이며, 우측 캔버스는 순수 라이브 프리뷰 + `PrimaryFieldBadge` 표시 역할에 집중합니다.
- **대안 D: 비정형 자유 태그(`tags`) 또는 레이아웃 구분선(`section`) 필드 포함**:
  - _기각 사유_: 스키마와 응답 데이터 구조를 순수 데이터 도메인 중심으로 유지하기 위해 제외했습니다.
- **대안 E: 옵션 물리 삭제(`DELETE`)**:
  - _기각 사유_: 과거 데이터의 라벨 무결성이 파괴되므로 `disabled: true` 소프트 비활성화로 해결합니다.

---

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **참조 무결성 및 삭제/누락 레코드 표현**:
  - `relations` 테이블은 `form_submissions.id`에 `onDelete: "cascade"` 외래키를 연결하여 물리 삭제 시 고아 엣지를 자동 정리합니다.
  - 또한 JSONB `data` 내부에 과거 참조 UUID가 잔존하더라도, 상세 뷰에서 조회 누락 ID(`missingIds`)를 분리 표기하고 목록 셀에서는 UUID 앞 8자리 폴백을 제공하여 런타임 오류를 방지합니다.
- **대표 필드(`primaryFieldId`) 보호 무결성**:
  - `REMOVE_FIELD`, `MODIFY_FIELD`, `SET_ALL_FIELDS`, `SET_PRIMARY_FIELD` 등 AI Navigator의 모든 스키마 수정 경로에서 `validatePrimaryFieldSelection`을 통해 대표 필드가 사라지거나 부적격 타입(`checkbox`, `relation`)으로 바뀌는 변경을 즉시 차단합니다.
- **대량 타깃 레코드 탐색 성능**:
  - Target Form Table Picker (`Dialog`)는 페이지 단위(`page`, `pageSize`) 서버 조회와 디바운스 검색/정렬 파라미터를 사용하며, 목록/상세 화면은 실제 참조된 ID 집합만 `?ids=...` 배치 파라미터로 조회하여 불필요한 전체 테이블 로드를 방지합니다.

---

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **Phase 1: 도메인 대표 필드(`primaryFieldId`), 9종 스키마 및 DB 인프라 (`entities/form`, `shared/tables`)**:
  - `relations.table.ts` Cascade FK 및 `primaryFieldId` 필수 스키마/유틸리티/배지 구현 및 TDD 검증 완료
- **Phase 2: AI Navigator 빌더 도구 & 프롬프트 고도화 (`execute-navigator-action`, `navigator-shell`)**:
  - `SET_PRIMARY_FIELD`, `createForm`, `updateSchema` 보호 로직 및 `addRelationField` 타깃 `primaryFieldId` 검증 완료
- **Phase 3: `ids` 배치 조회 API 및 클라이언트 훅 (`entities/form-submission`, `api/v1/forms/[id]/submissions`)**:
  - 쉼표 구분 UUID 배치 필터 쿼리 스키마, Drizzle `inArray` 서버 조회, `useFormSubmissionsByIdsQuery` 검증 완료
- **Phase 4: 관계형 Table Picker, 미니 테이블 및 목록/상세 UI 고도화 (`render-dynamic-form`, `manage-form-submissions`)**:
  - Selected Rows Mini Table + Target Form Table Picker (`Dialog`), `useRelationLookup` 배치 조회, 목록 셀 대표값 요약, 상세 뷰 정방향/역방향 `RelatedSubmissionSubtable` 및 `PrimaryFieldBadge` 통합 적용
  - `npm run fix && npm run verify` 전체 파이프라인 결함 0건 최종 검증
