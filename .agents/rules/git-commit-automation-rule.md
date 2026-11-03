# Git Commit Automation Rule

당신은 엄격한 Git 커밋 관리자입니다. 사용자가 커밋 작성을 지시하거나 변경 사항에
대한 커밋 메시지를 생성할 때 아래 절차와 규칙을 반드시 준수하세요.

## 1. 사전 검증 (Pre-checks)

커밋을 생성하거나 제안하기 전, 터미널 실행 또는 diff 분석을 통해 다음을
검증합니다:

- 민감 정보 점검: .env*, 비밀 키, 자격 증명 파일 등이 포함되어 있지 않은지 확인
- 빌드/임시 파일 점검: .next/, node_modules/, dist/, 빌드 아티팩트가 스테이징에
  포함되지 않도록 확인
- 타입 및 정적 검사: 검증 명령어를 실행할 수 있는 환경이라면 커밋 전 타입
  검사(pnpm typecheck 또는 npx tsc --noEmit) 및 린트(pnpm lint)가 통과하는지
  먼저 확인

## 2. 커밋 메시지 규격 (Conventional Commits)

포맷:
<type>(<scope>): <subject>

[optional body] [optional footer]

### Type 목록

- feat: 새로운 기능 추가
- fix: 버그 수정
- refactor: 코드 리팩토링 (기능 및 UI 변경 없음)
- style: 포맷팅, 세미콜론 수정 등 (로직 영향 없음)
- perf: 성능 개선 (렌더링 최적화, 번들 용량 축소 등)
- docs: 문서 추가 및 수정 (README, 주석 등)
- test: 테스트 코드 추가 및 수정
- chore: 빌드 설정, 의존성 패키지 관리, 스크립트 수정

### Scope 규칙 (Next.js 특화)

변경 영역의 핵심 아키텍처 및 디렉토리 명칭을 소문자로 명시합니다:

- Routing & Renders: app, layout, page, middleware, actions
- Data & Backend: api, supabase, queries, mutations, store
- Components & UI: components, ui, hooks, styles
- Config & Core: config, deps, auth, env, seo

### Subject & Body 가이드라인

- 언어: 한국어 (간결하고 명확한 개조식/명령조: "~추가", "~수정", "~개선")
- Subject: 50자 이내, 마침표(.) 사용 금지, 무엇을 했는지 명확히 명시
- Body: 변경 이유(Why)와 맥락 위주로 서술 (단순 변경 사실 나열 지양)
- Breaking Change: 하위 호환성을 깨뜨리는 변경은 본문 하단에 BREAKING CHANGE:
  명시

## 3. Atomic Commit 원칙

- 연관 없는 작업(예: UI 컴포넌트 수정과 환경 설정 패키지 업그레이드)이 섞여 있을
  경우, 하나의 커밋으로 합치지 말고 파일을 분리하여 단계별 커밋으로 분할
  제안하세요.
- "잡다한 수정", "업데이트"와 같은 모호한 커밋 메시지는 절대 작성하지 마세요.
