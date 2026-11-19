<!-- 아카이브(동결) 전환 시 아래 WARNING 주석을 해제하고 상단 NOTE 블록을 대체하세요 -->
<!--
> [!WARNING]
> **ARCHIVED SPECIFICATION (READ-ONLY)**
> 본 문서는 구현 완료 후 동결된 과거 기록입니다.
> 현재 시스템의 구현 규격은 `/src` 실제 코드를 참조하세요. AI 에이전트는 이 문서를 최신 코드로 인용하지 마십시오.
-->

# [Spec-013] AI 채팅·멀티모달·사전 승인 및 워크스페이스 UX 고도화 (AI Chat, Multimodal, HITL & UX Polish)

> [!NOTE]
>
> - **상태 (Status)**: Active (기획/구현 중)
> - **브랜치 (Branch)**: `feat/spec-013-ai-chat-multimodal-hitl-and-ux-polish`
> - **작성일 (Created)**: 2026-11-19
> - **완료일 (Archived)**: -

## 1. 배경 및 문제 정의 (Context & Problem Statement)

Spec 001~012를 통해 빌더·컨슈머·분석가 코어 엔진은 완성되었으나, 실제 사용자 대면 인터페이스와 안전장치에 다음 4가지 마감 공백이 남아 있습니다.

1. **채팅 응답 가독성 및 입력 UX 한계**: `NavigatorShell`이 어시스턴트 응답을 일반 텍스트로만 렌더링해 마크다운 서식(목록, 표, 강조, 코드 블록)이 깨져 보이며, 입력창이 단일 줄 `<Input>` 기반이라 멀티라인 작성이나 이미지 첨부 입력을 지원하지 못합니다. (Analyst `TextBlockRenderer`도 자체 경량 정규식 파서만 지원)
2. **비정형 이미지(영수증/명세서) 자동 입력 부재**: Consumer AI가 텍스트 발화만 받을 수 있어, 실무 문서 이미지를 올리고 Gemini Vision으로 필드를 추출해 `fillFields`로 채우는 멀티모달 워크플로우가 불가능합니다.
3. **고위험 액션 즉시 실행 리스크**: 폼 발행/삭제(`publishForm`, `deleteForms`), 응답 삭제(`deleteSubmissions`), 분석 뷰 발행/삭제(`publishAnalysisView`, `deleteAnalysisViews`)가 사전 확인 단계 없이 LLM 도구 호출 즉시 DB를 변경합니다.
4. **워크스페이스 세부 UX 및 용어 일관성 부족**:
   - 빌더 캔버스에서 AI가 필드를 추가/수정해도 해당 필드로 자동 스크롤·하이라이트나 완료 토스트가 뜨지 않습니다.
   - 컨슈머 단건 상세 화면의 역참조 서브테이블(`RelatedSubmissionSubtable`)이 단순 테이블로 분리되어 있어 목록 테이블(`ManageFormSubmissions`)과 컬럼 정렬/필터/표현 일관성이 떨어집니다.
   - 컨슈머 빈 폼 목록의 "빌더에서 폼 만들기" 버튼 노출, 관계형 피커 단일 선택 시 체크박스 표기, 드롭다운 옵션 설명 목록 무제한 세로 확장, 숫자(`number`) 필드 천 단위 콤마 미표기, 곳곳에 남은 "설문지/신청서/참여" 카피 등 마감 품질 보완이 필요합니다.

## 2. 목표 및 비목표 (Goals & Non-Goals)

- **Goals**:
  1. **shadcn AI Elements (`radix-nova`) 기반 채팅 UI & 공통 마크다운 렌더러**: 공식 shadcn 컴포넌트(`message`, `message-scroller`, `bubble`, `attachment`, `trace`, `item`, `sonner`)와 공용 `MarkdownContent`(`react-markdown` + `remark-gfm`)를 도입해 `NavigatorShell`과 `TextBlockRenderer`의 마크다운 렌더링을 통합하고, `Prompt Input`(멀티라인 입력, Shift+Enter 줄바꿈, 이미지 첨부/미리보기, 클립보드 붙여넣기)과 `Trace` 수행 단계 UI를 구현합니다.
  2. **Consumer AI 멀티모달 이미지 파싱**: `navigatorRequestSchema`에 이미지 첨부 페이로드를 추가하고, `runNavigatorEngine`이 Gemini Vision 멀티모달 파트를 전달해 `fillFields`로 폼 필드를 자동 채움하도록 지원합니다.
  3. **고위험 액션 사전 실행 확인 루프(Human-in-the-Loop)**: `publishForm`, `deleteForms`, `deleteSubmissions`, `publishAnalysisView`, `deleteAnalysisViews` 실행 전 채팅 타임라인 내 인라인 승인 카드(`Item` + `Button` 기반 `Confirmation` 패턴)를 통해 사용자 확인 후 실행되도록 보호합니다.
  4. **빌더·컨슈머 워크스페이스 UX 및 카피 일관성 정비**:
     - `sonner` 토스트 도입(`src/app/layout.tsx` `<Toaster />`) 및 빌더 캔버스 변경 필드 자동 포커싱(`scrollIntoView`)·일시 하이라이트
     - 컨슈머 단건 상세 역참조 내역을 `ManageFormSubmissions` 계열 테이블/인터페이스와 통합
     - 컨슈머 빈 폼 목록의 빌더 이동 CTA 제거, 관계형 피커 단일 선택 시 라디오 인디케이터 구분, `select` 옵션 설명 목록 `Collapsible` + 스크롤 적용, 숫자 필드 천 단위 콤마 포맷 적용, 도메인 데이터 모델 톤으로 카피 정비
- **Non-Goals**:
  1. PDF/문서(HWP/DOCX) 업로드 및 서버 파일 스토리지(S3) 영구 보관 -> 본 스펙에서는 브라우저에서 리사이징/전달하는 경량 이미지 첨부(Vision 파싱 전용)만 다룹니다.
  2. 숫자 입력 `<Input>` 실시간 타이핑 마스킹 -> 커서 점프 및 브라우저 `number` 입력 제약을 피하기 위해, 읽기 표시(`formatFieldDisplayValue`, 상세·목록·관계 테이블·차트) 천 단위 콤마 적용을 우선 구현합니다.
  3. `NavigatorShell`의 Vercel AI SDK `useChat` 전면 교체 -> 기존 컨텍스트 스냅샷/복합 액션/NDJSON 스트리밍 파이프라인을 유지하면서 공식 shadcn AI Elements UI와 HITL 승인 계약을 결합합니다.

## 3. 제안 솔루션 및 계약 (Proposed Solution & Contracts)

- **설치할 공식 shadcn 컴포넌트 (`radix-nova`) & 외부 패키지**:
  - `npx shadcn@latest add message message-scroller bubble attachment trace item sonner`
  - `npm install react-markdown remark-gfm`

- **아키텍처 및 FSD 계층 배치**:
  - `src/shared/ui/`:
    - shadcn AI Elements UI 컴포넌트(`message.tsx`, `message-scroller.tsx`, `bubble.tsx`, `attachment.tsx`, `trace.tsx`, `item.tsx`, `sonner.tsx`) 추가
    - `markdown-content.tsx`: `react-markdown` + `remark-gfm` 기반 공용 GFM 마크다운 렌더러
  - `src/app/layout.tsx`: 전역 `<Toaster />` 마운트
  - `src/entities/form/`:
    - `lib/format-field-value.ts`: `field?.type === "number"`(및 유한 숫자) 천 단위 콤마 포맷 (`toLocaleString("ko-KR", { maximumFractionDigits: 10 })`) 적용
  - `src/features/execute-navigator-action/`:
    - `schema/navigator-request.schema.ts`: `attachments` (`image/png|jpeg|webp`, 최대 3장, base64 dataUrl 상한 검증) 및 `confirmedAction` 재실행 페이로드 확장
    - `types/navigator-action.types.ts`: `PendingNavigatorConfirmation` 계약 추가
    - `lib/tools/`: 고위험 5종 도구(`publishForm`, `deleteForms`, `deleteSubmissions`, `publishAnalysisView`, `deleteAnalysisViews`)에 사전 확인 게이트 적용 (미승인 1차 호출 시 DB 변이 없이 확인 메타데이터 반환, 승인 후 실행 요청 시 실제 DB 변경 수행)
    - `server/navigator-engine.server.ts`: 첨부 이미지를 `generateText` 멀티모달 `image` 파트로 변환 전달, 대기 중인 승인 요청 목록(`pendingConfirmations`) 및 확인 후 직접 실행 경로 처리
  - `src/widgets/navigator-shell/`:
    - `ui/navigator-shell.tsx`: `Message`, `MessageScroller`, `Bubble`, `Trace`, `Attachment`, `InputGroup`, `Item`, `MarkdownContent` 조합으로 채팅 UI 개편 (멀티라인·이미지 첨부·인라인 승인 카드)
    - `hooks/use-navigator-shell.hook.ts`, `store/navigator-chat.store.ts`, `lib/image-attachment.ts`: 이미지 파일 선택/붙여넣기 Canvas 리사이징, 승인 대기 액션 재실행/취소 핸들러, 완료 토스트(`toast.success` / `toast.error`) 연동
  - `src/features/render-analysis-view/`:
    - `ui/text-block-renderer.tsx`: 자체 `parseTextContent` 대신 공용 `MarkdownContent` 사용으로 통합
  - `src/features/render-dynamic-form/`:
    - `ui/dynamic-form-renderer.tsx` & `ui/form-field-wrapper.tsx`: 빌더 캔버스에서 AI 변경/추가된 필드 감지 시 해당 필드 DOM `scrollIntoView` + 일시 하이라이트 적용
    - `ui/dynamic-field.tsx`: `SelectOptionsGuideList`에 `Collapsible` + `max-h-40 overflow-y-auto` 적용
    - `ui/relation-field-input.tsx`: `multiple === false`일 때 체크박스 대신 `@/shared/ui/radio-group` 기반 라디오 UI 구분
  - `src/features/manage-form-submissions/`:
    - `ui/submission-detail-view.tsx` & `ui/related-submission-subtable.tsx`: 역참조 내역을 `ManageFormSubmissions`와 일관된 테이블 경험(정렬/컬럼/표현/상세 이동)으로 통합
  - `src/features/browse-published-forms/` & `src/app/`:
    - `published-form-list.tsx`에서 `빌더에서 폼 만들기` CTA 제거
    - `src/app/page.tsx`, `(workspace)/builder/forms/page.tsx`, `(workspace)/consumer/page.tsx`, `navigator-chat.store.ts` 카피를 도메인 데이터 모델/엔진 톤으로 정비

- **데이터 계약 (Schema & Interfaces)**:

  ```typescript
  // 이미지 첨부 스키마 (최대 3장, base64 dataUrl 상한 검증)
  export const navigatorAttachmentSchema = z.object({
    name: z.string().max(120).optional(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    dataUrl: z
      .string()
      .max(4_000_000, "이미지 첨부 크기가 허용 한도를 초과했습니다.")
      .refine((val) => val.startsWith("data:image/")),
  });

  // 고위험 액션 사전 확인 메타데이터
  export interface PendingNavigatorConfirmation {
    confirmationId: string;
    toolName:
      | "publishForm"
      | "deleteForms"
      | "deleteSubmissions"
      | "publishAnalysisView"
      | "deleteAnalysisViews";
    title: string;
    description: string;
    targetIds: string[];
    payload: Record<string, unknown>;
  }
  ```

- **오류 처리 규격**:
  - 이미지 첨부 개수(3장) 또는 용량(압축 후 이미지당 상한) 초과 시 클라이언트에서 업로드 즉시 `toast.error` 안내 및 서버 Zod 검증 거부
  - HITL 승인 요청을 사용자가 취소할 경우 DB 변이 없이 대화 타임라인에 취소 상태를 확정 표기

## 4. 고려한 대안 및 기각 사유 (Alternatives Considered)

- **대안 A: HITL을 위해 `@ai-sdk/react` `useChat` 및 UIMessage 스트림 포맷으로 전면 이관**
  - 기각 사유: 현재 `NavigatorShell`의 동기화된 `currentContext` 조립, `actions` 정렬/복합 디스패치, 커스텀 NDJSON 진행 단계 패널까지 모두 재작성해야 하므로 변경 위험과 회귀 비용이 큽니다. 기존 엔진 위에 `PendingNavigatorConfirmation` + 명시적 승인 실행 계약을 얹는 편이 결정론적이고 검증하기 쉽습니다.
- **대안 B: 마크다운 렌더링을 직접 정규식 파서 확장으로 구현**
  - 기각 사유: 표(GFM table), 코드 블록, 중첩 목록, 인라인 링크 등 실사용 마크다운 구문을 정규식으로 유지보수하는 것은 비효율적이므로, `react-markdown` + `remark-gfm` 기반 공용 `MarkdownContent`로 일원화합니다.

## 5. 리스크 및 제약 사항 (Risks & Open Questions)

- **성능 및 레이턴시**: 고해상도 모바일 영수증/명세서 사진은 base64 용량이 수 MB 이상일 수 있으므로, 첨부 시 브라우저 Canvas API로 최대 변 `1600px` 이하 JPEG/WebP 압축 후 API에 전달해야 합니다.
- **엣지 케이스**:
  1. HITL 승인 대기 중에 사용자가 다른 화면으로 이동하거나 폼 버전이 바뀐 경우, 승인 실행 시 기존의 낙관적 락(`version`) 및 폼 존재 검증이 그대로 동작하여 충돌을 방어해야 합니다.
  2. `formatFieldDisplayValue`에 숫자 콤마를 적용할 때 `연도`나 ID 성격의 숫자가 잘못 쉼표 처리되는지 여부(향후 필드 포맷 옵션 확장 가능, 현 단계에서는 일반 `number` 타입 일괄 적용).
  3. Vitest 테스트 환경(`jsdom`)에서 `Element.prototype.scrollIntoView`가 미구현이므로 빌더 포커싱 호출 시 옵셔널 체이닝(`el?.scrollIntoView?.(...)`) 가드가 필수입니다.

## 6. 마일스톤 및 검증 계획 (Milestones & Verification)

- **단계별 구현 계획**:
  1. 공식 shadcn 컴포넌트(`message`, `message-scroller`, `bubble`, `attachment`, `trace`, `item`, `sonner`) 및 `react-markdown` / `remark-gfm` 설치, 공용 `MarkdownContent` & `formatFieldDisplayValue` 숫자 콤마 구현·테스트
  2. 멀티모달 이미지 첨부 스키마·리사이징 유틸·Gemini Vision 입력 연동 구현 및 테스트
  3. 고위험 5종 도구 HITL 확인 게이트 계약 및 서버/클라이언트 승인 루프 구현 및 테스트
  4. `NavigatorShell` UI 개편(`Message`, `Bubble`, `Trace`, `Attachment`, `Item`, `MarkdownContent`, `PromptInput`, `sonner` 토스트)
  5. 빌더 포커싱·하이라이트, 역참조 테이블 통합, UI 디테일(`Collapsible` 옵션 가이드, 라디오 피커, 빈 목록 CTA 제거, 카피 정비) 구현
  6. `npm run fix && npm run verify` 완주
- **검증 기준**:
  - `npm test`: `attachments` 스키마 검증, 고위험 도구 미승인 차단 및 승인 후 실행, `formatFieldDisplayValue` 숫자 콤마 포맷, `TextBlockRenderer`·`navigator-chat.store`·`navigator-engine` 단위 테스트 통과
  - `npm run verify`: 타입체크, ESLint, Prettier, 전체 테스트 결함 0건 통과

```

```
