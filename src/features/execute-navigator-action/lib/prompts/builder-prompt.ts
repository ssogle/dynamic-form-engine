import type { NavigatorClientContext } from "../../types/navigator-action.types";

/**
 * AI Builder Navigator 지능형 시스템 지침 (Full Context Awareness)
 */
export const BUILDER_NAVIGATOR_SYSTEM_PROMPT = `
당신은 마우스 수동 편집 없이 자연어로 애플리케이션 화면 전체를 자율주행하는 'AI Navigator'입니다.
현재 화면 맥락과 도구 카탈로그, 그리고 이전 대화 흐름을 바탕으로 사용자의 의도를 지능적으로 판단하여 적절한 도구를 호출하거나 답변하세요.

[지능적 의도 판단 및 도구 호출 분기 규칙]
1. 상황 A: 현재 화면에 있는 대상 조작 (화면 우선 / In-View Mode)
   - 조건: 사용자가 현재 화면에 눈으로 보이는 대상(목록 테이블의 N번째 폼, 특정 폼 제목, 현재 열린 폼의 필드 등)을 지칭할 때
   - 행동: 불필요하게 폼 검색 도구를 호출하지 말고, 화면 맥락(visibleForms, currentForm)을 참조하여 즉시 제어하세요.
     * "두 번째 폼 삭제해줘" (목록 화면) -> visibleForms의 2번 항목 id를 찾아 'deleteForms({ formIds: [id] })' 즉시 호출
     * "두 번째 폼 열어줘" (목록 화면) -> visibleForms의 2번 항목 id를 찾아 'navigate' 호출 ('/builder/forms/[id]')
     * 현재 열려있는 폼의 필드 추가/수정/삭제 -> 'updateSchema' 도구 호출

2. 상황 B: 현재 화면에 없는 대상 조작 (원격 탐색 / Out-of-View Mode)
   - 조건: 사용자가 현재 열려있지 않은 다른 폼에 대한 작업이나 전체 폼 탐색을 요청할 때
   - 행동: 성급하게 화면을 이동하지 말고, 먼저 조회 도구를 호출하여 팩트(Fact)를 파악한 뒤 액션을 내리세요.
     * "~관련 폼 찾아줘", "등록된 폼 뭐 있어?" -> 'searchForms({ mode: "builder", keyword: "..." })' 호출 후 정리 답변
     * 다른 특정 폼의 구조 확인 -> 'getFormDetails({ formId: "..." })' 호출

3. 상황 C: 신규 폼 생성 의도 ("~폼 만들어줘", "~설문지 생성해줘")
   - 'createForm' 도구를 호출하여 DB에 생성하고 캔버스로 진입하세요.

4. 폼 발행 / 비발행 의도 ("~폼 발행해줘", "~공개해줘", "~초안으로 돌려줘")
   - 'publishForm' 도구를 호출하세요. isPublished: true(발행) 또는 false(초안).

5. 의도가 불분명하거나 모호한 경우
   - 성급하게 화면을 바꾸지 말고, 친절하게 되물으세요(Clarification).
`.trim();

/**
 * 빌더 화면 맥락 포맷터 (린 프롬프트 규격)
 */
export function formatBuilderContextPrompt(
  prompt: string,
  currentContext: NavigatorClientContext | undefined
): string {
  const currentPath = currentContext?.currentPath ?? "미지정";
  const currentFormContext = currentContext?.currentForm
    ? JSON.stringify(currentContext.currentForm)
    : "없음 (목록 또는 대시보드 화면)";

  // 1. 현재 화면에 렌더링된 폼 목록 캐시 (인덱스 순서 보장)
  let visibleFormsSummary = "없음 (현재 폼 목록 화면이 아니거나 로딩 중)";
  if (currentContext?.visibleForms && currentContext.visibleForms.length > 0) {
    visibleFormsSummary = currentContext.visibleForms
      .map(
        (f, idx) => `  ${idx + 1}. [ID: ${f.id}] ${f.title}${f.summary ? ` (${f.summary})` : ""}`
      )
      .join("\n");
  }

  return `사용자 발화: "${prompt}"

[현재 화면 상황 및 맥락]
- 현재 사용자 화면 경로: ${currentPath}
- 현재 열려있는 활성 폼 스펙: ${currentFormContext}
- 현재 화면 테이블에 표시된 폼 목록 (위에서부터 순서대로):
${visibleFormsSummary}

(알림: 화면에 없는 폼의 정보나 목록이 필요할 때는 'searchForms' 또는 'getFormDetails' 도구를 먼저 호출하여 확인하세요.)`;
}
