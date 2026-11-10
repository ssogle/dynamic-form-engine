import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * 프로젝트 전역 AI 모델 티어 식별자
 *
 * 소비자는 특정 AI 제공사(벤더) 이름이 아닌 범용 티어(DEFAULT, NORMAL, LITE 등)를 참조합니다.
 */
export const AI_MODELS = {
  /**
   * 기본 설정 모델
   */
  DEFAULT: "gemini-flash-lite-latest",

  /**
   * 고성능/표준 멀티모달 모델
   * 복잡한 문서 분석, 폼 스키마 생성 및 정밀한 도구 호출(Tool Calling)에 권장됩니다.
   */
  NORMAL: "gemini-flash-latest",

  /**
   * 초경량/초고속 저비용 모델
   * 단순 텍스트 분류, 빠른 요약 및 즉각적인 라우팅 판별에 최적화되어 있습니다.
   */
  LITE: "gemini-flash-lite-latest",
} as const;

export type AiModelTier = (typeof AI_MODELS)[keyof typeof AI_MODELS] | (string & {});

/**
 * 내부 AI Provider 인스턴스 팩토리
 * (현재는 Google Generative AI를 기본 공급자로 사용하며, 환경변수 및 키를 캡슐화합니다)
 */
function createDefaultProvider() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("AI_API_KEY(GEMINI_API_KEY) 환경 변수가 설정되지 않았습니다.");
  }

  return createGoogleGenerativeAI({
    apiKey: apiKey ?? "",
  });
}

/**
 * Vercel AI SDK와 호환되는 표준 LanguageModel 인스턴스를 반환합니다.
 * 호출자는 제공사(벤더) 세부사항을 알 필요 없이 getAiModel()을 호출하여 사용합니다.
 *
 * @param modelTier 사용할 모델 티어 또는 식별자 (기본값: AI_MODELS.DEFAULT)
 * @returns Vercel AI SDK generateText / streamText 등에 전달 가능한 언어 모델 객체
 */
export function getAiModel(modelTier: AiModelTier = AI_MODELS.DEFAULT) {
  const provider = createDefaultProvider();
  return provider(modelTier);
}
