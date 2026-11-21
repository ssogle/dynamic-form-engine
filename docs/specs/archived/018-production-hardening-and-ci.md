> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.

# [Spec-018] 프로덕션 배포 안정화, CI 파이프라인 구축 및 코드 위생 정비

> [!NOTE]
>
> - **상태 (Status)**: Archived (구현 완료 및 동결)
> - **브랜치 (Branch)**: `feat/spec-018-production-hardening-and-ci`
> - **작성일 (Created)**: 2026-11-21
> - **완료일 (Archived)**: 2026-11-22

## 1. 배경 및 문제 정의 (Context & Problem Statement)

`Spec-001` ~ `Spec-017`을 통해 3-Workspace(Builder / Consumer / Analyst) 핵심 도메인 기능과 단위 테스트 하네스가 완결되었습니다. 그러나 실제 서버리스 프로덕션 환경(Vercel + PostgreSQL)에 배포하고 공개 레포지토리로 운영하기에 앞서 다음 4가지 운영·위생 공백이 존재합니다.

1. **서버리스 AI 스트리밍 타임아웃 리스크**: `POST /api/v1/navigator` 라우트 핸들러에 `maxDuration`이 명시되지 않아 다중 스텝 Tool Calling 및 서버 집계 실행 시 기본 함수 타임아웃에 걸릴 수 있습니다.
2. **프로덕션 내부 오류 노출 및 전역 복구 화면 부재**: `apiResponse.fail` 및 Navigator 스트림 `error` 이벤트가 일반 `Error` 인스턴스의 `error.message`를 프로덕션 환경에서도 클라이언트에 그대로 노출하며, `src/app/error.tsx`와 `src/app/not-found.tsx`가 없어 예기치 못한 런타임 오류나 잘못된 URL 진입 시 Next.js 기본 에러 페이지가 표시됩니다.
3. **원격 자동 검증(CI) 및 라이선스 부재**: 로컬 `npm run verify` 하네스는 완비되어 있으나 GitHub Actions CI 워크플로우가 없어 PR/Push 단위의 자동 검증 증빙이 비어 있습니다.
4. **초기 보일러플레이트·팬텀 의존성·ESLint 경고 잔존**: 미사용 `src/shared/store/counter.store.ts`, `drizzle.config.ts`가 간접 참조하던 팬텀 의존성(`dotenv`), `use-dynamic-form.hook.ts`의 ESLint warning 1건이 남아 있습니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. `POST /api/v1/navigator`에 서버리스 스트리밍 타임아웃(`export const maxDuration = 60`) 명시.
  2. 프로덕션(`NODE_ENV === "production"`) 환경에서 비예측 500 `Error`의 내부 메시지 노출을 차단하고 서버 로그(`console.error`)에만 기록하며, 이에 대한 단위 테스트 추가.
  3. `@/shared/ui` 기반 전역 `src/app/error.tsx` 및 `src/app/not-found.tsx` 구현.
  4. 미사용 보일러플레이트(`src/shared/store/counter.store.ts` 및 테스트) 삭제 및 `drizzle.config.ts`의 팬텀 의존성(`dotenv`)을 명시적 `devDependencies`로 등록.
  5. `.github/workflows/ci.yml` 추가(`master` push 및 PR 대상 `npm run verify` 자동 실행).
  6. `use-dynamic-form.hook.ts` ESLint warning 1건 해소 (`npm run verify` 0 errors, 0 warnings 달성).
  7. `LICENSE`(MIT) 추가, `src/app/layout.tsx` OG/Twitter 메타데이터 보강, 전용 앱 파비콘(`src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`) 교체, `README.md` CI 배지 및 Engineering Harness 워크플로우 요약 보강.
- **Non-Goals**:
  - IP 기반 Rate Limit 및 자동 DB 시드 리셋 스케줄러 구축 (운영 트래픽 규모를 고려해 수동 시드 초기화로 대응).
  - Live Demo URL 및 시연 영상(MP4/GIF) 임베드 (실제 프로덕션 배포 및 화면 녹화 완료 후 별도 반영).
  - 인증/RBAC 계층 도입.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **아키텍처 및 FSD 계층 배치**:
  - `src/shared/lib/http/server.ts`: `apiResponse.fail`의 일반 `Error` 분기에서 `process.env.NODE_ENV === "production"`일 때 내부 메시지를 마스킹(`"서버 처리 중 오류가 발생했습니다."`)하고 `console.error`로 서버 로그만 남김. 의도된 `HttpErrorObject`(4xx/409 등)는 기존과 동일하게 `error.message` 및 `details` 반환.
  - `src/app/api/v1/navigator/route.ts`: `export const maxDuration = 60;` 선언 추가. 스트림 `catch` 블록에서도 `isHttpError`가 아닌 일반 `Error`는 프로덕션 환경에서 일반화된 문구만 클라이언트에 전송하고 원문은 `console.error`에 기록.
  - `src/app/error.tsx`, `src/app/not-found.tsx`: `@/shared/ui/card`, `@/shared/ui/button`을 조합한 Thin View 복구 UI.
  - `src/features/render-dynamic-form/hooks/use-dynamic-form.hook.ts`: `react-hooks/incompatible-library` 경고 1건 해소.
  - `.github/workflows/ci.yml`: `ubuntu-latest`, Node 24, `npm ci`, `npm run verify` 단일 잡 구성.
  - `src/app/layout.tsx`: `openGraph` 및 `twitter` 메타데이터 추가.
  - `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`: 보일러플레이트 `favicon.ico`를 동적 폼+AI 스파크 브랜드 심볼 아이콘으로 교체.
- **데이터 계약 (Schema & Interfaces)**:
  - 기존 HTTP 표준 에러 응답 계약(`{ success: false, error: { code, message, details? } }`) 및 Navigator NDJSON 스트림 이벤트 계약(`{ type: "error", message }`)을 100% 유지하면서 프로덕션 환경의 500 `message` 값만 안전하게 일반화합니다.
- **오류 처리 규격**:
  - `HttpErrorObject` (`badRequest`, `notFound`, `conflict` 등): 환경 무관하게 명시적 에러 코드·메시지 반환.
  - 일반 `Error` / 미확인 예외: 개발·테스트 환경에서는 디버깅을 위해 `error.message` 유지, 프로덕션 환경에서는 내부 구현·DB·API 키 관련 문구 유출을 막기 위해 고정 안내 문구 반환.

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: 모든 환경(개발/테스트 포함)에서 500 `error.message` 마스킹**
  - 기각 사유: 로컬 개발 및 단위 테스트 디버깅 시 원인 파악 속도가 떨어지므로 `NODE_ENV === "production"` 분기로 보안과 개발 편의성을 동시에 확보.
- **대안 B: GitHub Actions CI에 실제 DB 마이그레이션 및 E2E 테스트 포함**
  - 기각 사유: 프로젝트의 테스트 전략(`.agents/rules/testing-strategy-rule.md`)이 외부 인프라 의존 없는 순수 로직/계약 단위 테스트에 집중되어 있으므로, CI 역시 외부 시크릿 없이 1분 이내에 완료되는 `npm run verify` 단일 파이프라인이 가장 안정적이고 유지보수 비용이 낮음.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **플랫폼 제약**: `maxDuration = 60`은 Vercel Hobby(Fluid Compute) 및 Pro 플랜에서 지원되나, 호스팅 플랫폼 정책 변경 시 조정이 필요할 수 있음.
- **엣지 케이스**: `use-dynamic-form.hook.ts`의 ESLint 경고 해소 시 기존 `use-dynamic-form.hook.test.ts` 및 폼 입력 역동기화 동작이 깨지지 않도록 회귀 테스트 검증 필수.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. `server.ts` / `navigator/route.ts` 프로덕션 500 에러 마스킹 및 `maxDuration = 60` 적용 + 단위 테스트 추가
  2. `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/layout.tsx` 메타데이터 보강
  3. 데드 코드(`counter.store`) 삭제, 팬텀 의존성(`dotenv`) 명시화, `use-dynamic-form.hook.ts` ESLint 경고 해소
  4. `.github/workflows/ci.yml`, `LICENSE`, `README.md` 업데이트
- **검증 기준**:
  - `npm run verify` (typecheck + lint **0 errors, 0 warnings** + format:check + 전체 Vitest 통과)
  - `npm run build` 프로덕션 빌드 성공 확인
