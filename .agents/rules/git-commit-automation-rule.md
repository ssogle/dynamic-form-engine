# Git Workflow & Commit Automation Rule

본 문서는 동적 폼 엔진 프로젝트에서 준수하는 Git 워크플로우(GitHub Flow), 브랜치 생명주기 관리, 커밋 메시지 규격 및 Pull Request(PR) 거버넌스 규칙입니다.

---

## 1. GitHub Flow & 브랜치 거버넌스

본 프로젝트는 경량화되고 신속한 피드백을 제공하는 **GitHub Flow** 모델을 채택합니다.

### 1) master 브랜치 절대 보호 (Single Source of Production)

- `master` 브랜치는 항상 테스트와 정적 분석을 통과한 즉시 배포 가능한 상태를 유지합니다.
- **`master` 브랜치로의 직접적인 `git push`는 엄격히 금지**됩니다.
- 모든 변경 사항은 반드시 GitHub의 **Pull Request(PR)**를 통해서만 `master`로 머지될 수 있습니다.

### 2) 단명 작업 브랜치 전략 (Short-lived Branches)

- 모든 작업은 항상 최신 `master` 브랜치에서 새로운 작업 브랜치를 분기하여 시작합니다.
- 브랜치 네이밍 컨벤션:
  - 신규 기능 (SDD 기반): `feat/spec-{seq}-{feature-name}` (예: `feat/spec-001-form-builder`)
  - 버그 수정: `fix/{kebab-issue-description}` (예: `fix/schema-validation-error`)
  - 리팩터링: `refactor/{kebab-target}` (예: `refactor/form-renderer-context`)
  - 문서/환경설정: `docs/{kebab-target}`, `chore/{kebab-target}`

### 3) 머지 완료 후 브랜치 즉시 삭제 원칙 (Delete Branch on Merge)

- PR이 검토 및 승인되어 `master`에 머지(Squash and merge 또는 Rebase and merge 권장)된 직후, **해당 작업 브랜치는 즉시 삭제**되어야 합니다.
- GitHub 원격 저장소의 `Automatically delete head branches` 옵션을 통해 머지 시 원격 브랜치가 자동 삭제되도록 유지합니다.
- 머지 완료 후 로컬 환경에서도 추적 브랜치와 로컬 브랜치를 정리합니다:
  ```bash
  git checkout master
  git pull origin master
  git fetch --prune
  git branch -d [삭제할-로컬-작업브랜치명]
  ```

---

## 2. Pull Request (PR) 거버넌스

1. **공식 PR 템플릿 참조 및 단일 진실 원천 (Single Source of Truth)**:
   - PR 본문 서식의 단일 진실 원천은 [`.github/pull_request_template.md`](file:///Users/sobyeongcheon/Desktop/projects/dynamic-form-engine/.github/pull_request_template.md) 파일입니다.
   - 서식 중복과 파편화를 방지하기 위해 본 규칙 문서나 다른 문서에 PR 양식 전문을 중복 기재하지 않습니다.
   - 에이전트가 PR 본문 작성을 요청받을 때는 **반드시 `.github/pull_request_template.md`를 직접 읽고**, 해당 파일에 정의된 모든 섹션(스펙 연관, 목적, 변경 내역, 체크리스트 등)의 서식을 100% 준수하여 작성해야 합니다.
2. **사전 검증 필수 통과**:
   - PR을 생성하거나 머지 요청을 하기 전에 반드시 로컬에서 공식 검증 스크립트를 완주하고 결함 0건을 확인해야 합니다:
     ```bash
     npm run verify
     ```
3. **스펙 아카이빙 연동**:
   - SDD 기반 기능 구현 작업인 경우, 머지 전 활성 스펙 문서를 `docs/specs/archived/{seq}-{feature-name}.md`로 이동하고 동결 경고 배너(`[!WARNING]`)를 부착한 상태로 PR에 포함해야 합니다.

---

## 3. 사전 검증 (Pre-checks)

커밋을 생성하거나 제안하기 전, 터미널 실행 또는 diff 분석을 통해 다음을 검증합니다:

- 민감 정보 점검: `.env*`, 비밀 키, 자격 증명 파일 등이 포함되어 있지 않은지 확인
- 빌드/임시 파일 점검: `.next/`, `node_modules/`, `dist/`, 빌드 아티팩트가 스테이징에 포함되지 않도록 확인
- 타입 및 정적 검사: 프로젝트 공식 스크립트인 `npm run check` 및 `npm test` 또는 `npm run verify`가 통과하는지 먼저 확인

---

## 4. 커밋 메시지 규격 (Conventional Commits)

포맷:

```text
<type>(<scope>): <subject>

[optional body] [optional footer]
```

### Type 목록

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `refactor`: 코드 리팩토링 (기능 및 UI 변경 없음)
- `style`: 포맷팅, 세미콜론 수정 등 (로직 영향 없음)
- `perf`: 성능 개선 (렌더링 최적화, 번들 용량 축소 등)
- `docs`: 문서 추가 및 수정 (README, 스펙, 주석 등)
- `test`: 테스트 코드 추가 및 수정
- `chore`: 빌드 설정, 의존성 패키지 관리, 스크립트 수정

### Scope 규칙 (FSD 및 도메인 특화)

변경 영역의 핵심 아키텍처 및 디렉토리 명칭을 소문자로 명시합니다:

- FSD Layers: `app`, `widgets`, `features`, `entities`, `shared`
- Spec 연동: `spec-001`, `spec-002` 등 스펙 식별자 명시 가능
- Core & Config: `config`, `deps`, `auth`, `env`, `db`

### Subject & Body 가이드라인

- 언어: 한국어 (간결하고 명확한 개조식/명령조: "~추가", "~수정", "~개선")
- Subject: 50자 이내, 마침표(.) 사용 금지, 무엇을 했는지 명확히 명시
- Body: 변경 이유(Why)와 맥락 위주로 서술 (단순 변경 사실 나열 지양)
- Breaking Change: 하위 호환성을 깨뜨리는 변경은 본문 하단에 `BREAKING CHANGE:` 명시

---

## 5. Atomic Commit 원칙

- 연관 없는 작업(예: UI 컴포넌트 수정과 환경 설정 패키지 업그레이드)이 섞여 있을 경우, 하나의 커밋으로 합치지 말고 파일을 분리하여 단계별 커밋으로 분할 제안하세요.
- "잡다한 수정", "업데이트"와 같은 모호한 커밋 메시지는 절대 작성하지 마세요.
- **주의: 사용자의 명시적 요청이 있거나 관련 스킬의 명확한 지시가 있을 때만 커밋을 제안하거나 실행하며, 임의로 `git commit`을 단독 실행하지 마세요.**
