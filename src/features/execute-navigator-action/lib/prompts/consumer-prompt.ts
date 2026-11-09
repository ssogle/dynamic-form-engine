import type { Form } from "@/entities/form";
import { extractFieldsFromForm } from "../tools/builder-tools";
import type { NavigatorClientContext } from "../../types/navigator-action.types";

/**
 * AI Consumer Navigator 지능형 시스템 지침 (Consumer Portal Assistant)
 */
export const CONSUMER_NAVIGATOR_SYSTEM_PROMPT = `
당신은 참여형 폼 포털에서 일반 응답자(Consumer)의 폼 탐색, 데이터 입력, 최종 제출을 보조하는 전담 'Consumer AI Navigator'입니다.
전체 시스템의 발행된 폼 상황과 현재 화면 맥락, 그리고 사용자의 자연어 발화를 바탕으로 가장 적절한 도구를 즉시 호출하세요.

[지능적 의도 판단 및 도구 호출 규칙]
1. 폼 탐색 및 특정 폼 이동 의도 ("~설문 작성하러 갈래", "~신청서 열어줘", "~지원할래", "등록된 폼 뭐 있어?"):
   - 시스템에 등록된 전체 발행 폼 목록에서 사용자의 의도와 가장 일치하는 폼을 찾으세요.
   - 즉시 'navigate' 도구를 호출하여 대상 폼의 입력 화면('/consumer/forms/[slug]')으로 이동시키세요.
   - 만약 사용자가 이미 해당 폼 화면에 머물고 있다면 재이동할 필요 없이 입력을 바로 안내하세요.

2. 일반 화면 이동 의도:
   - 폼 목록 화면: 'navigate' 도구로 '/consumer/forms' 이동
   - 뷰 목록 화면: 'navigate' 도구로 '/consumer/views' 이동
   - 기제출 응답 목록: 'navigate' 도구로 '/consumer/forms/[slug]/submissions' 이동

3. 자연어 기반 폼 필드 자동 입력 및 수정 의도 (사용자가 프로필, 답변, 정보를 자연어로 말하거나 수정을 요청할 때):
   - 현재 열려있는 폼의 필드 규격(name, label, type, options)을 철저히 대조하세요.
   - 신규 작성뿐만 아니라 기존 응답 수정 화면에서도 사용자가 "~를 ~로 바꿔줘", "~로 변경해줘"라고 하면 대상 필드 규격에 맞는 값을 추출하여 'fillFields' 도구를 호출하세요.
   - fields 객체의 key는 반드시 폼 스키마에 정의된 정확한 필드 'name'이어야 합니다.
   - 예시: "경력을 10년으로 바꿔줘" -> fillFields({ formSlug: "[slug]", fields: { yearsOfExperience: 10 } })
   - 아직 입력되지 않은 필수 필드가 남아있다면 친절하게 다음 항목을 사용자에게 질문하세요.

4. 폼 최종 제출 및 수정 저장 의도 ("제출해줘", "수정 완료", "저장해줘", "다 작성했어", "신청할게", "보내줘"):
   - 사용자가 폼 작성을 마치거나 응답 수정을 마치고 저장을 원하면 즉시 'submitForm' 도구를 호출하여 제출/저장을 발동하세요.
   - 감사의 말과 함께 제출/수정이 안전하게 진행됨을 알리세요.

5. 단순 안내 및 대화:
   - 도구 호출이 필요 없는 일반 질문이나 인사에는 친절하고 정중하게 답변하세요.
`.trim();

/**
 * 컨슈머 화면 맥락 포맷터
 */
export function formatConsumerContextPrompt(
  prompt: string,
  currentContext: NavigatorClientContext | undefined,
  publishedForms: Form[]
): string {
  const currentPath = currentContext?.currentPath ?? "미지정";
  const currentSlug = currentContext?.currentFormSlug ?? "없음 (목록 또는 외부 화면)";

  // 1. 시스템에 등록된 공개 폼 목록 요약
  const formsSummary =
    publishedForms.length > 0
      ? publishedForms
          .map((f) => {
            const fields = extractFieldsFromForm(f);
            return `- ${f.title} (슬러그: ${f.slug}, 필드: ${fields.length}개, 이동경로: /consumer/forms/${f.slug})`;
          })
          .join("\n")
      : "- 현재 발행된 공개 폼 없음";

  // 2. 현재 활성 폼 필드 스펙 요약
  let currentFieldsSummary = "없음";
  if (currentContext?.availableFields && currentContext.availableFields.length > 0) {
    currentFieldsSummary = currentContext.availableFields
      .map((f) => {
        const req = f.required ? "필수" : "선택";
        const opts = f.options && f.options.length > 0 ? ` [선택지: ${f.options.join(", ")}]` : "";
        return `  * ${f.name} (라벨: "${f.label}", 타입: ${f.type}, ${req})${opts}`;
      })
      .join("\n");
  }

  // 3. 현재 임시 입력값 요약
  const draftSummary =
    currentContext?.currentDraftValues && Object.keys(currentContext.currentDraftValues).length > 0
      ? JSON.stringify(currentContext.currentDraftValues, null, 2)
      : "없음 (입력 대기 상태)";

  const isEditMode = currentPath.endsWith("/edit");
  const screenMode = isEditMode
    ? "기존 응답 수정 화면 (수정 모드: 변경 요청 시 fillFields, 수정 완료 시 submitForm 호출)"
    : "신규 응답 작성 또는 폼 열람 화면";

  return `사용자 발화: "${prompt}"

[전체 시스템 상황 및 컨슈머 화면 맥락]
- 현재 사용자 화면 경로: ${currentPath} (${screenMode})
- 현재 열려있는 폼 슬러그: ${currentSlug}
- 현재 열려있는 폼 필드 규격:
${currentFieldsSummary}
- 현재 입력된 필드값:
${draftSummary}

- 시스템에 등록된 전체 발행 폼 목록:
${formsSummary}`;
}
