<!-- 아카이브(동결) 전환 시 아래 WARNING 주석을 해제하고 상단 NOTE 블록을 대체하세요 -->
<!--
> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.
-->

# [Spec-009] Workspace Global App Switcher & Top-Level Layout Hierarchy

> [!NOTE]
>
> - **상태 (Status)**: Active (기획/구현 중)
> - **브랜치 (Branch)**: `feat/spec-009-workspace-app-switcher-layout`
> - **작성일 (Created)**: 2026-11-18
> - **완료일 (Archived)**: -

## 1. 배경 및 문제 정의 (Context & Problem Statement)

현재 시스템은 사용자 역할에 따라 **빌더(`/builder`)**, **컨슈머(`/consumer`)**, **분석가(`/analyst`)** 세 가지 독립 작업 공간으로 구성되어 있으며, 각 작업 공간은 좌측의 상주형 `NavigatorShell`과 우측의 메인 작업 영역으로 분할되어 있습니다. 그러나 현재 레이아웃 구조에는 다음과 같은 정보 구조(IA) 및 유지보수 문제가 존재합니다.

1. **시각적 위계 역전**: 타 앱으로 전환하는 링크(`빌더로 이동`, `컨슈머로 이동`, `분석가로 이동`, `처음 화면으로`)가 우측 메인 영역 내부의 `<header>` 우측 끝에 배치되어 있습니다. 실제로는 앱 전환 시 좌측 `NavigatorShell`의 AI 모드(`builder` | `consumer` | `analyst`)까지 함께 전환되므로 앱 전환 제어부는 좌측 AI 패널과 우측 작업 영역 모두의 상위 계층에 위치해야 합니다.
2. **레이아웃 코드 중복 및 드리프트**: `src/app/builder/layout.tsx`, `src/app/consumer/layout.tsx`, `src/app/analyst/layout.tsx`가 동일한 분할 쉘과 타 앱 이동 링크를 개별 복제하고 있어 일관성이 깨지고 있습니다.
   - `src/app/consumer/layout.tsx`에는 `처음 화면으로` 링크가 누락되어 있습니다.
   - 컨슈머 이동 경로가 `builder/layout.tsx`에서는 `/consumer`로, `analyst/layout.tsx`에서는 `/consumer/views`로 서로 다르게 연결되어 있습니다.
3. **앱 정체성 부족**: 세 작업 공간의 헤더와 AI 패널 시각 구획이 유사하여, 사용자가 완전히 다른 목적의 앱으로 진입한다는 전환 체감이 약합니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. Next.js App Router Route Group `(workspace)`를 도입하여 `/builder/*`, `/consumer/*`, `/analyst/*` 전체를 감싸는 최상위 글로벌 앱 바(`WorkspaceAppBar`)를 신설합니다. (루트 게이트웨이 `/`는 기존 3열 카드 화면을 그대로 유지합니다.)
  2. 글로벌 앱 바 좌측에 홈(`/`) 복귀 링크와 **빌더(`/builder/forms`)**, **컨슈머(`/consumer/forms`)**, **분석가(`/analyst/views`)** 3개 앱 전환 버튼을 배치해 각 항목 사이를 수직 구분선(`Separator`)으로 분리하고 진입 경로를 통일하며, 우측 끝에는 향후 확장을 위한 설정 버튼 및 임시 안내 `Popover`를 배치합니다.
  3. 각 앱 내부 우측 `<header>`에 있던 타 앱 이동 링크 및 `처음 화면으로` 링크를 모두 제거하여, 내부 헤더가 해당 앱 전용 서브 네비게이션 탭만 담당하도록 책임을 분리합니다.
  4. 최상위 글로벌 바(`h-12`, `shrink-0`)와 하단 작업 공간(`min-h-0 flex-1`)의 높이를 정렬하고, 각 앱 레이아웃의 `h-screen`을 `h-full`로 전환하여 뷰포트 오버플로우 및 이중 스크롤을 방지합니다.
  5. `NavigatorShell` 헤더에 앱별 정체성(타이틀/역할 구분)을 명확히 표현하여 앱 전환 체감을 강화합니다.

- **Non-Goals**:
  1. 앱 전환 시 AI Navigator 대화 내역을 앱별로 분리 보존하는 기능은 이번 범위에서 제외합니다. (현행 `useNavigatorChatStore.setMode`의 전환 시 대화 초기화 동작을 유지합니다.)
  2. 글로벌 앱 바 우측 설정 버튼은 향후 확장을 위한 임시 `Popover` 쉘만 제공하며, 세부 설정 항목 구현 및 알림 뱃지·검색창·사용자 인증/프로필 메뉴 등 부가 기능은 이번 범위에서 제외합니다.
  3. URL 구조(`/builder/*`, `/consumer/*`, `/analyst/*`) 자체의 변경은 수행하지 않습니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/app/(workspace)/layout.tsx`: `builder`, `consumer`, `analyst` 라우트를 묶는 공통 작업 공간 레이아웃. 최상단에 `WorkspaceAppBar`를 렌더링하고 하단 `min-h-0 flex-1` 영역에 각 앱의 `children`을 배치합니다.
  - `src/app/(workspace)/_components/workspace-app-bar.tsx`: Client Component(`"use client"`). `usePathname()`으로 현재 활성 앱을 판별하고, `@/shared/ui/button`, `@/shared/ui/separator`, `@/shared/ui/popover`, `@/shared/lib/cn`, `lucide-react`를 조합해 최상위 앱 전환 바(좌측 홈·앱별 구분선 포함 스위처, 우측 설정 임시 `Popover`)를 렌더링합니다.
    - 도메인 엔티티나 피처 상태에 의존하지 않는 순수 라우팅 크롬(Chrome)이므로 `src/widgets/` 껍데기 위젯을 생성하지 않고 `src/app/(workspace)/_components/`에 배치합니다. (FSD `boundaries/dependencies` 규칙상 `app -> app` 및 `app -> shared` 참조 허용)
  - `src/app/(workspace)/builder/layout.tsx`, `src/app/(workspace)/consumer/layout.tsx`, `src/app/(workspace)/analyst/layout.tsx`: 기존 `h-screen`을 `h-full`로 변경하고, 우측 `<header>`의 타 앱 이동 링크를 제거해 앱 내부 네비게이션 탭만 유지합니다.
  - `src/widgets/navigator-shell/lib/navigator-shell-config.ts` & `src/widgets/navigator-shell/ui/navigator-shell.tsx`: 앱별 Navigator 헤더 명칭/부제를 명확히 구분해 각 앱에 특화된 AI 어시스턴트임을 표현합니다.

- **데이터 계약 (Schema & Interfaces)**:
  정적 UI 라우팅 메타데이터이므로 별도의 런타임 Zod 검증 스키마는 도입하지 않으며, 컴파일 타임 정적 상수 및 타입으로 정의합니다.

  ```typescript
  // src/app/(workspace)/_components/workspace-app-bar.tsx
  export type WorkspaceAppId = "builder" | "consumer" | "analyst";

  export interface WorkspaceAppItem {
    readonly id: WorkspaceAppId;
    readonly label: string;
    readonly englishLabel: string;
    readonly href: string;
    readonly matchPrefix: string;
    readonly icon: LucideIcon;
  }

  // 확정된 진입 경로 (Single Source of Truth)
  // - builder: /builder/forms
  // - consumer: /consumer/forms
  // - analyst: /analyst/views
  ```

  `NavigatorShellConfig` (`src/widgets/navigator-shell/lib/navigator-shell-config.ts`):

  ```typescript
  export interface NavigatorShellConfig {
    title: string; // "Builder AI Navigator" | "Consumer AI Navigator" | "Analyst AI Navigator"
    badgeLabel: string; // "Builder" | "Consumer" | "Analyst"
    inputPlaceholder: string;
  }
  ```

- **오류 처리 규격**:
  - 본 작업은 정적 레이아웃 및 Next.js `<Link>` 기반 클라이언트 라우팅 재구성으로, 별도 백엔드 API 호출이나 비동기 Result 패턴(`{ data, error }`) 오류 분기는 발생하지 않습니다.
  - `pathname`이 예상 접두사와 매칭되지 않는 예외적 경우에도 활성 앱 하이라이트만 생략될 뿐 링크 네비게이션은 정상 동작하도록 방어적으로 처리합니다.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 루트 `src/app/layout.tsx`에 글로벌 앱 바 직접 배치**
  - 기각 사유: 루트 레이아웃은 `/` 홈 게이트웨이까지 포함하므로 `/`에서 상단 바를 숨기려면 루트 레벨에서 `usePathname()` 조건부 분기를 수행해야 합니다. `(workspace)` Route Group을 사용하면 URL을 전혀 바꾸지 않고도 `/`와 작업 공간 레이아웃을 선언적으로 분리할 수 있습니다.
- **대안 B: 글로벌 앱 바를 `src/widgets/workspace-app-bar/`로 배치**
  - 기각 사유: FSD 아키텍처 규칙상 `widgets`는 2개 이상의 독립된 `features`와 `entities`를 결합할 때만 생성해야 하며, 순수 UI/라우팅만 담당하는 껍데기 위젯은 금지됩니다. 향후 AI 작업 상태나 초안 알림 등 피처 상태를 결합할 필요가 생길 때 `widgets`로 승격하는 것이 FSD 진화 라이프사이클에 부합합니다.
- **대안 C: 앱 전환 시 `useNavigatorChatStore` 대화 내역을 앱별로 유지**
  - 기각 사유: 사용자 요구사항에 따라 앱 전환 시 기존 대화 초기화 정책을 유지하기로 결정하였으며, 불필요한 스토어 구조 변경을 배제합니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**:
  - `(workspace)/layout.tsx`가 3개 앱의 공통 상위 레이아웃으로 유지되므로, 앱 전환 시 상단 앱 바가 언마운트/재마운트되지 않아 렌더링 비용이 감소합니다.
- **엣지 케이스**:
  1. **뷰포트 높이 계산(`h-screen` vs `h-full`)**: `(workspace)/layout.tsx`가 `h-screen flex-col overflow-hidden`을 사용하고 상단 바가 `shrink-0` 높이를 차지하므로, 하단 래퍼에 `min-h-0 flex-1`을 지정하지 않으면 내부 `overflow-y-auto` 스크롤이 깨질 수 있습니다. 반드시 `min-h-0 flex-1`과 하위 `h-full` 조합을 적용해야 합니다.
  2. **AI 생성 중 앱 전환**: 사용자가 AI 응답 스트리밍 도중 상단 바에서 다른 앱을 클릭해 이동할 경우, 기존 `NavigatorShell` 언마운트 및 `useNavigatorChatStore.setMode(nextMode)` 호출에 의해 `isGenerating`과 `progressMessage`가 초기화됩니다.
  3. **ESLint `check-file` 및 `boundaries` 준수**: `src/app/(workspace)/_components/` 내부 파일명은 반드시 `kebab-case`를 준수해야 하며, `src/app` 레이어 규칙을 검증해야 합니다.
- **미해결 의문**:
  - 없음 (홈 `/` 분리, 대화 초기화 유지, `/consumer/forms` 경로 통일 모두 확정 완료).

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `(workspace)` Route Group 구성 및 `src/app/(workspace)/_components/workspace-app-bar.tsx`, `src/app/(workspace)/layout.tsx` 생성
  2. 기존 `builder`, `consumer`, `analyst` 디렉터리를 `src/app/(workspace)/` 하위로 이동하고, 각 `layout.tsx`의 높이(`h-full`) 및 우측 헤더(타 앱 이동 링크 제거) 정비
  3. `src/widgets/navigator-shell/lib/navigator-shell-config.ts` 및 `src/widgets/navigator-shell/ui/navigator-shell.tsx`에 앱별 Navigator 헤더 구분 반영
  4. 정적 분석, 빌드 및 브라우저 런타임 인터랙션 검증

- **검증 기준**:
  - `npm run verify`: TypeScript 타입체크, ESLint(`boundaries` 및 `check-file` 포함), Prettier 포맷 체크, 기존 전체 단위 테스트(`use-navigator-shell.hook.test.ts`, `navigator-chat.store.test.ts` 포함) 결함 0건 통과
  - `npm run build`: Next.js App Router Route Group 이동 후 프로덕션 빌드 및 라우트 매핑(`/`, `/builder/forms`, `/consumer/forms`, `/analyst/views` 등) 이상 없음 확인
  - 브라우저 수동 검증:
    - `/` 접속 시 기존 3열 게이트웨이 화면 유지 확인
    - `/builder/forms`, `/consumer/forms`, `/analyst/views` 진입 및 상단 바 전환 시 활성 상태 하이라이트, 이중 스크롤 없음, AI Navigator 모드 전환 및 대화 초기화 확인
