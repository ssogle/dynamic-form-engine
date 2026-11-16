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
type ModeConfigFactory = (queryTools: ReturnType<typeof createQueryTools>) => NavigatorModeConfig;

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
  consumer: (queryTools) => ({
    instructions: CONSUMER_NAVIGATOR_SYSTEM_PROMPT,
    tools: {
      ...createConsumerTools({ softDeleteSubmissionsByIds }),
      ...queryTools,
    },
    formatPrompt: formatConsumerContextPrompt,
  }),
  builder: (queryTools) => ({
    instructions: BUILDER_NAVIGATOR_SYSTEM_PROMPT,
    tools: {
      ...createBuilderTools({
        findFormById,
        hasSubmissionsByFormId,
        insertForm,
        updateFormById,
        publishFormById,
        softDeleteFormsByIds,
      }),
      ...queryTools,
    },
    formatPrompt: formatBuilderContextPrompt,
    extractExtras: (toolResults) => ({
      updatedForm: extractUpdatedForm(toolResults) ?? undefined,
    }),
  }),
  analyst: (queryTools) => ({
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
  queryTools: ReturnType<typeof createQueryTools>
): NavigatorModeConfig {
  const factory = NAVIGATOR_MODE_REGISTRY[mode];
  if (!factory) {
    throw new Error(`지원하지 않는 네비게이터 모드입니다: "${mode}"`);
  }
  return factory(queryTools);
}

/**
 * AI Navigator 통합 오케스트레이션 엔진 (Server-Side)
 *
 * 모드 레지스트리(NAVIGATOR_MODE_REGISTRY)로부터 획득한 전략 설정을 바탕으로,
 * 모드 무관(Mode-Agnostic)한 단일 파이프라인을 완주하여 브라우저 제어 액션을 안전하게 도출합니다.
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

  // 1. 공통 온디맨드 폼 조회 도구 인스턴스화
  const queryTools = createQueryTools({
    findActiveForms,
    findPublishedForms,
    findFormById,
  });

  // 2. 모드 레지스트리로부터 전용 전략 설정 획득 (신규 모드 추가 시 본체 불변)
  const config = resolveModeConfig(mode, queryTools);

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

  // 4. 단일 LLM 추론 완주 (모드별 maxSteps 적용, 기본 5단계)
  const result = await generateText({
    model,
    instructions: config.instructions,
    messages: conversationMessages,
    tools: config.tools,
    stopWhen: stepCountIs(config.maxSteps ?? 5),
  });

  const toolResults = (result.toolResults ?? []) as Array<{ output: unknown }>;

  // 5. 공통 액션 추출 및 모드별 특화 부가 데이터 수집
  const clientActions = extractClientActions(toolResults);
  const singleAction: NavigatorAction | null = clientActions[0] ?? null;
  const extras = config.extractExtras ? config.extractExtras(toolResults) : {};
  const reply = result.text || singleAction?.message || "요청을 처리했습니다.";

  // 6. 통합 단일 반환
  return {
    reply,
    action: singleAction,
    actions: clientActions.length > 0 ? clientActions : undefined,
    message: reply,
    ...extras,
  };
}
