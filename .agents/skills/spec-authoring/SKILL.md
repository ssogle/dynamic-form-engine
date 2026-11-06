---
name: spec-authoring
description: >-
  Interactive skill to guide the creation of standardized Tech Specs (SDD) following the project's
  Spec-Driven Development governance. Evaluates UI Spike necessity, drafts specs based on TEMPLATE.md,
  auto-increments spec sequence numbers, generates active spec files, and suggests git branch creation.
---

# Spec-Authoring Skill Manual

본 스킬은 새로운 기능 개발 또는 대규모 아키텍처 개편을 시작할 때, 표준 규격에 맞춘 스펙 문서(SDD)를 대화형으로 작성하고 Git 브랜치 생성을 지원하는 자동화 가이드입니다.

---

## 1. 사전 탐색 및 시퀀스 번호 결정

스펙 문서 작성을 시작하기 전에 에이전트는 저장소를 점검합니다.

1. **기존 스펙 번호 조회**:
   - `docs/specs/active/` 및 `docs/specs/archived/` 폴더 내의 기존 파일명을 검사합니다.
   - 예: `001-xxx.md`, `002-yyy.md` 등이 존재할 경우, 가장 큰 번호에 1을 더해 다음 3자리 시퀀스 번호(예: `003`)를 부여합니다. 기존 파일이 전혀 없다면 `001`부터 시작합니다.
2. **기능 명칭 슬러그 확정**:
   - 사용자가 개발하고자 하는 기능의 핵심 명칭을 영문 kebab-case로 정의합니다 (예: `prompt-form-schema-builder`).

---

## 2. 5단계 인터랙티브 실행 절차

### Step 0: UI-First Spike 필요 여부 판별

사용자에게 가장 먼저 질문합니다:

> "구현하고자 하는 화면이나 사용자 인터랙션의 형태가 직관적으로 명확한가요, 아니면 프로토타입으로 시각적 검증(UI Spike)이 먼저 필요한가요?"

- **Spike 필요 시**: 정식 스펙 작성 전 임시 라우트나 단일 컴포넌트에서 `@/shared/ui` 기반 하드코딩 UI를 조립하여 사용성을 먼저 검증하도록 권유합니다.
- **화면 명확 시**: 곧바로 Step 1(스펙 초안 작성 및 피드백)으로 진행합니다.

---

### Step 1: 선제적 초안 제시 및 피드백 조율 (Draft & Review)

개별 항목을 질문하여 피로도를 유발하지 않습니다. 사용자가 제시한 기능 아이디어를 바탕으로, 에이전트가 프로젝트 아키텍처(FSD 계층, Zod, Gemini SDK 등)를 고려하여 **[`docs/specs/TEMPLATE.md`](file:///Users/sobyeongcheon/Desktop/projects/dynamic-form-engine/docs/specs/TEMPLATE.md)의 모든 섹션이 채워진 스펙 초안(Draft)을 선제적으로 작성하여 한 번에 제시**합니다.

에이전트는 특히 다음 핵심 항목을 주도적으로 설계하여 제안합니다:

1. **Goals & Non-Goals**: 1~2주 스프린트 내 완료 가능한 명확한 경계선 설정
2. **Proposed Solution**: FSD 레이어 배치 및 구체적인 Zod 스키마/타입 계약
3. **Alternatives Considered**: 검토 가능한 기술적 대안 및 트레이드오프 근거

초안을 제시한 후 사용자에게 확인을 요청합니다:

> "작성된 스펙 초안입니다. 특히 Goals/Non-Goals 범위와 솔루션 설계가 의도에 부합하는지 확인해 주세요. 수정이나 보완할 부분이 있으신가요?"

- **수정 요청 시**: 사용자의 피드백을 즉시 반영하여 초안을 교정합니다.
- **승인 시**: Step 2(Git 브랜치 생성 및 전환)로 진행합니다.

---

### Step 2: Git 브랜치 생성 및 전환

초안 승인으로 번호와 기능 슬러그가 확정되면, 스펙 파일을 생성하기 전에 `master`에서 새 작업 브랜치를 먼저 생성하고 전환합니다.

- **브랜치명 규격**: `feat/spec-{seq}-{feature-name}`
- **전환 명령**:
  ```bash
  git checkout -b feat/spec-{seq}-{feature-name}
  ```
- _주의: 사용자의 확인 및 승인 후 브랜치 전환을 진행합니다._

---

### Step 3: 스펙 파일 생성

새로 전환된 기능 브랜치에서 `docs/specs/TEMPLATE.md` 템플릿을 기반으로 합의된 스펙 문서를 생성합니다.

- **템플릿 원천**: `docs/specs/TEMPLATE.md`
- **생성 대상 파일**: `docs/specs/active/{seq}-{feature-name}.md`

---

### Step 4: 에이전트 태스크 플랜(실행 계획) 수립 안내

브랜치 분기 후 에이전트는 코드를 즉시 작성하지 않고, 다음 질문 및 계획을 제시합니다:

> "스펙 문서 생성이 완료되었습니다. 이제 스펙을 기반으로 세부 파일 및 테스트 단위의 실행 계획(Task Plan)을 수립해 드릴까요?"

사용자가 동의하면 에이전트는 FSD 계층에 따른 TDD 작업 순서를 제시하고 승인을 받은 뒤 1단계 구현에 착수합니다.
