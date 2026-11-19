> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-014] 도메인 관계 3D 그래프 시각화 (3D Relation Graph Visualization)

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-014-relation-graph-visualization`
> - **작성일 (Created)**: 2026-11-19
> - **완료일 (Archived)**: 2026-11-19

## 1. 배경 및 문제 정의 (Context & Problem Statement)

1. **빌더 폼 목록의 관계 가시성 부족**: 현재 `/builder/forms`는 평면 카드 그리드(`BuilderFormList`)만 노출되어, 여러 폼이 `relation` 필드로 어떻게 연결되어 있는지(상위 마스터 폼, 하위 파생 폼, 고립 폼) 한눈에 파악하기 어렵습니다.
2. **랜딩 페이지(/) 정체성 표현 부족**: 현재 `/` 게이트웨이(`src/app/page.tsx`)는 정적 배경(`bg-zinc-50/50`) 위에 3열 역할 카드만 배치되어 있어, 본 프로젝트의 핵심 정체성인 "관계형 도메인 온톨로지 데이터 엔진"의 입체적 연결감을 첫 화면에서 직관적으로 전달하지 못합니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. **`react-force-graph-3d` SSR 안전 공용 래퍼 구축**: 3D 단독 패키지 `react-force-graph-3d`(`v1.29.2`, `peerDependencies: { react: '*' }`)를 `next/dynamic(..., { ssr: false })`와 `ResizeObserver`로 감싼 3D WebGL 공용 컴포넌트를 `@/shared/ui`에 추가합니다.
  2. **순수 스키마 그래프 변환 유틸리티(`buildFormRelationGraph`) 구현**: 추가 API/DB 호출 없이 `useFormsQuery()`가 조회한 `Form[]`에서 노드(폼 ID·제목·발행 여부·활성 필드 수·연결 차수)와 방향성 링크(소스 폼 -> 타깃 폼, 필드 라벨·다중 여부·곡률)를 생성합니다.
  3. **빌더 폼 목록(`/builder/forms`) 3D 스플릿 뷰 구현**: 기존 카드 그리드(`BuilderFormList`)와 3D 관계 그래프를 함께 탐색하는 스플릿 뷰(`스플릿` / `목록` / `그래프` 보기 전환 지원)를 구성하고, 3D 회전·줌·패닝, 발행/초안 상태 색상 구분, 방향성 파티클(`linkDirectionalParticles`), 노드 클릭 시 해당 폼 캔버스(`/builder/forms/[id]`) 이동을 지원합니다.
  4. **랜딩 페이지(`/`) 자동 회전(Auto-Orbit) 3D 온톨로지 배경 적용**: DB 연결 없이도 즉시 렌더링되는 경량 도메인 온톨로지 샘플 그래프를 저대비·반투명 자동 회전 3D 배경(`pointer-events-none`)으로 배치해 카드 UI 가독성을 해치지 않으면서 시각적 정체성을 강화합니다.
- **Non-Goals**:
  1. VR/AR 통합 패키지(`react-force-graph` 및 `aframe`) 도입 -> 불필요한 번들 비대화를 막기 위해 3D 단독 패키지(`react-force-graph-3d`)만 사용합니다.
  2. 그래프 캔버스 상에서 마우스 조작으로 `relation` 스키마 직접 생성·삭제 -> 스키마 변경은 기존 `builder-tools` 및 `Builder` 단일 진실 원천을 유지합니다.
  3. 개별 응답(`form_submissions`) 레코드 단위 `relations` 그래프 -> 본 스펙에서는 **폼 스키마 온톨로지**와 **랜딩 3D 배경**에 집중합니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **외부 패키지**:
  - `npm install react-force-graph-3d` (`1.29.2`, `peerDependencies: { react: '*' }`)
- **아키텍처 및 FSD 계층 배치**:
  - `src/shared/ui/force-graph-3d-canvas.tsx` (신규): `next/dynamic(..., { ssr: false })` 기반 `ForceGraph3D` 래퍼, `ResizeObserver` 반응형 컨테이너, WebGL 컨텍스트 가용성 사전 판별 폴백
  - `src/entities/form/lib/build-form-relation-graph.ts` (신규) & `.test.ts`: `Form[]` -> `{ nodes, links }` 순수 그래프 빌더
  - `src/features/manage-builder-forms/ui/`:
    - `builder-relation-graph.tsx` (신규): 빌더 폼 목록용 3D 관계 그래프 패널 (발행/초안 범례, 3D 노드/엣지·방향 파티클, 호버 하이라이트, 노드 클릭 시 `/builder/forms/[id]` 이동, 줌/리셋 제어)
    - `builder-forms-workspace.tsx` (신규): `BuilderFormList` + `BuilderRelationGraph` 스플릿 뷰 및 뷰 모드 전환(`split` | `list` | `graph`) 제공
  - `src/app/(workspace)/builder/forms/page.tsx`: `BuilderFormList` 대신 `BuilderFormsWorkspace` 조립
  - `src/app/_components/landing-ontology-background.tsx` (신규) & `src/app/page.tsx`: 정적 도메인 온톨로지 샘플 기반 저대비 자동 회전 3D 네트워크 배경 배치 (`pointer-events-none`, 메인 콘텐츠 `relative z-10`)
- **데이터 계약 (Schema & Interfaces)**:
  ```typescript
  export interface FormRelationGraphNode {
    id: string;
    title: string;
    isPublished: boolean;
    activeFieldCount: number;
    relationDegree: number;
  }

  export interface FormRelationGraphLink {
    id: string;
    source: string;
    target: string;
    fieldId: string;
    label: string;
    multiple: boolean;
    curvature: number;
  }

  export interface FormRelationGraphData {
    nodes: FormRelationGraphNode[];
    links: FormRelationGraphLink[];
  }
  ```
- **오류 처리 및 안전장치**:
  - 소프트 삭제된 필드(`field.deletedAt`) 및 존재하지 않거나 삭제된 타깃 폼(`!formMap.has(targetFormId)`)을 가리키는 고아 엣지는 그래프 생성 단계에서 자동 제외합니다.
  - 동일 두 폼 사이에 복수의 `relation` 필드가 존재할 경우 `curvature` 값을 분산해 3D 링크가 겹치지 않도록 처리합니다.
  - WebGL 컨텍스트를 생성할 수 없는 브라우저/환경에서는 예외 없이 안전한 안내 또는 투명 배경 폴백으로 처리합니다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 2D 평면 그래프 (`react-force-graph-2d`)**
  - 기각 사유: 2D 줌·패닝만으로는 다수 도메인 간 입체적 탐색 경험이 제한적이므로, 마우스로 360도 회전 탐색이 가능한 `react-force-graph-3d`를 채택했습니다.
- **대안 B: 별도 그래프 조회 API(`GET /api/v1/forms/graph`) 추가**
  - 기각 사유: `useFormsQuery()`가 이미 모든 활성 폼의 `schemaDefinition`을 가져오므로 추가 API 없이 클라이언트 순수 함수로 변환하는 편이 빠르고 캐시 일관성도 높습니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **SSR 및 WebGL 가용성**: `next/dynamic(..., { ssr: false })`로 서버 번들 실행(`window is not defined`)을 차단하고, WebGL 컨텍스트 체크로 미지원 환경 크래시를 방어합니다.
- **테스트 환경(`jsdom`)**: WebGL 렌더링 자체는 테스트하지 않고, 순수 변환 함수(`buildFormRelationGraph`) 단위 테스트에 집중합니다.
- **레이아웃 공간**: `/builder/forms`는 좌측 `NavigatorShell`을 제외한 우측 메인 패널 폭 안에서 동작하므로, 넓은 화면 스플릿 뷰와 함께 `목록만` / `그래프만` 전환 버튼을 제공해 답답하지 않게 구성합니다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `react-force-graph-3d` 설치 및 `@/shared/ui/force-graph-3d-canvas.tsx` SSR-safe·WebGL-safe 래퍼 구현
  2. `buildFormRelationGraph` 순수 변환 유틸리티 및 단위 테스트 작성 (`entities/form`)
  3. `/builder/forms` 3D 스플릿 뷰(`BuilderRelationGraph`, `BuilderFormsWorkspace`) 구현 및 페이지 연결
  4. 랜딩 페이지(`/`) 자동 회전 3D 온톨로지 네트워크 배경 구현 및 연결
  5. `npm run fix && npm run verify` 및 `npm run build` 검증
- **검증 기준**:
  - `npm test`: `buildFormRelationGraph` 단위 테스트(노드·방향 엣지 변환, 삭제 필드·미존재 타깃 필터링, 복수 관계 곡률, 자기 참조) 통과
  - `npm run verify`: 타입체크, ESLint, Prettier, 전체 테스트 결함 0건 통과
