import { todayYmd } from "@/shared/lib/date";
import type { NavigatorClientContext } from "../../types/navigator-action.types";

/**
 * AI Consumer Navigator 지능형 시스템 지침 (Consumer Portal Assistant)
 */
export const CONSUMER_NAVIGATOR_SYSTEM_PROMPT = `
당신은 컨슈머 포털 전담 'Consumer AI Navigator'입니다. 현재 화면 맥락과 도구를 사용해 탐색, 데이터 조회, 입력, 제출을 처리하세요.

[핵심 규칙]
1. 날짜 변환: "오늘/내일/어제" 등 상대 날짜는 컨텍스트의 '현재 서버 기준 날짜' 기준 'YYYY-MM-DD'로 계산해 'date' 필드에 입력합니다.
2. 타깃 폼 검증: 발화의 도메인이 '현재 열려있는 폼 제목'과 다르면 현재 폼 ID를 재사용하지 말고 'searchForms({ mode: "consumer", keyword })'로 실제 폼을 먼저 찾으세요.
3. 선택형·관계형 값 규격:
   - 'select'/'radio'/'checkbox'에 'fillFields' 호출 시 선택지 괄호 안의 코드값(value)을 전달하세요(단일 select는 '["CODE"]' 또는 '"CODE"', checkbox는 '["CODE1", ...]').
   - 'relation' 필드는 타깃 레코드 UUID 배열('["uuid"]')이 필요하므로, 이름만 언급되면 'getFormDetails'로 targetFormId를 확인한 뒤 'searchSubmissions'로 UUID를 먼저 조회해 채우세요.
4. 검증·승인 처리:
   - 'submitForm'이 'success: false'를 반환하면 절대 "제출 완료"라 말하지 말고 누락/오류 항목 보완을 안내하세요.
   - 'submitForm', 'deleteSubmissions' 등이 'status: "PENDING_CONFIRMATION"'을 반환하면 재시도하지 말고 채팅 화면 승인 카드에서 [승인] 버튼을 누르도록 안내하세요.
5. 조회('searchSubmissions') vs 목록 UI 제어('applySubmissionListQuery') vs 연결 이력('getRelatedSubmissions'):
   - 등록 데이터 확인·검색·relation UUID 조회는 화면 이동 없이 'searchSubmissions'로 조회하세요(특정 레코드의 전체 역참조 이력은 'getRelatedSubmissions({ submissionId })').
   - 현재 목록 화면이든 다른 화면(포털 대시보드 등)이든, 특정 폼 목록에 필터·기간·정렬을 적용하거나 초기화해 열어야 하면 'searchForms'·'getFormDetails'로 대상 폼 ID와 필드 ID를 먼저 확인한 뒤 'applySubmissionListQuery'를 호출하세요. ('relation' 필드를 특정 타깃 레코드로 필터링할 때는 'searchSubmissions'로 대상 UUID를 먼저 찾고 'op: "in", values: ["uuid"]' 조건을 우선 사용하세요.)
6. 이미지 첨부 입력: 첨부 이미지 속 날짜(YYYY-MM-DD)·금액(쉼표 없는 숫자)·거래처·분류를 판독해 대상 폼 필드에 'fillFields'로 채우세요.
7. 통계 집계·다중 도메인 분석 경계: 합계·평균·비율·월별 추이 등 통계 집계나 여러 폼 간 교차 계산 요청 시 'searchSubmissions' 결과를 직접 합산하거나 암산하지 말고, 발행된 공유 분석 뷰('/consumer#views') 확인 또는 Analyst 워크스페이스('/analyst') 이용을 안내하세요.

[의도별 행동]
- 현재 화면 조작: 상세 이동('/consumer/forms/[id]/submissions/[submissionId]'), 수정 이동('.../edit'), 삭제('deleteSubmissions'), 입력('fillFields'), 목록 필터·정렬('applySubmissionListQuery').
- 다른 폼/원격 이동·입력: 'searchForms'·'getFormDetails' 확인 후 작성('/consumer/forms/[id]/new')은 'navigate'(필요 시 'fillFields' 병행), 조건·정렬이 적용된 목록('/consumer/forms/[id]') 이동은 'applySubmissionListQuery' 호출.
- 제출·수정 저장: 'submitForm({ formId, confirmationMessage })' 호출.
- 전체 목록: '/consumer'(공유 뷰 '/consumer#views'). 도구 불필요한 일반 대화는 간결히 답변하세요.
`.trim();

/**
 * 컨슈머 화면 맥락 포맷터 (린 프롬프트 규격)
 */
export function formatConsumerContextPrompt(
  prompt: string,
  currentContext: NavigatorClientContext | undefined
): string {
  const serverToday = todayYmd("Asia/Seoul");
  const currentPath = currentContext?.currentPath ?? "미지정";
  const currentFormId = currentContext?.currentFormId ?? "없음 (목록 또는 외부 화면)";
  const currentFormTitle = currentContext?.currentFormTitle ?? "없음";

  // 1. 현재 화면에 렌더링된 응답 목록 캐시 (인덱스 순서 보장)
  let visibleSubmissionsSummary = "없음 (현재 응답 목록 화면이 아니거나 제출 내역 없음)";
  if (currentContext?.visibleSubmissions && currentContext.visibleSubmissions.length > 0) {
    visibleSubmissionsSummary = currentContext.visibleSubmissions
      .map(
        (s, idx) =>
          `  ${idx + 1}. [ID: ${s.id}] ${s.title}${s.summary ? ` (${s.summary})` : ""}${s.createdAt ? ` [일시: ${s.createdAt}]` : ""}`
      )
      .join("\n");
  }

  // 2. 현재 활성 폼 필드 스펙 요약 (현재 폼 화면에 열려있는 경우)
  let currentFieldsSummary = "없음 (폼 입력 화면이 아님)";
  if (currentContext?.availableFields && currentContext.availableFields.length > 0) {
    currentFieldsSummary = currentContext.availableFields
      .map((f) => {
        const req = f.required ? "필수" : "선택";
        const multiTag =
          f.multiple || f.relationConfig?.multiple
            ? ", 다중선택(string[])"
            : f.type === "select" || f.type === "relation"
              ? ", 단일선택(string[])"
              : "";
        const activeOptions = (f.options ?? []).filter((opt) => !opt.disabled);
        const opts =
          activeOptions.length > 0
            ? ` [선택지: ${activeOptions.map((opt) => `${opt.label}(${opt.value}): ${opt.description}`).join(" | ")}]`
            : "";
        const desc = f.description ? ` — 설명: ${f.description}` : "";
        return `  * ${f.id} (라벨: "${f.label}", 타입: ${f.type}, ${req}${multiTag})${opts}${desc}`;
      })
      .join("\n");
  }

  // 3. 현재 임시 입력값 요약
  const draftSummary =
    currentContext?.currentDraftValues && Object.keys(currentContext.currentDraftValues).length > 0
      ? JSON.stringify(currentContext.currentDraftValues, null, 2)
      : "없음 (입력 대기 상태)";

  const isEditMode = currentPath.endsWith("/edit");
  const isDetailMode = /\/submissions\/[^/]+$/.test(currentPath);
  const isNewMode = currentPath.endsWith("/new");
  const isListMode = /^\/consumer\/forms\/[^/]+$/.test(currentPath);
  const screenMode = isEditMode
    ? "기존 응답 수정 화면 (수정 모드)"
    : isDetailMode
      ? "기제출 응답 단건 상세 조회 화면"
      : isNewMode
        ? "신규 폼 데이터 작성 화면"
        : isListMode
          ? "기제출 응답 목록 및 가상화 테이블 관리 화면"
          : "포털 대시보드 / 폼 목록 화면";

  return `사용자 발화: "${prompt}"

[현재 화면 상황 및 맥락]
- 현재 서버 기준 날짜: ${serverToday} (YYYY-MM-DD, Asia/Seoul 기준 — "오늘/내일" 등 상대 날짜 계산에 사용하세요)
- 현재 사용자 화면 경로: ${currentPath} (${screenMode})
- 현재 열려있는 폼 제목: ${currentFormTitle}
- 현재 열려있는 폼 ID: ${currentFormId}
- 현재 열려있는 폼 필드 규격:
${currentFieldsSummary}
- 현재 입력된 필드값:
${draftSummary}
- 현재 화면 테이블에 표시된 응답 목록 (위에서부터 순서대로):
${visibleSubmissionsSummary}

(알림: 현재 열려있는 폼과 다른 도메인을 지칭하거나 화면에 없는 폼 정보가 필요할 때는 'searchForms' 또는 'getFormDetails' 도구를 먼저 호출하여 확인하세요.)`;
}
