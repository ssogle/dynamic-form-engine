import "server-only";
import { generateText } from "ai";
import {
  findActiveForms,
  findPublishedForms,
  findFormBySlug,
  insertForm,
  updateFormById,
  softDeleteFormById,
  softDeleteFormsBySlugs,
} from "@/entities/form/server";
import type { Form, CoreFormField } from "@/entities/form";
import { getAiModel } from "@/shared/lib/ai";
import { createBuilderTools } from "../lib/tools/builder-tools";
import { createConsumerTools } from "../lib/tools/consumer-tools";
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
  SchemaOperation,
} from "../types/navigator-action.types";

/**
 * AI Navigator 통합 오케스트레이션 엔진 (Server-Side)
 *
 * Builder 및 Consumer 두 모드의 도구 카탈로그, 시스템 프롬프트, 런타임 맥락을 통합 관리하며,
 * Vercel AI SDK의 표준 toolCalls 순회 패턴으로 클라이언트 액션을 일관되게 해석합니다.
 *
 * @param payload 실행 요청 페이로드
 * @returns AI 답변 텍스트, 브라우저 제어 액션, 갱신된 폼 정보
 */
export async function runNavigatorEngine(
  payload: ExecuteNavigatorPayload
): Promise<NavigatorExecutionResponse> {
  const mode = payload.mode ?? "builder";
  const { prompt, messages, currentContext } = payload;

  const model = getAiModel();

  if (mode === "consumer") {
    // ==========================================
    // 1. 컨슈머 모드 실행
    // ==========================================
    const consumerTools = createConsumerTools({
      findPublishedForms,
      findFormBySlug,
    });

    const publishedForms = await findPublishedForms();
    const formattedPrompt = formatConsumerContextPrompt(prompt, currentContext, publishedForms);

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

    const result = await generateText({
      model,
      instructions: CONSUMER_NAVIGATOR_SYSTEM_PROMPT,
      messages: conversationMessages,
      tools: consumerTools,
    });

    let clientAction: NavigatorAction | null = null;
    const toolResults = result.toolResults ?? [];

    for (const tr of toolResults) {
      const toolName = tr.toolName;
      const input = tr.input as Record<string, unknown>;

      if (toolName === "navigate") {
        clientAction = {
          type: "NAVIGATE",
          targetPath: input.targetPath as string,
          message: result.text || (input.reason as string) || "해당 화면으로 이동합니다.",
        };
      } else if (toolName === "fillFields") {
        clientAction = {
          type: "FILL_FIELDS",
          formSlug: input.formSlug as string,
          fields: input.fields as Record<string, unknown>,
          message: input.message as string,
        };
      } else if (toolName === "submitForm") {
        clientAction = {
          type: "SUBMIT_FORM",
          formSlug: input.formSlug as string,
          message: input.confirmationMessage as string,
        };
      }
    }

    const reply = result.text || clientAction?.message || "요청을 처리했습니다.";

    return {
      reply,
      action: clientAction,
      message: reply,
    };
  }

  // ==========================================
  // 2. 빌더 모드 실행 (기본값)
  // ==========================================
  const builderTools = createBuilderTools({
    findActiveForms,
    findFormBySlug,
    insertForm,
    updateFormById,
    softDeleteFormById,
    softDeleteFormsBySlugs,
  });

  const activeForms = await findActiveForms();
  const formattedPrompt = formatBuilderContextPrompt(prompt, currentContext, activeForms);

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

  const result = await generateText({
    model,
    instructions: BUILDER_NAVIGATOR_SYSTEM_PROMPT,
    messages: conversationMessages,
    tools: builderTools,
  });

  let clientAction: NavigatorAction | null = null;
  let updatedForm: Form | null = null;
  const toolResults = result.toolResults ?? [];

  for (const tr of toolResults) {
    const toolName = tr.toolName;
    const input = tr.input as Record<string, unknown>;
    const output = tr.output as Record<string, unknown> | undefined;

    if (toolName === "navigate") {
      clientAction = {
        type: "NAVIGATE",
        targetPath: input.targetPath as string,
        message: result.text || (input.reason as string) || "해당 화면으로 이동합니다.",
      };
    } else if (toolName === "createForm") {
      clientAction = {
        type: "CREATE_FORM",
        slug: input.slug as string,
        title: input.title as string,
        description: input.description as string | undefined,
        fields: (input.fields as CoreFormField[]) ?? [],
        message: result.text || `새로운 폼 '${input.title}'을 생성했습니다.`,
      };
      if (output && "form" in output) {
        updatedForm = output.form as Form;
      }
    } else if (toolName === "updateSchema") {
      const rawOp = input.operation as string;
      const op: SchemaOperation =
        rawOp === "UPDATE_INFO" || rawOp === "MODIFY_FIELD"
          ? "UPDATE_FIELD"
          : (rawOp as SchemaOperation);

      clientAction = {
        type: "UPDATE_SCHEMA",
        operation: op,
        field: input.fieldData as CoreFormField | undefined,
        fields: input.fields as CoreFormField[] | undefined,
        title: input.formTitle as string | undefined,
        slug: input.newSlug as string | undefined,
        message: result.text || "폼 스키마가 성공적으로 변경되었습니다.",
      };
      if (output && "updatedForm" in output) {
        updatedForm = output.updatedForm as Form;
      }
    } else if (toolName === "publishForm") {
      clientAction = {
        type: "PUBLISH_FORM",
        slug: input.formSlug as string,
        isPublished: input.isPublished as boolean,
        message:
          result.text ||
          (input.isPublished
            ? "폼이 공식 발행되었습니다. 응답자가 작성할 수 있습니다."
            : "폼 발행이 취소되어 초안 상태로 회수되었습니다."),
      };
    } else if (toolName === "deleteForms") {
      clientAction = {
        type: "DELETE_FORMS",
        deletedSlugs: (input.formSlugs as string[]) ?? [],
        message: result.text || "선택한 폼을 성공적으로 삭제했습니다.",
      };
    }
  }

  const reply = result.text || clientAction?.message || "요청을 처리했습니다.";

  return {
    reply,
    action: clientAction,
    updatedForm,
    message: reply,
  };
}
