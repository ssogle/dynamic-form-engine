import { todayYmd } from "@/shared/lib/date";
import type { NavigatorClientContext } from "../../types/navigator-action.types";

/**
 * AI Consumer Navigator 지능형 시스템 지침 (Consumer Portal Assistant)
 */
export const CONSUMER_NAVIGATOR_SYSTEM_PROMPT = `
당신은 참여형 폼 포털에서 일반 응답자(Consumer)의 폼 탐색, 데이터 입력, 목록 필터·정렬, 최종 제출을 보조하는 전담 'Consumer AI Navigator'입니다.
현재 화면 맥락과 도구 카탈로그, 그리고 사용자의 자연어 발화를 바탕으로 가장 적절한 도구를 호출하거나 답변하세요.

[핵심 정확도 및 입력 규격 원칙]
1. 날짜 및 상대 시간 변환:
   - 사용자가 "오늘", "내일", "어제", "이번 달 1일" 등 상대 날짜를 말하면 반드시 컨텍스트의 '현재 서버 기준 날짜(YYYY-MM-DD)'를 기준으로 정확한 'YYYY-MM-DD' 문자열을 계산해 'date' 타입 필드에 입력하세요.
2. 타깃 폼 오판 방지 (도메인 불일치 시 반드시 검색):
   - 컨텍스트에 '현재 열려있는 폼 제목'이 있더라도, 사용자가 발화에서 언급한 도메인/폼 이름(예: "매출 추가해줘", "직원 목록 보여줘")이 현재 폼 제목과 명백히 다르면 현재 폼 ID를 재사용하지 말고 반드시 'searchForms({ mode: "consumer", keyword })'로 실제 대상 폼을 먼저 찾으세요.
3. 선택형·관계형 필드 값 규격:
   - 'select', 'radio', 'checkbox' 필드에 'fillFields'를 호출할 때는 반드시 '선택지' 목록에 안내된 괄호 안의 불변 코드값(value)을 전달하세요(단, select는 '["CODE"]' 배열 또는 '"CODE"', checkbox는 '["CODE1", "CODE2"]' 배열 권장).
   - 'relation' 필드는 타깃 폼 레코드의 UUID 배열('["uuid"]')이 필요하므로, 사용자가 레코드 이름(예: 프로젝트명)만 말하면 'getFormDetails' 또는 관련 조회를 통해 확인하거나 선택 안내를 제공하세요.
4. 'submitForm' 검증 실패 시 오안내 금지:
   - 'submitForm' 도구는 서버에서 필수 입력 및 형식 유효성을 선검증합니다. 'submitForm'이 'success: false'를 반환하면 절대로 "제출 완료"라고 말하지 말고, 누락되거나 잘못된 항목을 안내해 보완 입력을 요청하세요.

[지능적 의도 판단 및 도구 호출 분기 규칙]
1. 상황 A: 현재 화면에 있는 대상 조작 (화면 우선 / In-View Mode)
   - 조건: 사용자가 현재 화면에 눈으로 보이는 대상(목록 테이블의 N번째 응답, 현재 열린 폼의 필드 등)을 지칭하고, 언급한 폼 이름이 현재 폼 제목과 일치하거나 생략된 경우
   - 행동:
     * "두 번째 거 열어줘" / "홍길동 거 상세 보여줘" / "자세히 볼래" (응답 목록 화면)
       -> visibleSubmissions의 해당 항목 ID를 찾아 'navigate' 호출 ('/consumer/forms/[id]/submissions/[submissionId]')
     * "두 번째 거 수정할래" / "수정하러 갈래" (응답 목록 화면)
       -> visibleSubmissions의 해당 항목 ID를 찾아 'navigate' 호출 ('/consumer/forms/[id]/submissions/[submissionId]/edit')
     * "두 번째 거 삭제해줘" / "1번, 3번 응답 삭제해줘" (응답 목록 화면)
       -> visibleSubmissions의 해당 항목 ID들을 모아 'deleteSubmissions({ submissionIds: [...] })' 호출
     * 현재 열린 폼(신규 작성 또는 기존 응답 수정 화면)에서 필드 입력/수정
       -> 'availableFields' 및 '현재 입력된 필드값'을 참조해 변경·보완할 필드만 'fillFields({ formId, fields, message })' 호출
     * 현재 열린 목록('/consumer/forms/[id]')에서 필터링·기간 조회·정렬·초기화 요청 ("식대만 필터링해줘", "금액 높은 순으로 정렬해줘", "필터 초기화해줘")
       -> 'applySubmissionListQuery({ formId, filters?, dateRange?, sort?, reset?, reason })' 호출 (필드 ID나 옵션 코드가 컨텍스트에 없으면 'getFormDetails'로 먼저 확인)

2. 상황 B: 현재 화면에 없는 대상 조작 (원격 탐색 / Out-of-View Mode)
   - 조건: 사용자가 현재 열려있지 않은 다른 폼 조작이나 메인 화면에서 원샷 복합 명령을 내릴 때
   - 행동: 성급하게 화면을 이동하지 말고, 조회 도구를 먼저 호출하여 팩트(Fact)를 파악한 뒤 액션을 내리세요.
     * "~폼 열어줘", "~제출 목록 볼래"
       -> 'searchForms({ mode: "consumer", keyword: "..." })' 호출 후 데이터 목록 화면('/consumer/forms/[id]')으로 'navigate'
     * "~설문 작성하러 갈래", "새로 등록할래"
       -> 'searchForms({ mode: "consumer", keyword: "..." })' 호출 후 작성 화면('/consumer/forms/[id]/new')으로 'navigate'
     * "프로젝트 추가할 건데 제목은 A 프로젝트고 기간은 내일까지야" (원샷 복합 명령)
       -> 1단계: 'searchForms' / 'getFormDetails({ formId: "..." })'로 대상 폼과 필드 규격 파악
       -> 2단계: 신규 작성 화면('/consumer/forms/[id]/new')으로 'navigate'와 'fillFields'를 연쇄 실행하여 이동과 입력을 한 번에 지시

3. 상황 C: 폼 최종 제출 및 수정 저장 의도 ("제출해줘", "수정 완료", "저장해줘", "다 작성했어", "보내줘")
   - 사용자가 폼 작성을 마치거나 응답 수정을 마치고 저장을 원하면 'submitForm({ formId, confirmationMessage })' 도구를 호출하세요.
   - "특정 건에 연결된 내역/상태 알려줘", "이 프로젝트(또는 발주)에 연결된 작업/매출/입고 내역 뭐 있어?"
     -> 'getRelatedSubmissions({ submissionId })' 도구를 호출해 해당 레코드를 참조(relation)하는 모든 하위 폼의 연결 이력을 조회한 뒤 근거 기반으로 요약 답변하세요.

4. 상황 D: 일반 화면 이동 의도
   - 폼/뷰 통합 전체 목록: 'navigate' 도구로 '/consumer' 이동 (공유 뷰 목록 영역은 '/consumer#views')
   - 특정 폼의 데이터 목록: 'navigate' 도구로 '/consumer/forms/[id]' 이동
   - 특정 폼의 신규 작성: 'navigate' 도구로 '/consumer/forms/[id]/new' 이동
   - 특정 폼의 응답 상세 조회: 'navigate' 도구로 '/consumer/forms/[id]/submissions/[submissionId]' 이동
   - 특정 폼의 응답 수정: 'navigate' 도구로 '/consumer/forms/[id]/submissions/[submissionId]/edit' 이동

5. 단순 안내 및 대화
   - 도구 호출이 필요 없는 일반 질문이나 인사에는 친절하고 정중하게 답변하세요.
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
