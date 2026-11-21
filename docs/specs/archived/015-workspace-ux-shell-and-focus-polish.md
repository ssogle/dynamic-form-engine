> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-015] 워크스페이스 전역 UX·쉘 통일 및 3D·블록 포커스 개선

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-015-workspace-ux-shell-and-focus-polish`
> - **작성일 (Created)**: 2026-11-21
> - **완료일 (Archived)**: 2026-11-21

## 1. 배경 및 문제 정의 (Context & Problem Statement)

1차 기능 구현 및 2차 포트폴리오 QA 결과, 개별 도메인 기능은 정상 동작하지만 서비스 전반의 쉘·내비게이션·시각적 피드백 일관성이 떨어지는 지점이 확인되었다.

1. **전역 헤더 및 테마 설정 공백**: `WorkspaceAppBar`가 `(workspace)` 하위에만 있어 홈 랜딩(`/`)에서 접근할 수 없고, 헤더 설정 팝오버는 임시 안내 문구만 표시 중이다(`next-themes` 및 `globals.css` `.dark` 토큰은 이미 구비되어 있으나 미연결).
2. **상단 복귀 버튼 파편화**: `/builder/forms/[id]`, `/consumer/forms/[id]`, `/new`, 상세, `/edit`, `/consumer/views/[id]`, `/analyst/views/[id]`마다 뒤로가기 버튼 위치(좌/우), 스타일(`outline`/`ghost`), 아이콘(`ArrowLeft` / `←` / `&larr;` / 없음), 문구, 레거시 `/submissions` 경로가 모두 불일치한다.
3. **AI Navigator 시선 집중 약화**: 좌측 고정 패널이 일반 사이드바처럼 묻히고, `Cmd/Ctrl+K` 단축키나 본문 → 채팅 포커스 트리거가 없다.
4. **Builder 3D 그래프 조작성 저하**: 노드 Hover 시 `getNodeColor` 참조 변경으로 엔진이 재가동되어 `handleEngineStop`의 `zoomToFit`이 매번 카메라 시점을 초기화하고, 기본 force 설정(`charge: -60`, `link: 30`) 때문에 노드·라벨·화살표 간격이 좁다.
5. **Analyst 블록 변경 포커스 부재**: 빌더 미리보기(`DynamicFormRenderer`)와 달리 `AnalysisViewRenderer`에는 블록 추가·수정 시 자동 스크롤 및 하이라이트 효과가 없고, 빈 상태 문구에 좌/우 방향이 하드코딩되어 있다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  - 홈 랜딩(`/`)과 `(workspace)` 전체에서 동일한 `WorkspaceAppBar` 및 `라이트 / 다크 / 시스템` 테마 전환 제공 (+ 다크 모드 하드코딩 색상 점검)
  - `@/shared/ui/back-link` 공통 컴포넌트 도입으로 전 서브 페이지 상단 복귀/목록 버튼 위치·스타일·문구 규격 통일(상세 페이지 하단 중복 복귀 버튼 제거 포함)
  - AI Navigator 패널 좌/우 도킹 전환(기본 `"right"` 코파일럿 배치 + `localStorage` 유지), 입력창 시각적 포인트 + `Cmd/Ctrl+K` 단축키 + 본문 포커스 트리거 브릿지 구현
  - Builder 3D 관계 그래프의 Hover/드래그 시 카메라 시점 유지(`hasInitialFitRef`, `getNodeColor` 안정화) 및 노드·링크 간격 확대
  - Analyst `AnalysisViewRenderer` 편집 모드(`!publishedOnly`)에서 블록 변경 시 자동 스크롤·2.4초 하이라이트 적용 및 방향 고정 안내 문구 중립화
- **Non-Goals**:
  - Consumer 테이블 통합(`RelationFieldInput`, 정방향 `relation` 테이블), 정렬 칩, 필터 콤마/AI-UI 정규화, Analyst `computeSeriesMetric` 정렬 엔진 수정 (후속 **Spec 016** 범위로 분리)
  - AI Navigator 추천 프롬프트 칩 추가 (도메인 범용성 저하 우려로 의도적 배제)
  - DB 스키마 및 AI 에이전트 백엔드 도구/프롬프트 변경

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/app/_components/workspace-app-bar.tsx`: `(workspace)/_components/workspace-app-bar.tsx` 승격 이동, 홈(`/`) 활성 상태 지원 및 설정 `Popover` 내 화면 테마(`라이트 / 다크 / 시스템`)와 AI 채팅 패널 위치(`왼쪽 / 오른쪽`) 통합 설정 구현
  - `src/app/providers.tsx` & `src/app/layout.tsx`: `next-themes` `ThemeProvider` 연결 및 `<html>` `suppressHydrationWarning` 추가
  - `src/app/page.tsx` & `src/app/(workspace)/layout.tsx`: 공통 `WorkspaceAppBar` 마운트
  - `src/shared/ui/back-link.tsx`: 도메인 무관 공용 상단 복귀 링크 프리미티브(`variant="ghost" size="sm"`, `ArrowLeft className="size-3.5"`, `text-muted-foreground hover:text-foreground gap-1.5 text-xs`)
  - `src/shared/lib/navigator-focus/`: FSD 하향 의존을 지키면서 `features/*` / `app/*`에서 `widgets/navigator-shell` 입력창 포커스를 요청하는 커스텀 이벤트 헬퍼 및 `useSyncExternalStore` 호환 도킹 방향 저장·구독 유틸리티
  - `src/app/(workspace)/_components/workspace-split-shell.tsx` & `src/widgets/navigator-shell/ui/navigator-shell.tsx`: `dockSide`(`"left" | "right"`, 기본 `"right"`) 상태 관리, 도킹 전환 버튼, `Cmd/Ctrl+K` 단축키 및 입력창 포커스 스타일 강화
  - `src/features/manage-builder-forms/ui/builder-relation-graph.tsx`: `hasInitialFitRef`, `hoveredNodeIdRef` 기반 `getNodeColor` 안정화, `handleGraphRef` 콜백 ref를 통한 최초 마운트 `refresh()`/`DragControls` 재바인딩 및 `d3Force` 간격 튜닝
  - `src/features/render-analysis-view/lib/detect-changed-block.ts` & `src/features/render-analysis-view/ui/analysis-view-renderer.tsx`: 순수 변경 블록 판별 헬퍼 + `prevBlockSnapshotsRef` 기반 변경 블록 스크롤 및 2.4초 하이라이트 + 방향 중립 카피 정리
- **데이터 계약 (Interfaces)**:
  ```typescript
  // src/shared/ui/back-link.tsx
  export interface BackLinkProps {
    readonly href: string;
    readonly label: string;
    readonly className?: string | undefined;
  }

  // src/shared/lib/navigator-focus.ts
  export type NavigatorDockSide = "left" | "right";
  export interface FocusNavigatorPayload {
    readonly prefillText?: string | undefined;
    readonly replace?: boolean | undefined;
  }
  export function dispatchFocusNavigator(payload?: FocusNavigatorPayload): void;
  ```
- **오류 처리 및 안전 가드 규격**:
  - `ThemeProvider` 및 `localStorage` 기반 `dockSide` 복원은 마운트 후 `useEffect`에서 읽어 SSR/CSR Hydration Mismatch를 방지한다.
  - `BuilderRelationGraph`의 `d3Force` 호출은 메서드 존재 여부를 optional chaining으로 가드해 테스트/언마운트 타이밍 런타임 예외를 방지한다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: Spec 015 + 016 전체(12건)를 단일 대형 스펙으로 동시 진행**
  - 기각 사유: UI/쉘 개편과 SQL 필터·FSD 조립·AI 도구 수정이 한 PR에 섞여 회귀 원인 분리 및 검증 비용이 과도하게 커진다.
- **대안 B: 본문 → 채팅 포커스 트리거를 React Context로 `app/(workspace)`에 구축**
  - 기각 사유: `features/*`에서 `app/*` Context를 import할 수 없어 FSD 레이어 경계에 위배된다. `@/shared/lib` 경량 이벤트 헬퍼를 쓰면 단방향 의존 규칙을 유지할 수 있다.
- **대안 C: `BuilderRelationGraph` Hover 하이라이트 시 `Three.js` Mesh 재질 직접 조작**
  - 기각 사유: `three-forcegraph` 내부 상태 동기화 복잡도가 올라간다. `hoveredNodeIdRef`로 `getNodeColor` 함수 참조를 고정하고 `hasInitialFitRef`로 최초 1회만 `zoomToFit`을 실행하는 편이 단순하고 안정적이다(KISS).

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: `d3ReheatSimulation()`은 `graphData` 변경/마운트 시점에만 1회 실행하므로 Hover 시 프레임 저하가 없다.
- **엣지 케이스**:
  - 다크 모드 전환 시 기존 컴포넌트(`submission-list-table`, `dynamic-field`, `3D 그래프 범례` 등)에 하드코딩된 밝은 배경/텍스트 클래스가 남아 있을 수 있으므로 전체 화면 다크 모드 육안 검수가 필요하다.
  - `AnalysisViewRenderer`에서 `viewId` 전환 시 `hasInitializedBlocksRef`를 리셋하지 않으면 이전 문서와 비교해 오작동할 수 있으므로 `view?.id` 변경 시 초기화 가드를 둔다.
- **확정된 설계 결정**:
  1. AI Navigator 패널 최초 기본 도킹 방향은 `"right"`(오른쪽 코파일럿 배치)로 설정하며, 사용자가 토글 시 `"left"`와 자유 전환 후 `localStorage`에 유지한다.
  2. `SubmissionDetailView` 하단 우측 중복 `"데이터 목록으로"` 버튼은 제거하여 모든 서브 페이지가 상단 좌측 `BackLink` 단일 규격을 따르도록 통일한다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. 공통 프리미티브(`BackLink`, `navigator-focus.ts`) 및 `ThemeProvider` / `WorkspaceAppBar` / 랜딩(`/`) 통합
  2. AI Navigator 좌/우 도킹 전환, `Cmd/Ctrl+K`, 본문 포커스 트리거 및 서브 페이지 `BackLink` 일괄 적용
  3. `BuilderRelationGraph` 카메라 시점 유지/간격 튜닝 및 `AnalysisViewRenderer` 블록 포커스·하이라이트 구현
  4. 다크/라이트 모드 전 화면 점검 및 단위/컴포넌트 테스트 보강
- **검증 기준**:
  - `npm test`: `navigator-focus`, `BuilderRelationGraph` / `AnalysisViewRenderer` / `WorkspaceSplitShell` 주요 로직·동작 단위 테스트 통과
  - `npm run verify`: TypeScript, ESLint(FSD 경계 포함), Prettier, 전체 Vitest 스위트 결함 0건 통과
