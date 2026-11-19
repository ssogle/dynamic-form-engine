> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-010] 빌더 데이터 화면 미리보기 모달 (Builder Data Screen Preview Modal)

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-010-builder-form-multi-view-preview`
> - **작성일 (Created)**: 2026-11-19
> - **완료일 (Archived)**: 2026-11-19

## 1. 배경 및 문제 정의 (Context & Problem Statement)

현재 빌더(`/builder/forms/[id]`)에서는 `DynamicFormRenderer`를 통해 입력 양식(폼 캔버스)만 확인할 수 있습니다. 그러나 본 시스템의 폼 스키마는 입력 UI인 동시에 도메인 데이터 모델이므로, 빌더가 설정한 `primaryFieldId`(대표 필드), `relation` 참조 필드, 필드 순서 및 라벨이 컨슈머의 **데이터 목록 테이블**과 **단건 상세 화면**에서 어떻게 표현되는지 빌더 환경 안에서 즉시 검수할 필요가 있습니다.

단, 데이터 목록과 상세 화면을 폼 캔버스와 동등한 메인 탭으로 교체하면 결과 화면을 보며 스키마를 수정하는 어색한 흐름이 발생하므로, **메인 작업 공간은 항상 `폼 캔버스`로 유지하고 상단 `목록 미리보기` / `상세 미리보기` 버튼으로 각각 독립 모달(Dialog)에서 목록 테이블과 응답 상세 카드만 확인**하도록 설계합니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. `/builder/forms/[id]` 상단 헤더에 **`목록 미리보기`** 및 **`상세 미리보기`** 버튼을 각각 배치하고, 클릭 시 `Dialog`(`sm:max-w-5xl`) 내부에서 데이터 목록 테이블 또는 단건 응답 상세 카드를 독립적으로 확인할 수 있는 `BuilderDataPreviewDialog` 위젯을 제공합니다.
  2. 빌더 메인 작업 영역은 항상 `DynamicFormRenderer`(`mode="preview"`)로 고정하여, 설계(캔버스 + AI Navigator)와 결과 검수(모달)의 역할을 명확히 분리합니다.
  3. `ManageFormSubmissions` 및 `SubmissionDetailView`가 `mode === "preview"`일 때 페이지 타이틀·수정/삭제 액션·상/하단 네비게이션·행 클릭 이동을 제거하여, 목록 모달은 테이블 본문만, 상세 모달은 `제출된 응답 내용` 카드만 간결하게 표시합니다.
  4. **100% 스키마 기반 샘플 데이터 미리보기**: 실데이터 조회/표시 분기를 제거하고, 현재 폼의 `activeFields` 타입에 맞춘 결정론적 가상 샘플 레코드(3건)를 생성해 목록과 상세 화면을 항상 일관되게 미리볼 수 있도록 합니다.
  5. 샘플 데이터를 표시할 때는 모달 헤더에 `샘플 데이터 기반` 배지를 노출하고, 가짜 DB 레코드 ID/타임스탬프 카드 및 무의미한 서버 정렬·필터 트리거를 숨겨 실제 운영 데이터와 혼동되지 않도록 구분합니다.

- **Non-Goals**:
  1. 빌더 미리보기 화면에서의 실제 응답 생성(`POST`), 수정(`PATCH`), 삭제(`DELETE`) 실행은 범위에서 제외합니다.
  2. `VirtualTable`의 컬럼 필터링/정렬 상태를 빌더 URL 쿼리스트링과 동기화하지 않습니다.
  3. 역방향 `연결된 내역(relatedGroups)`을 샘플 데이터 기준으로까지 가상 생성하는 기능은 제외합니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/widgets/builder-form-preview/`: `useBuilderFormPreview` 훅과 `BuilderDataPreviewDialog` 위젯으로 구성. 상단에 `목록 미리보기`, `상세 미리보기` 두 버튼을 배치하고 모달 열림 상태(`openView: "list" | "detail" | null`)를 조율하며 `buildPreviewSampleSubmissions`로 생성한 샘플 데이터만 공급합니다. (`@/shared/ui/dialog`, `@/shared/ui/button` 재사용)
  - `src/features/manage-form-submissions/lib/build-preview-samples.ts`: 폼 스키마(`CoreFormField[]`)로부터 9종 필드 타입별 결정론적 샘플 `FormSubmission[]` 레코드를 생성하는 순수 함수 모듈.
  - `src/features/manage-form-submissions/hooks/use-submission-list-table.hook.ts` & `ui/manage-form-submissions.tsx` & `ui/submission-list-table.tsx` & `ui/submission-action-cell.tsx`: `mode = "consumer" | "preview"` 및 `sampleSubmissions` 수용. 프리뷰 모드에서는 페이지 타이틀, 행 클릭, 라우팅 및 삭제 액션을 비활성화하고 테이블 본문만 렌더링하며, 샘플 프리뷰 시 정적 컬럼 헤더(`PrimaryFieldBadge` 유지)를 렌더링합니다.
  - `src/features/manage-form-submissions/hooks/use-submission-detail-view.hook.ts` & `ui/submission-detail-view.tsx` & `ui/related-submission-subtable.tsx`: `mode = "consumer" | "preview"`, `sampleSubmission` 수용. 프리뷰 모드에서는 상·하단 네비게이션, 페이지 타이틀, 메타데이터 카드, 수정/삭제/역참조 카드를 숨기고 `제출된 응답 내용` 상세 카드만 렌더링합니다.
  - `src/app/(workspace)/builder/forms/[id]/page.tsx`: 메인 `DynamicFormRenderer`를 유지하면서 상단 우측 액션 영역에 `BuilderDataPreviewDialog`를 배치합니다.

- **데이터 계약 (Schema & Interfaces)**:
  정적 UI 모드 및 런타임 샘플 생성 로직이므로 별도 DB DDL/API 스키마 변경 없이 TypeScript 인터페이스로 계약을 정의합니다.

  ```typescript
  export type FormSubmissionViewMode = "consumer" | "preview";
  export type BuilderDataPreviewView = "list" | "detail";

  export interface BuilderDataPreviewDialogProps {
    readonly formId: string;
  }
  ```

- **오류 처리 규격**:
  - 프리뷰 모드에서 폼 조회 실패 시 기존 폼 에러 상태를 그대로 표시합니다.
  - 스키마에 활성 필드가 0개인 상태에서도 샘플 생성기는 빈 배열을 반환해 런타임 예외 없이 빈 안내 카드를 렌더링합니다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 메인 영역을 `폼 캔버스 | 데이터 목록 | 상세 화면` 3개 탭으로 동등 배치**
  - 기각 사유: 목록이나 상세 화면 탭에 머문 채 AI Navigator로 폼 스키마를 수정하면 설계 화면(폼 캔버스)이 가려져 편집 대상 혼선과 어색한 UX가 발생합니다. 모달로 분리하면 편집은 캔버스, 결과 검수는 모달로 역할이 명확히 나뉩니다.
- **대안 B: 실제 DB 응답 데이터만 미리보기 (샘플 생성 배제)**
  - 기각 사유: 신규 폼 설계 단계에서는 제출 데이터가 0건이므로, 가장 중요한 스키마 설계 직후 시점에 목록/상세 레이아웃과 `primaryFieldId` 효과를 확인할 수 없습니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: 프리뷰 모드에서는 제출 응답 목록·단건·관계 배치 조회 쿼리를 모두 비활성화하고 폼 스키마로부터 동기적으로 샘플 레코드를 생성하므로 추가 네트워크 지연 없이 즉시 렌더링됩니다.
- **엣지 케이스**:
  1. 모달을 닫고 `폼 캔버스`에서 AI로 필드를 추가·수정하거나 `primaryFieldId`를 변경한 뒤 다시 모달을 열면, `form` 캐시 갱신과 함께 목록 컬럼 및 샘플 데이터가 최신 스키마 기준으로 재계산됩니다.
  2. `relation` 필드의 경우 샘플 모드에서는 네트워크 배치 조회(`useRelationLookup`)를 생략하고 읽기 전용 샘플 표기(`샘플 참조 레코드 1` 등)만 표시합니다.
  3. 활성 필드가 없는 상태에서 `상세 미리보기`를 누르면 안내 카드를 표시합니다.
- **미해결 의문**:
  - 없음

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `build-preview-samples.ts` 순수 샘플 생성 로직 및 단위 테스트 작성 (TDD)
  2. `useSubmissionListTable` / `useSubmissionDetailView` 프리뷰 모드 격리 및 훅 단위 테스트 확장
  3. `ManageFormSubmissions`, `SubmissionDetailView` 프리뷰 UI 분기 반영
  4. `src/widgets/builder-form-preview/` 모달 위젯(`BuilderDataPreviewDialog`) 구현 및 `/builder/forms/[id]` 상단 연결
  5. `npm run verify` 전체 검증 완주
- **검증 기준**:
  - `npm test`: `build-preview-samples.test.ts`, `use-submission-list-table.hook.test.ts`, `use-submission-detail-view.hook.test.ts`, `use-builder-form-preview.hook.test.ts` 통과
  - `npm run verify`: 타입체크, ESLint(`boundaries`, `check-file` 포함), 포맷 체크, 전체 테스트 결함 0건 통과
