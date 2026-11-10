import "server-only";
import { generateText, stepCountIs } from "ai";
import {
  findActiveForms,
  findPublishedForms,
  findFormById,
  insertForm,
  updateFormById,
  publishFormById,
  softDeleteFormsByIds,
} from "@/entities/form/server";
import { softDeleteSubmissionsByIds } from "@/entities/form-submission/server";
import type { Form } from "@/entities/form";
import { getAiModel } from "@/shared/lib/ai";
import { createBuilderTools } from "../lib/tools/builder-tools";
import { createConsumerTools } from "../lib/tools/consumer-tools";
import { createQueryTools } from "../lib/tools/query-tools";
import {
  BUILDER_NAVIGATOR_SYSTEM_PROMPT,
  formatBuilderContextPrompt,
} from "../lib/prompts/builder-prompt";
import {
  CONSUMER_NAVIGATOR_SYSTEM_PROMPT,
  formatConsumerContextPrompt,
} from "../lib/prompts/consumer-prompt";
import type {
  ExecuteNavigatorPayload,
  NavigatorAction,
  NavigatorExecutionResponse,
} from "../types/navigator-action.types";

/**
 * AI Navigator 통합 오케스트레이션 엔진 (Server-Side)
 *
 * Builder 및 Consumer 두 모드의 도구 카탈로그, 시스템 프롬프트, 런타임 맥락을 통합 관리하며,
 * 도구 스스로가 반환하는 clientAction을 단일 매퍼로 수집하여 브라우저 제어 액션을 안전하게 도출합니다.
 *
 * @param payload 실행 요청 페이로드
 * @returns AI 답변 텍스트, 브라우저 제어 단일/복합 액션, 갱신된 폼 정보
 */
export async function runNavigatorEngine(
  payload: ExecuteNavigatorPayload
): Promise<NavigatorExecutionResponse> {
  const mode = payload.mode ?? "builder";
  const { prompt, messages, currentContext } = payload;

  const model = getAiModel();

  // 온디맨드 폼 조회 도구 인스턴스화 (서버 리포지토리 의존성 주입)
  const queryTools = createQueryTools({
    findActiveForms,
    findPublishedForms,
    findFormById,
  });

  if (mode === "consumer") {
    // ==========================================
    // 1. 컨슈머 모드 실행 (린 프롬프트 + 순수 브라우저 액션 도구 + 온디맨드 조회)
    // ==========================================
    const consumerTools = {
      ...createConsumerTools({
        softDeleteSubmissionsByIds,
      }),
      ...queryTools,
    };

    // 사전 전량 조회 호출 제거: 화면 맥락 기반의 린 프롬프트 생성
    const formattedPrompt = formatConsumerContextPrompt(prompt, currentContext);

    const conversationMessages = [
      ...(messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: formattedPrompt,
      },
    ];

    // stopWhen: stepCountIs(5)를 지정하여 [조회 도구로 팩트 확인 -> 액션 도출]을 단일 턴에서 완주
    const result = await generateText({
      model,
      instructions: CONSUMER_NAVIGATOR_SYSTEM_PROMPT,
      messages: conversationMessages,
      tools: consumerTools,
      stopWhen: stepCountIs(5),
    });

    const toolResults = result.toolResults ?? [];

    // 도구 실행 결과(toolResults)로부터 브라우저 제어용 clientAction 목록 추출
    const clientActions: NavigatorAction[] = toolResults
      .map((tr) => (tr.output as { clientAction?: NavigatorAction } | undefined)?.clientAction)
      .filter((act): act is NavigatorAction => Boolean(act));

    const singleAction: NavigatorAction | null =
      clientActions.length > 0 ? (clientActions[0] ?? null) : null;
    const reply = result.text || singleAction?.message || "요청을 처리했습니다.";

    return {
      reply,
      action: singleAction,
      actions: clientActions.length > 0 ? clientActions : undefined,
      message: reply,
    };
  }

  // ==========================================
  // 2. 빌더 모드 실행 (기본값)
  // ==========================================
  const builderTools = {
    ...createBuilderTools({
      findFormById,
      insertForm,
      updateFormById,
      publishFormById,
      softDeleteFormsByIds,
    }),
    ...queryTools,
  };

  // 사전 전량 조회 호출 제거: 화면 맥락 기반의 린 프롬프트 생성
  const formattedPrompt = formatBuilderContextPrompt(prompt, currentContext);

  const conversationMessages = [
    ...(messages ?? []).map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: formattedPrompt,
    },
  ];

  // stopWhen: stepCountIs(5)를 지정하여 [조회 도구로 팩트 확인 -> 액션 도출]을 단일 턴에서 완주
  const result = await generateText({
    model,
    instructions: BUILDER_NAVIGATOR_SYSTEM_PROMPT,
    messages: conversationMessages,
    tools: builderTools,
    stopWhen: stepCountIs(5),
  });

  const toolResults = result.toolResults ?? [];

  // 도구 실행 결과(toolResults)로부터 브라우저 제어용 clientAction 목록 추출
  const clientActions: NavigatorAction[] = toolResults
    .map((tr) => (tr.output as { clientAction?: NavigatorAction } | undefined)?.clientAction)
    .filter((act): act is NavigatorAction => Boolean(act));

  // 갱신된 폼 엔티티 수집
  const updatedForm = toolResults
    .map((tr) => tr.output as { form?: Form; updatedForm?: Form } | undefined)
    .reduce<Form | null>((_, out) => out?.updatedForm ?? out?.form ?? null, null);

  const singleAction: NavigatorAction | null =
    clientActions.length > 0 ? (clientActions[0] ?? null) : null;
  const reply = result.text || singleAction?.message || "요청을 처리했습니다.";

  return {
    reply,
    action: singleAction,
    actions: clientActions.length > 0 ? clientActions : undefined,
    updatedForm,
    message: reply,
  };
}
