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
import {
  findAnalysisViewById,
  insertAnalysisView,
  publishAnalysisViewById,
  softDeleteAnalysisViewsByIds,
  updateAnalysisViewById,
} from "@/entities/analysis-view/server";
import type { AnalysisView } from "@/entities/analysis-view";
import {
  aggregateFormSubmissions,
  findInboundRelatedSubmissions,
  hasSubmissionsByFormId,
  queryFormSubmissionsForAnalysis,
  softDeleteSubmissionsByIds,
} from "@/entities/form-submission/server";
import type { Form } from "@/entities/form";
import { getAiModel } from "@/shared/lib/ai";
import { createAnalystTools } from "../lib/tools/analyst-tools";
import { createBuilderTools } from "../lib/tools/builder-tools";
import { createConsumerTools } from "../lib/tools/consumer-tools";
import { createQueryTools } from "../lib/tools/query-tools";
import {
  ANALYST_NAVIGATOR_SYSTEM_PROMPT,
  formatAnalystContextPrompt,
} from "../lib/prompts/analyst-prompt";
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
  NavigatorClientContext,
  NavigatorExecutionResponse,
  NavigatorMode,
} from "../types/navigator-action.types";

/**
 * 도구 실행 결과로부터 모드별 특화 부가 데이터(예: 빌더 모드의 updatedForm)를 추출한 결과
 */
export interface NavigatorPostExecutionExtras {
  /** 갱신된 폼 엔티티 (빌더 모드 전용) */
  updatedForm?: Form | undefined;
  /** 갱신/생성된 분석 뷰 엔티티 (분석가 모드 전용) */
  updatedAnalysisView?: AnalysisView | undefined;
}

/**
 * 모드별 네비게이터 실행 전략(Strategy) 설정 인터페이스
 */
export interface NavigatorModeConfig {
  /** LLM 시스템 지침 프롬프트 */
  instructions: string;
  /** 해당 모드에서 사용할 도구 카탈로그 */
  tools: ReturnType<typeof createQueryTools> &
    (
      | ReturnType<typeof createBuilderTools>
      | ReturnType<typeof createConsumerTools>
      | ReturnType<typeof createAnalystTools>
    );
  /** 화면 맥락 기반의 린(Lean) 프롬프트 포맷터 */
  formatPrompt: (prompt: string, context?: NavigatorClientContext) => string;
  /** 최대 에이전트 스텝 수 (기본값 5, 다중 집계/작성 워크플로우는 10 등) */
  maxSteps?: number | undefined;
  /** 도구 실행 결과에서 모드별 부가 데이터를 추출하는 선택적 훅 */
  extractExtras?: (toolResults: Array<{ output: unknown }>) => NavigatorPostExecutionExtras;
}

/**
 * 모드별 설정 팩토리 함수 타입
 */
type ModeConfigFactory = (
  queryTools: ReturnType<typeof createQueryTools>,
  currentContext?: NavigatorClientContext
) => NavigatorModeConfig;

/**
 * AI 도구 실행 결과(toolResults)로부터 클라이언트 브라우저 제어용 액션 목록을 추출합니다.
 */
function extractClientActions(toolResults: Array<{ output: unknown }>): NavigatorAction[] {
  return toolResults
    .map((tr) => (tr.output as { clientAction?: NavigatorAction } | undefined)?.clientAction)
    .filter((act): act is NavigatorAction => Boolean(act));
}

/**
 * 빌더 도구 실행 결과로부터 갱신된 폼 엔티티를 추출합니다.
 */
function extractUpdatedForm(toolResults: Array<{ output: unknown }>): Form | null {
  return toolResults
    .map((tr) => tr.output as { form?: Form; updatedForm?: Form } | undefined)
    .reduce<Form | null>((_, out) => out?.updatedForm ?? out?.form ?? null, null);
}

/**
 * 분석가 도구 실행 결과로부터 생성/수정된 분석 뷰 엔티티를 추출합니다.
 */
function extractUpdatedAnalysisView(toolResults: Array<{ output: unknown }>): AnalysisView | null {
  return toolResults
    .map(
      (tr) =>
        tr.output as { analysisView?: AnalysisView; updatedAnalysisView?: AnalysisView } | undefined
    )
    .reduce<AnalysisView | null>(
      (prev, out) => out?.updatedAnalysisView ?? out?.analysisView ?? prev,
      null
    );
}

/**
 * 모드별 네비게이터 전략 레지스트리 맵 (Registry Pattern)
 *
 * 새로운 에이전트 모드가 추가될 때 본체 오케스트레이터를 수정할 필요 없이,
 * 본 맵에 선언적으로 도구와 프롬프트 팩토리를 등록하여 손쉽게 확장할 수 있습니다.
 */
const NAVIGATOR_MODE_REGISTRY: Record<NavigatorMode, ModeConfigFactory> = {
  consumer: (queryTools, currentContext) => ({
    instructions: CONSUMER_NAVIGATOR_SYSTEM_PROMPT,
    tools: {
      ...createConsumerTools({
        softDeleteSubmissionsByIds,
        findFormById,
        currentFormId: currentContext?.currentFormId,
        initialDraftValues: currentContext?.currentDraftValues,
      }),
      ...queryTools,
    },
    formatPrompt: formatConsumerContextPrompt,
  }),
  builder: (queryTools, currentContext) => ({
    instructions: BUILDER_NAVIGATOR_SYSTEM_PROMPT,
    tools: {
      ...createBuilderTools({
        findFormById,
        hasSubmissionsByFormId,
        insertForm,
        updateFormById,
        publishFormById,
        softDeleteFormsByIds,
        expectedFormId: currentContext?.currentForm?.id,
        expectedFormVersion: currentContext?.currentForm?.version,
      }),
      ...queryTools,
    },
    formatPrompt: formatBuilderContextPrompt,
    extractExtras: (toolResults) => ({
      updatedForm: extractUpdatedForm(toolResults) ?? undefined,
    }),
  }),
  analyst: (queryTools, currentContext) => ({
    instructions: ANALYST_NAVIGATOR_SYSTEM_PROMPT,
    maxSteps: 10,
    tools: {
      ...createAnalystTools({
        findAnalysisViewById,
        insertAnalysisView,
        updateAnalysisViewById,
        publishAnalysisViewById,
        softDeleteAnalysisViewsByIds,
        aggregateFormSubmissions,
        queryFormSubmissionsForAnalysis,
        expectedViewId: currentContext?.currentAnalysisView?.id,
        expectedViewVersion: currentContext?.currentAnalysisView?.version,
      }),
      ...queryTools,
    },
    formatPrompt: formatAnalystContextPrompt,
    extractExtras: (toolResults) => ({
      updatedAnalysisView: extractUpdatedAnalysisView(toolResults) ?? undefined,
    }),
  }),
};

/**
 * 런타임 모드(builder | consumer 등)에 대응하는 전략 설정을 레지스트리에서 탐색합니다.
 */
function resolveModeConfig(
  mode: NavigatorMode,
  queryTools: ReturnType<typeof createQueryTools>,
  currentContext?: NavigatorClientContext
): NavigatorModeConfig {
  const factory = NAVIGATOR_MODE_REGISTRY[mode];
  if (!factory) {
    throw new Error(`지원하지 않는 네비게이터 모드입니다: "${mode}"`);
  }
  return factory(queryTools, currentContext);
}

export interface RunNavigatorEngineOptions {
  /** 다중 스텝 실행 중 단계별 진행 상태 텍스트를 수신하기 위한 선택적 콜백 (스트리밍 응답용) */
  onProgress?: ((statusText: string) => void) | undefined;
  /** 클라이언트 연결 해제 또는 스트림 취소 시 LLM 호출을 즉시 중단하기 위한 AbortSignal */
  abortSignal?: AbortSignal | undefined;
}

function resolveStepStartProgressMessage(stepNumber: number): string {
  if (stepNumber === 0) {
    return "AI가 요청을 분석해 작업 계획을 세우고 있습니다...";
  }
  return `추가 분석 단계(${stepNumber + 1}단계)를 진행하고 있습니다...`;
}

function resolveToolStartProgressMessage(toolName: string): string {
  if (
    ["aggregateFormSubmissions", "queryFormSubmissions", "computeSeriesMetric"].includes(toolName)
  ) {
    return "데이터베이스에서 최신 데이터를 집계·조회하고 있습니다...";
  }
  if (["searchForms", "getFormDetails"].includes(toolName)) {
    return "대상 폼 구조와 필드 정보를 확인하고 있습니다...";
  }
  if (toolName === "getRelatedSubmissions") {
    return "연결된 관계(relations) 이력을 조회하고 있습니다...";
  }
  if (
    [
      "createAnalysisView",
      "updateAnalysisView",
      "publishAnalysisView",
      "deleteAnalysisViews",
    ].includes(toolName)
  ) {
    return "분석 뷰 문서를 최신 상태로 반영하고 있습니다...";
  }
  if (["createForm", "updateFormSchema", "publishForm", "deleteForms"].includes(toolName)) {
    return "폼 스키마 및 상태를 반영하고 있습니다...";
  }
  if (toolName === "applySubmissionListQuery") {
    return "요청한 필터와 정렬 조건을 목록에 반영하고 있습니다...";
  }
  return "요청 작업을 실행하고 있습니다...";
}

function resolveStepEndProgressMessage(toolNames: string[], finishReason: string): string {
  if (finishReason === "stop") {
    return "응답 작성을 완료했습니다.";
  }
  if (
    toolNames.some((name) =>
      ["createAnalysisView", "updateAnalysisView", "publishAnalysisView"].includes(name)
    )
  ) {
    return "분석 뷰 문서를 반영했습니다. 요약 응답을 작성하고 있습니다...";
  }
  if (
    toolNames.some((name) =>
      ["aggregateFormSubmissions", "queryFormSubmissions", "computeSeriesMetric"].includes(name)
    )
  ) {
    return "데이터 집계·조회를 마쳤습니다. 분석 결과를 구성하고 있습니다...";
  }
  if (
    toolNames.some((name) =>
      ["searchForms", "getFormDetails", "getRelatedSubmissions"].includes(name)
    )
  ) {
    return "폼 구조 및 연결 정보를 확인했습니다. 다음 작업을 진행하고 있습니다...";
  }
  if (
    toolNames.some((name) =>
      ["createForm", "updateFormSchema", "publishForm", "deleteForms"].includes(name)
    )
  ) {
    return "폼 설정을 반영했습니다. 결과를 정리하고 있습니다...";
  }
  return "도구 실행을 마치고 다음 단계를 진행하고 있습니다...";
}

/**
 * AI Navigator 통합 오케스트레이션 엔진 (Server-Side)
 *
 * 모드 레지스트리(NAVIGATOR_MODE_REGISTRY)로부터 획득한 전략 설정을 바탕으로,
 * 모드 무관(Mode-Agnostic)한 단일 파이프라인을 완주하여 브라우저 제어 액션을 안전하게 도출합니다.
 *
 * @param payload 실행 요청 페이로드
 * @param options 진행 상태 콜백 등 선택적 실행 옵션
 * @returns AI 답변 텍스트, 브라우저 제어 단일/복합 액션, 갱신된 폼 정보
 */
export async function runNavigatorEngine(
  payload: ExecuteNavigatorPayload,
  options?: RunNavigatorEngineOptions
): Promise<NavigatorExecutionResponse> {
  const mode = payload.mode ?? "builder";
  const { prompt, messages, currentContext } = payload;

  const model = getAiModel();

  // 1. 공통 온디맨드 폼·관계 조회 도구 인스턴스화
  const queryTools = createQueryTools({
    findActiveForms,
    findPublishedForms,
    findFormById,
    findInboundRelatedSubmissions,
  });

  // 2. 모드 레지스트리로부터 전용 전략 설정 획득 (신규 모드 추가 시 본체 불변)
  const config = resolveModeConfig(mode, queryTools, currentContext);

  // 3. 화면 맥락 기반의 린(Lean) 프롬프트 및 대화 메시지 목록 구성
  const formattedPrompt = config.formatPrompt(prompt, currentContext);
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

  // 4. 단일 LLM 추론 완주 (Thinking 예산 상한 512 제한, 스텝/전체 타임아웃 및 무응답 재시도 차단 적용)
  const startedAt = Date.now();
  let stepIndex = 0;
  let lastStepFinishReason: string | undefined;

  options?.onProgress?.("요청을 분석하고 필요한 작업을 준비하고 있습니다...");

  const result = await generateText({
    model,
    instructions: config.instructions,
    messages: conversationMessages,
    tools: config.tools,
    stopWhen: stepCountIs(config.maxSteps ?? 5),
    maxRetries: 0,
    timeout: {
      stepMs: 25_000,
      totalMs: 65_000,
    },
    ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 512,
        },
      },
    },
    onStepStart: ({ stepNumber }) => {
      options?.onProgress?.(resolveStepStartProgressMessage(stepNumber));
    },
    onToolExecutionStart: ({ toolCall }) => {
      options?.onProgress?.(resolveToolStartProgressMessage(toolCall.toolName));
    },
    onStepEnd: (step) => {
      stepIndex += 1;
      lastStepFinishReason = step.finishReason;
      const toolNames = (step.toolCalls ?? []).map((tc) => tc.toolName);
      options?.onProgress?.(resolveStepEndProgressMessage(toolNames, step.finishReason));
      if (process.env.NODE_ENV !== "test") {
        console.info(
          `[Navigator:${mode}] step=${stepIndex} finishReason=${step.finishReason} elapsed=${Date.now() - startedAt}ms tools=[${toolNames.join(", ")}]`
        );
      }
    },
    onStepError: ({ stepNumber, error }) => {
      if (process.env.NODE_ENV !== "test") {
        console.error(
          `[Navigator:${mode}] step=${stepNumber + 1} error elapsed=${Date.now() - startedAt}ms`,
          error
        );
      }
    },
  });

  const toolResults = (result.toolResults ?? []) as Array<{ output: unknown }>;

  // 5. 공통 액션 추출 및 모드별 특화 부가 데이터 수집
  const clientActions = extractClientActions(toolResults);
  const singleAction: NavigatorAction | null = clientActions[0] ?? null;
  const extras = config.extractExtras ? config.extractExtras(toolResults) : {};
  const resolvedFinishReason = result.finishReason ?? lastStepFinishReason;
  const fallbackReply =
    resolvedFinishReason && resolvedFinishReason !== "stop" && clientActions.length === 0
      ? "처리 단계가 많아 작업을 끝까지 완료하지 못했습니다. 조건을 좁히거나 나누어 다시 요청해 주세요."
      : "요청을 처리했습니다.";
  const reply = result.text || singleAction?.message || fallbackReply;

  // 6. 통합 단일 반환
  return {
    reply,
    action: singleAction,
    actions: clientActions.length > 0 ? clientActions : undefined,
    message: reply,
    ...extras,
  };
}
