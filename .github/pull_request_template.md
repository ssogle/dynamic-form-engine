## 연관 이슈 / 스펙 (Related Spec / Issue)

- 스펙 문서: `docs/specs/active/{seq}-{feature-name}.md` 또는 `docs/specs/archived/{seq}-{feature-name}.md`
- 관련 이슈 번호: #

## 변경 목적 (Purpose)

<!-- 이 PR이 해결하려는 문제나 추가하는 기능의 목적을 간결하게 설명합니다. -->

## 작업 유형 (Type of Change)

- [ ] feat: 신규 기능 추가
- [ ] fix: 버그 수정
- [ ] refactor: 코드 리팩터링 (기능 및 UI 변경 없음)
- [ ] test: 테스트 코드 추가 및 수정
- [ ] docs: 문서 추가 및 수정 (README, 스펙 등)
- [ ] chore: 빌드 설정, 의존성 패키지 관리, 스크립트 수정

## 핵심 변경 사항 (Key Changes)

- **FSD 레이어별 변경 요약**:
  - `app/`: 라우팅 및 페이지 레이아웃 변경사항
  - `widgets/`: 독립 실행 UI 위젯 추가/수정
  - `features/`: 사용자 인터랙션 및 비즈니스 기능
  - `entities/`: 도메인 모델, 스키마, 상태
  - `shared/`: 공용 유틸리티, shadcn/ui 컴포넌트, API 클라이언트
- **상세 변경 내역**:
  -

## 기술적 의사결정 및 트레이드오프 (Technical Decisions)

<!-- 구현 과정에서 고려한 대안이나 의도된 설계 구조, 성능 트레이드오프가 있다면 기술합니다. -->

## 필수 검증 체크리스트 (Verification Checklist)

- [ ] 로컬에서 `npm run verify`를 완주하여 결함이 0건임을 확인했습니까? (타입, 린트, 포맷, 테스트 전체)
- [ ] FSD 단방향 의존성 및 Public API(루트 `index.ts`) 참조 원칙을 준수했습니까?
- [ ] 임의의 커스텀 UI 대신 `@/shared/ui` 컴포넌트(shadcn/ui)를 최우선으로 재사용했습니까?
- [ ] 기능 구현이 완료된 스펙 문서를 `docs/specs/archived/`로 이동(동결 경고 배너 부착)했습니까? (해당 시)
- [ ] `.env` 및 민감한 자격 증명 정보가 커밋/PR에 포함되지 않았습니까?
- [ ] PR 머지 완료 후 해당 작업 브랜치를 삭제할 준비가 되었습니까?
