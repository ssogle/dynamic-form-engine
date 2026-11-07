import "server-only";
import { generateText } from "ai";
import {
  findActiveForms,
  findFormBySlug,
  insertForm,
  updateFormById,
  softDeleteFormById,
  softDeleteFormsBySlugs,
} from "@/entities/form/server";
import type { ActiveForm, CoreFormField } from "@/entities/form";
import { getAiModel } from "@/shared/lib/ai";
import { createNavigatorTools, extractFieldsFromForm } from "../lib/navigator-tools";
import { sanitizeSlug } from "../lib/action-parser";
import type {
  ExecuteNavigatorActionPayload,
  NavigatorAction,
  NavigatorExecutionResponse,
} from "../types/action.types";

/**
 * AI Navigator 지능형 시스템 지침 (Full Context Awareness)
 */
export const NAVIGATOR_SYSTEM_PROMPT = `
당신은 마우스 수동 편집 없이 자연어로 애플리케이션 화면 전체를 자율주행하는 'AI Navigator'입니다.
전체 시스템 상황과 현재 화면 맥락, 그리고 이전 대화 흐름을 바탕으로 사용자의 의도를 지능적으로 판단하여 적절한 도구를 호출하거나 답변하세요.

[지능적 의도 판단 및 행동 규칙]
1. 폼 열기 / 편집 진입 의도 ("~폼 수정할게", "~폼 열어줘", "~폼으로 가줘"):
   - 사용자가 특정 폼을 작업하고 싶어 하는 경우, 등록된 폼 목록에서 해당 폼의 슬러그를 찾아 라이브 캔버스 경로('/builder/forms/[slug]')로 'navigate' 도구를 호출하세요.
   - 단, 사용자가 이미 해당 폼 캔버스 화면에 머물고 있다면 재이동할 필요 없이 변경할 내용을 대화창에서 바로 물어보세요.
2. 단순 내용 조회 의도 ("~폼에 무슨 필드 있어?", "~폼 내용 보여줘", "등록된 폼 뭐 있어?"):
   - 화면을 이동하지 말고(도구 호출 없이 또는 listForms 활용), 해당 폼의 정보와 필드를 대화창에 친절하게 정리하여 답변하세요.
3. 신규 폼 생성 의도 ("~폼 만들어줘", "~설문지 생성해줘"):
   - 'createForm' 도구를 호출하여 DB에 생성하고 캔버스로 진입하세요.
4. 현재 폼 필드 조작 의도 (필드 추가, 수정, 삭제, 제목/슬러그 변경):
   - 현재 열려있는 폼에 대해 'updateSchema' 도구를 호출하세요. 절대로 createForm을 새로 호출하지 마세요.
   - 복합 수정(예: "~빼고 ~넣어줘", 필드 순서 변경, 여러 필드 일괄 추가/삭제)은 operation: "SET_ALL_FIELDS"와 완성된 'fields' 배열을 전달하세요.
5. 폼 발행 / 비발행 의도 ("~폼 발행해줘", "~공개해줘", "~발행 취소해줘", "~초안으로 돌려줘"):
   - 'publishForm' 도구를 호출하세요. isPublished: true(발행) 또는 false(비발행/초안)를 지정하세요.
6. 폼 삭제 의도 ("~폼 삭제해줘", "~폼이랑 ~폼 지워줘"):
   - 'deleteForms' 도구를 호출하여 DB에서 일괄 소프트 삭제하세요 (단일 삭제 시에도 formSlugs 배열에 담아 전달). 삭제 후 폼 목록 화면으로 이동을 안내하세요.
7. 의도가 완전히 불분명하거나 모호한 경우:
   - 성급하게 화면을 바꾸지 말고, 캔버스를 열지 내용을 확인할지 친절하게 되물으세요(Clarification).
`.trim();

/**
 * 입체적 화면 및 시스템 맥락을 반영한 사용자 프롬프트 포맷팅
 *
 * @param prompt 사용자 입력 프롬프트
 * @param currentContext 클라이언트 화면 컨텍스트
 * @param activeForms DB에 등록된 활성 폼 목록
 * @returns 시스템 상황이 병합된 최종 사용자 프롬프트
 */
export function formatUserContextPrompt(
  prompt: string,
  currentContext: ExecuteNavigatorActionPayload["currentContext"],
  activeForms: Awaited<ReturnType<typeof findActiveForms>>
): string {
  const currentPath = currentContext?.currentPath ?? "미지정";
  const currentFormContext = currentContext?.currentForm
    ? JSON.stringify(currentContext.currentForm)
    : "없음 (목록 또는 대시보드 화면)";

  const availableFormsSummary =
    activeForms.length > 0
      ? activeForms
          .map(
            (f) => `- ${f.title} (슬러그: ${f.slug}, 필드: ${extractFieldsFromForm(f).length}개)`
          )
          .join("\n")
      : "- 등록된 폼 없음";

  return `사용자 발화: "${prompt}"

[전체 시스템 상황 및 화면 맥락]
- 현재 사용자 화면 경로: ${currentPath}
- 현재 열려있는 활성 폼: ${currentFormContext}
- 시스템에 등록된 전체 폼 목록:
${availableFormsSummary}`;
}

/**
 * AI Navigator 코어 오케스트레이션 엔진
 *
 * 데이터베이스 컨텍스트 조회, 프롬프트 조합, Vercel AI SDK 도구 추론 실행,
 * 그리고 최종 브라우저 제어 액션 매핑을 전담하는 순수 비즈니스 서비스 함수입니다.
 *
 * @param payload 네비게이터 실행 요청 데이터
 * @returns AI 답변 텍스트, 브라우저 제어 액션, 갱신된 폼 정보 및 도구 호출 로그
 */
export async function runNavigatorEngine(
  payload: ExecuteNavigatorActionPayload
): Promise<NavigatorExecutionResponse> {
  const { prompt, messages, currentContext } = payload;

  // 1. 도구 카탈로그 생성 (서버 DB 의존성 주입)
  const navigatorTools = createNavigatorTools({
    findActiveForms,
    findFormBySlug,
    insertForm,
    updateFormById,
    softDeleteFormById,
    softDeleteFormsBySlugs,
  });

  // 2. 전체 상황 맥락 수집: 등록된 활성 폼 목록 조회
  const allActiveForms = await findActiveForms();
  const userContextPrompt = formatUserContextPrompt(prompt, currentContext, allActiveForms);

  // 3. 이전 대화 히스토리와 최종 사용자 메시지 결합
  const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user" as const,
      content: userContextPrompt,
    },
  ];

  // 4. 범용 AI 모델을 통한 도구 호출 추론 및 실행
  const model = getAiModel();
  const result = await generateText({
    model,
    instructions: NAVIGATOR_SYSTEM_PROMPT,
    messages: conversationMessages,
    tools: navigatorTools,
  });

  // 5. 실행된 도구 결과를 분석하여 프론트엔드 액션 매핑
  let clientAction: NavigatorAction | null = null;
  let updatedForm: ActiveForm | null = null;

  const toolCalls = result.toolCalls ?? [];

  for (const call of toolCalls) {
    if (call.toolName === "navigate") {
      const input = call.input as { targetPath: string };
      clientAction = {
        type: "NAVIGATE",
        targetPath: input.targetPath,
        message: result.text || "해당 화면으로 이동합니다.",
      };
    } else if (call.toolName === "createForm") {
      const input = call.input as {
        slug: string;
        title: string;
        description?: string;
        fields?: CoreFormField[];
      };
      clientAction = {
        type: "CREATE_FORM",
        slug: input.slug,
        title: input.title,
        description: input.description,
        fields: input.fields ?? [],
        message: result.text || `'${input.title}' 폼이 성공적으로 생성되었습니다.`,
      };

      const freshForm = await findFormBySlug(input.slug);
      if (freshForm) {
        updatedForm = {
          slug: freshForm.slug,
          title: freshForm.title,
          description: freshForm.description ?? undefined,
          fields: extractFieldsFromForm(freshForm),
          publishedAt: freshForm.publishedAt,
        };
      }
    } else if (call.toolName === "updateSchema") {
      const input = call.input as {
        formSlug: string;
        operation: "ADD_FIELD" | "REMOVE_FIELD" | "MODIFY_FIELD" | "UPDATE_INFO" | "SET_ALL_FIELDS";
        targetFieldId?: string;
        fieldData?: Partial<CoreFormField>;
        fields?: CoreFormField[];
        newSlug?: string;
        formTitle?: string;
        formDescription?: string;
      };

      const targetSlug = input.newSlug ? sanitizeSlug(input.newSlug) : input.formSlug;

      clientAction = {
        type: "UPDATE_SCHEMA",
        formSlug: targetSlug,
        operation: input.operation,
        targetFieldId: input.targetFieldId,
        fieldData: input.fieldData,
        fields: input.fields,
        newSlug: input.newSlug,
        formTitle: input.formTitle,
        formDescription: input.formDescription,
        message: result.text || "폼 스키마가 성공적으로 업데이트되었습니다.",
      };

      const freshForm = await findFormBySlug(targetSlug);
      if (freshForm) {
        updatedForm = {
          slug: freshForm.slug,
          title: freshForm.title,
          description: freshForm.description ?? undefined,
          fields: extractFieldsFromForm(freshForm),
          publishedAt: freshForm.publishedAt,
        };
      }
    } else if (call.toolName === "deleteForm" || call.toolName === "deleteForms") {
      const slugs =
        call.toolName === "deleteForms"
          ? (call.input as { formSlugs: string[] }).formSlugs
          : [(call.input as { formSlug: string }).formSlug];

      clientAction = {
        type: "NAVIGATE",
        targetPath: "/builder/forms",
        message:
          result.text || `'${slugs.join(", ")}' 폼이 삭제되었습니다. 폼 목록 화면으로 이동합니다.`,
      };
    } else if (call.toolName === "publishForm") {
      const input = call.input as { formSlug: string; isPublished: boolean };
      const freshForm = await findFormBySlug(input.formSlug);

      clientAction = {
        type: "PUBLISH_FORM",
        formSlug: input.formSlug,
        isPublished: input.isPublished,
        publishedAt: freshForm?.publishedAt?.toISOString() ?? null,
        message:
          result.text ||
          (input.isPublished
            ? `'${freshForm?.title ?? input.formSlug}' 폼이 공식 발행되었습니다.`
            : `'${freshForm?.title ?? input.formSlug}' 폼이 초안(비발행) 상태로 전환되었습니다.`),
      };

      if (freshForm) {
        updatedForm = {
          slug: freshForm.slug,
          title: freshForm.title,
          description: freshForm.description ?? undefined,
          fields: extractFieldsFromForm(freshForm),
          publishedAt: freshForm.publishedAt,
        };
      }
    }
  }

  const finalReply =
    result.text || clientAction?.message || "요청하신 작업을 성공적으로 완료했습니다.";

  return {
    reply: finalReply,
    action: clientAction,
    updatedForm,
    toolCalls: toolCalls.map((c) => ({
      toolName: c.toolName,
      args: (c.input ?? {}) as Record<string, unknown>,
    })),
  };
}
