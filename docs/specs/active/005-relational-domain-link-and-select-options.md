# [Spec-005] Relational Domain Links & Comprehensive Form Field Expansion

> [!NOTE]
>
> - **상태 (Status)**: Active (기획 확정 및 구현 진행)
> - **브랜치 (Branch)**: `feat/spec-005-relational-domain-link-and-select-options`
> - **작성일 (Created)**: 2026-11-12
> - **완료일 (Archived)**: -

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

1. **독립된 폼 도메인 간의 연결성(Relational Link) 부재**:
   - 현재 시스템(Spec-001 ~ 004)은 단일 폼 내에서 독립적인 데이터 레코드 CRUD를 지원하지만, 여러 폼 간의 비즈니스 관계(예: 프로젝트 <-> 비용, 프로젝트 <-> 작업 기록)를 맺을 수 없습니다.
   - 현업 실무자는 "비용을 등록할 때 기존에 등록된 프로젝트를 선택"하거나, "프로젝트 상세 화면에서 여기에 연결된 비용 목록을 한눈에 확인"하기를 원합니다.
   - 이를 해결하기 위해 엔터프라이즈 RDBMS의 외래키(Foreign Key) 및 문서/스프레드시트 도메인의 관계형(Relation) 필드 규격이 필수적입니다.

2. **가벼운 선택지(Enum / Select / Radio)의 라벨 무결성 딜레마**:
   - 프로젝트 타입, 우선순위(상/중/하), 상태값 등 고정 선택지를 다룰 때, 옵션이 변경되거나 삭제되면 DB에 저장된 과거 데이터의 한글 라벨이 유실되거나, 프론트엔드 수정 화면(`/edit`)에서 셀렉트 박스가 빈칸으로 터지는 치명적인 렌더링 버그가 발생합니다.
   - 따라서 **"소프트 비활성화(`disabled: true`)"** 규격과 **"수정 폼 렌더링 예외 공식"**을 도입하여 과거 데이터의 라벨 무결성을 영구 보존해야 합니다.

3. **엔터프라이즈 업무 서식 제작을 위한 필드 다양성 부족**:
   - 기존 시스템은 코어 필드가 `text`, `textarea`, `number`, `select` 4가지만 지원되어, 실제 현업 업무 서식(견적서, 일정 관리, 설문, 신청서 등)을 만들기에는 역부족이었습니다.
   - 라디오 버튼(`radio`), 체크박스(`checkbox`), 날짜 선택(`date`), 토글 스위치(`switch`), 서식 구획 구분선(`section`)을 1급 시민 필드로 확장해야 합니다.
   - 이때 차후 데이터 분석/집계 시 노이즈를 유발하는 비정형 자유 태그(`tags`) 등은 배제하고, 정형화된 데이터 거버넌스를 충족하는 정예 필드들로 구성합니다.

4. **폼 빌더 철학: AI Navigator 자율주행 관제탑과 순수 라이브 캔버스**:
   - 빌더 화면에서 사용자에게 복잡한 마우스 드래그앤드롭이나 수많은 설정 폼 조작 권한을 부여하는 것은 오히려 사용성을 저해하고 시스템 복잡도를 가중시키는 안티패턴입니다.
   - 빌더의 유일한 설정 창구는 좌측의 **AI Navigator(대화형 관제탑)**가 전담하며, 우측 캔버스는 에이전트의 작업 결과를 즉시 보여주는 **순수 실시간 라이브 뷰어(Live Canvas)**로 정체성을 확립합니다.

5. **엣지 테이블 기반 경량 온톨로지(`relations` 테이블) 필요성**:
   - 관계형 데이터를 조회할 때 무거운 다중 `JOIN`이나 별도의 그래프 DB를 도입하는 것은 오버엔지니어링(YAGNI 위반)입니다.
   - PostgreSQL 내부에 초경량 `relations` 엣지 테이블(`source_id`, `target_id`, `relation_type`)을 단 하나 두고, **Two-Phase Query(1단계 링크 탐색 -> 2단계 일괄 조회)** 아키텍처를 구현하여 상세 뷰 하단 탭(Related Lists)을 자동 렌더링합니다.

---

## 2. 목표 및 비목표 (Goals & Non-Goals)

### Goals

1. **코어 필드 타입 8종 + 1종 레이아웃 스키마 및 UI 확장**:
   - **기본 입력**: `text` (단문), `textarea` (장문), `number` (숫자)
   - **정형 인라인 선택**: `select` (드롭다운 단일), `radio` (라디오 버튼 단일), `checkbox` (단일 불리언 또는 다중 선택)
   - **날짜 및 불리언**: `date` (UTC 날짜 선택 캘린더), `switch` (참/거짓 토글 스위치)
   - **도메인 간 관계형 연결**: `relation` (타깃 폼 서브미션 검색 콤보박스)
   - **서식 구조화 레이아웃**: `section` (구획 구분선 및 섹션 안내 제목)

2. **인라인 옵션 고도화 및 소프트 비활성화 (`select`, `radio`)**:
   - 옵션 규격을 `{ label: string, value: string, disabled?: boolean }[]`로 표준화 (기존 문자열 배열과의 100% 하위 호환성 보장).
   - **신규 입력 폼 (`/new`)**: `!opt.disabled` 활성 옵션만 노출.
   - **수정 폼 (`/edit`)**: `!opt.disabled || opt.value === currentValue` 공식을 적용하여, 기존에 비활성화된 값이 선택되어 있어도 빈칸 버그 없이 온전히 렌더링하고, 타 옵션 선택 시 폐기 옵션 자동 소멸 유도.
   - **상세 뷰**: 비활성화된 옵션이라도 스키마 메타데이터를 통해 원래의 한글 라벨 정상 렌더링.

3. **도메인 간 관계형 필드 구축 (`type: "relation"`)**:
   - `relationConfig` 스키마 신설: `targetFormId` (참조 대상 폼 UUID), `displayField` (노출 대표 필드 ID), `multiple` (단일 vs 다중 선택).
   - 동적 필드 렌더러(`DynamicField`)에서 대상 폼의 레코드 목록을 서버 페칭하여 **검색형 콤보박스(Searchable Combobox)** UI로 렌더링.
   - 제출 시 `data` JSONB에 대상 레코드의 `id(UUID)` 영속화.

4. **경량 온톨로지 `relations` 테이블 신설 및 서브미션 동기화**:
   - `src/shared/tables/relations.table.ts` DDL 정의 (`source_id`, `source_type`, `target_id`, `target_type`, `relation_type`, `metadata`, `created_at`).
   - 복합 기본키 `(source_id, target_id, relation_type)` 및 인덱스 2종 구축.
   - `relation` 필드가 포함된 응답이 등록/수정/삭제될 때 `relations` 엣지 테이블에 자동 동기화(트랜잭션 안전성 보장).

5. **상세 뷰의 자동 역참조 탭 (Auto-Discovered Related Lists)**:
   - 컨슈머 레코드 상세 화면 하단에, 현재 레코드를 `target_id`로 바라보는 다른 폼들의 데이터를 `relations` 테이블에서 자동 탐색.
   - 하단에 `[ 연결된 내역 (비용 n건) ]`, `[ 작업 기록 (n건) ]` 탭을 시스템이 자동으로 조립하여 미니 그리드로 렌더링.

6. **AI Navigator 자율주행 빌더 도구 고도화**:
   - 폼 빌더 화면(`/builder/forms/[id]`)에서 설계자의 자연어 명령을 해석하여 관계형 필드를 생성하고 옵션을 소프트 비활성화하는 전용 도구 제공:
     - `addRelationField`: 대상 폼 목록을 스캔하여 관계형 필드 자동 주입.
     - `updateFieldOptions`: 옵션 추가, 수정 및 `disabled: true` 소프트 디프리케이션 수행.
     - `addField`: `radio`, `checkbox`, `date`, `switch`, `section` 필드 자연어 생성.

### Non-Goals

- **폼 빌더 화면에서의 직접 GUI 편집 패널 구축 배제**: 마우스 클릭 드로어/모달을 통한 직접 폼 편집 UI를 배제하고, AI Navigator를 통한 대화형 관제탑과 우측 실시간 라이브 캔버스 프리뷰 조합에 집중합니다.
- **비정형 자유 태그(`type: "tags"`) 배제**: 데이터 분석 관점의 노이즈와 파편화를 방지하기 위해 자유 입력 태그는 본 스펙에서 명시적으로 제외합니다.
- **필터 허용 여부(`filterable`) 플래그 및 복잡한 필터 쿼리 엔진 배제**: 향후 타입별 필터 쿼리 도입을 위한 타입 설계 가이드라인만 수립하고, 본 스펙에서는 쿼리 엔진 구현을 제외하여 YAGNI를 준수합니다.
- **파일/영수증 첨부(`type: "file"`) 배제**: 스토리지 버킷 및 멀티파트 업로드 인프라가 수반되므로 차기 파일 전용 스펙으로 격리합니다.
- **계정 시스템(`type: "user"`) 및 RBAC 통합 배제**: 순수 비즈니스 폼 간의 관계형 연결에 집중하며 인증 시스템은 별도 스펙으로 격리합니다.

---

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

### 1) FSD 계층별 책임 및 파일 구조

```text
src/
├── shared/
│   ├── tables/
│   │   ├── relations.table.ts                  # [신설] 경량 온톨로지 엣지 테이블 DDL
│   │   └── index.ts                            # 테이블 Public API export
│   └── ui/
│       ├── radio-group.tsx                     # [신설] shadcn/ui 공식 라디오 그룹
│       ├── calendar.tsx                        # [신설] shadcn/ui 공식 캘린더
│       ├── combobox.tsx                        # [신설] shadcn/ui 공식 1급 콤보박스 (ui.shadcn.com/r/index.json)
│       ├── switch.tsx                          # [신설] shadcn/ui 공식 토글 스위치
│       └── separator.tsx                       # [신설] shadcn/ui 공식 구분선
├── entities/
│   ├── form/
│   │   ├── schema/
│   │   │   ├── form-field.schema.ts            # [확장] 8종+1종 필드 타입 및 selectOptionSchema 객체 고도화
│   │   │   └── form-relation.schema.ts         # [신설] 관계형 필드 설정 Zod 스키마
│   │   └── types/
│   │       └── dynamic-form.types.ts           # [확장] SelectOption 및 RelationConfig 파생 타입
│   └── form-submission/
│       ├── queries/
│       │   └── use-related-submissions.query.ts# [신설] 특정 target_id에 연결된 역참조 데이터 페칭 훅
│       └── server/
│           └── form-submission.server.ts       # [확장] 제출 시 relations 테이블 자동 동기화 로직
├── features/
│   ├── render-dynamic-form/
│   │   └── ui/
│   │       ├── dynamic-field.tsx               # [확장] 8종+1종 렌더링 컨트롤 매핑
│   │       ├── consumer-submission-editor.tsx  # [확장] 수정 폼 예외 공식(!disabled || value === current) 적용
│   │       └── relation-field-input.tsx        # [신설] 타깃 도메인 옵션 비동기 페칭 콤보박스 컴포넌트
│   ├── manage-form-submissions/
│   │   └── ui/
│   │       ├── submission-detail-view.tsx      # [확장] 하단 [연결된 내역] 자동 탭 섹션 조립
│   │       └── related-submission-subtable.tsx # [신설] 역참조 데이터 서브 테이블 렌더러
│   └── execute-navigator-action/
│       ├── lib/tools/builder-tools.ts          # [확장] addRelationField, updateFieldOptions 등 빌더 툴 신설
│       └── lib/prompts/builder-prompt.ts       # [확장] 8종 필드 생성 및 소프트 비활성화 가이드라인 주입
└── app/
    └── api/v1/
        ├── forms/[id]/submissions/route.ts     # 기존 API 재사용 (콤보박스 옵션 페칭용)
        └── relations/route.ts                  # [신설] 특정 타깃 엔티티의 역참조 링크 조회 API
```

---

### 2) 데이터 계약 (Schema & Interfaces)

#### (1) 코어 필드 타입 확장 및 셀렉트 옵션 스키마 (`form-field.schema.ts`)

```typescript
import { z } from "zod";

/**
 * 확장된 코어 폼 필드 타입 (8종 입력 + 1종 레이아웃)
 */
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
  "section",
]);

export type CoreFieldType = z.infer<typeof coreFieldTypeSchema>;

/**
 * 개별 인라인 옵션 Zod 스키마 (소프트 비활성화 지원)
 */
export const selectOptionSchema = z.object({
  label: z.string().min(1, "옵션 라벨은 필수입니다."),
  value: z.string().min(1, "옵션 값은 필수입니다."),
  disabled: z.boolean().default(false),
});

export type SelectOption = z.infer<typeof selectOptionSchema>;

/**
 * 하위 호환성을 보장하는 정규화 옵션 스키마 (문자열 배열 유입 시 객체 배열로 자동 변환)
 */
export const selectOptionsInputSchema = z.array(
  z.union([
    selectOptionSchema,
    z.string().transform((str) => ({ label: str, value: str, disabled: false })),
  ])
);

/**
 * 관계형 필드 설정 Zod 스키마
 */
export const relationConfigSchema = z.object({
  targetFormId: z.string().uuid("참조 대상 폼 ID는 올바른 UUID여야 합니다."),
  displayField: z.string().min(1, "대표 노출 필드 ID는 필수입니다."),
  multiple: z.boolean().default(false),
});

export type RelationConfig = z.infer<typeof relationConfigSchema>;

/**
 * 개별 폼 필드 정의 Zod 스키마
 */
export const coreFormFieldSchema = z.object({
  id: z.string().min(1, "필드 ID는 필수입니다."),
  label: z.string().min(1, "필드 라벨을 입력해 주세요."),
  type: coreFieldTypeSchema,
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  options: selectOptionsInputSchema.optional(),
  relationConfig: relationConfigSchema.optional(),
  description: z.string().optional(),
  deletedAt: z.string().optional(),
});
```

#### (2) 경량 온톨로지 테이블 DDL (`relations.table.ts`)

```typescript
import { pgTable, uuid, varchar, jsonb, timestamp, index, primaryKey } from "drizzle-orm/pg-core";

export const relations = pgTable(
  "relations",
  {
    sourceId: uuid("source_id").notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // 'SUBMISSION' | 'FORM'
    targetId: uuid("target_id").notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'SUBMISSION' | 'FORM'
    relationType: varchar("relation_type", { length: 50 }).notNull(), // 'EXPENSE_OF' | 'LINKED_TO'
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.targetId, table.relationType] }),
    index("idx_relations_source").on(table.sourceId, table.relationType),
    index("idx_relations_target").on(table.targetId, table.relationType),
  ]
);
```

---

### 3) 프론트엔드 렌더링 공식 (수정 폼 빈칸 방지)

```typescript
// features/render-dynamic-form/ui/consumer-submission-editor.tsx

// 1. 단일 선택 (select, radio)
const computedSingleOptions = useMemo(() => {
  if (!field.options) return [];
  return field.options.filter((opt) => !opt.disabled || opt.value === currentRecordValue);
}, [field.options, currentRecordValue]);

// 2. 다중 선택 (checkbox)
const computedMultiOptions = useMemo(() => {
  if (!field.options) return [];
  const selectedValues = Array.isArray(currentRecordValues) ? currentRecordValues : [];
  return field.options.filter((opt) => !opt.disabled || selectedValues.includes(opt.value));
}, [field.options, currentRecordValues]);
```

---

### 4) 향후 필터 확장을 위한 설계 고려사항 (Design Considerations)

본 스펙에서는 필터 쿼리를 구현하지 않지만, 차기 검색/필터 스펙 개발 시 본 스펙에서 정의된 `field.type`에 따라 결정론적 연산자가 1:1로 매핑됩니다:

- `number` -> `range` (`min` ~ `max`)
- `date` -> `dateRange` (`from` ~ `to`)
- `select`, `radio` -> `in` (`values[]`)
- `switch`, `checkbox` -> `booleanEquals` (`true` / `false`)
- `relation` -> `relationIn` (`targetIds[]`)
- `text`, `textarea` -> `contains` (`ILIKE`)
- `section` -> 필터 대상 자동 제외

---

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 빌더 화면에 복잡한 시각적 GUI 필드 편집 패널(Drawer/Modal) 구축**:
  - _기각 사유_: 제품의 정체성은 "자연어 대화로 폼을 완성하는 자율주행 빌더"입니다. 마우스 드래그앤드롭과 복잡한 설정 폼을 도입하면 사용자의 인지 부하가 증가하고 관리 복잡도가 폭증하므로, AI Navigator를 단일 관제 창구로 유지하고 우측 캔버스는 순수 실시간 라이브 뷰어로 유지합니다.
- **대안 B: 비정형 자유 태그(`type: "tags"`) 도입**:
  - _기각 사유_: 사용자가 자유롭게 입력하는 태그는 오탈자, 띄어쓰기, 동의어 문제로 인해 차기 데이터 분석/롤업 시 심각한 노이즈와 파편화를 유발합니다. 정형화된 데이터 거버넌스를 위해 `tags`는 명시적으로 기각합니다.
- **대안 C: 셀렉트 옵션을 스키마에서 물리적으로 DELETE 처리**:
  - _기각 사유_: DB에 저장된 과거 데이터의 영문 코드값에 대응하는 한글 라벨이 증발하여 과거 데이터가 깨지고 수정 화면에 빈칸 버그가 발생합니다. `disabled: true` 소프트 비활성화가 유일한 무결성 해법입니다.
- **대안 D: 전용 그래프 데이터베이스(Neo4j) 도입**:
  - _기각 사유_: 단 1~2단계 수준의 비즈니스 폼 관계를 위해 별도 인프라 서버를 운영하는 것은 극심한 오버엔지니어링(YAGNI 위반)입니다. PostgreSQL 인덱스 기반 `relations` 테이블 하나로 100% 동일한 성능과 결과를 달성합니다.

---

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **참조 무결성 및 고아 레코드(Orphan Reference) 리스크**:
  - 부모 폼이나 타깃 레코드가 삭제되었을 때 자식 데이터가 붕 뜨는 문제.
  - _대응_: 백엔드 삭제 API에서 `relations` 테이블을 조회하여 참조 중인 자식이 존재하면 삭제를 물리적으로 차단(`REFERENCED_BY_OTHER_FORMS`)하고, AI Navigator가 중재 안내를 수행합니다.
- **콤보박스 대량 레코드 페칭 성능**:
  - 타깃 도메인(프로젝트)의 데이터가 수만 건일 경우 드롭다운에 모두 담을 수 없음.
  - _대응_: 1차적으로 상위 100건을 기본 페칭하고, 검색어 입력 시 서버 사이드 `ILIKE` 부분 검색 쿼리를 트리거하는 디바운스(Debounce) 콤보박스 패턴을 적용합니다.

---

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **M1: 필드 스키마 확장 & DB 인프라 & shadcn 컴포넌트 추가**:
  - `coreFieldTypeSchema` 8종+1종 확장 및 `selectOptionSchema`, `relationConfigSchema` 단위 테스트 (`form-field.schema.test.ts`)
  - `relations.table.ts` PostgreSQL 엣지 테이블 DDL 작성 및 Drizzle 마이그레이션 (`npm run db:push` or `db:generate`)
  - shadcn/ui 공식 컴포넌트 설치 (`radio-group`, `calendar`, `combobox`, `switch`, `separator`)
- **M2: AI Navigator 빌더 자율주행 도구 고도화**:
  - `addRelationField`: 대상 폼 목록 스캔 및 관계형 필드 자동 주입 툴
  - `updateFieldOptions`: 옵션 추가/수정 및 `disabled: true` 소프트 비활성화 툴
  - 8종 신규 필드 자연어 생성 프롬프트 및 도구 갱신
- **M3: 동적 폼 렌더러 필드별 UI 완성 (`DynamicField`)**:
  - `radio`, `checkbox`, `date`, `switch`, `relation` 콤보박스, `section` 렌더링 컨트롤 매핑
  - 수정 폼(`/edit`)의 비활성 옵션 예외 필터링 공식(`!disabled || value === current`) 적용 및 빈칸 버그 회귀 테스트 작성
- **M4: 백엔드 서브미션 엔진 & 관계 동기화 API**:
  - 서브미션 등록/수정/삭제 시 `relations` 테이블 자동 동기화 단위/통합 테스트
  - 역참조 링크 조회 API (`GET /api/v1/relations?targetId=...`) 엔드포인트 구현
- **M5: 컨슈머 상세 뷰 [연결된 내역] 탭 & 종합 검증**:
  - 부모 레코드 상세 화면 하단 [연결된 내역] 서브 테이블 자동 렌더링 검증
  - `npm run verify` 전체 파이프라인(타입체크, 린트, 포맷, 단위/컴포넌트 테스트) 0 결함 통과
