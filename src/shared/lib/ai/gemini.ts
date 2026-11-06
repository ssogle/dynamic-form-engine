import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * 프로젝트 전역 권장 Google Gemini 모델 식별자 상수
 *
 * 용도 및 비용 효율성에 따라 적절한 모델을 선택하여 사용합니다.
 */
export const GEMINI_MODELS = {
  /**
   * 최신 고성능/표준 멀티모달 모델
   * 복잡한 문서 분석, 폼 스키마 생성 및 정밀한 Structured Outputs 추출에 권장됩니다.
   */
  FLASH: "gemini-flash-latest",

  /**
   * 최신 초경량/초고속 저비용 모델
   * 단순 텍스트 분류, 빠른 필드 값 정제 및 시맨틱 라우팅 판별에 최적화되어 있습니다.
   */
  FLASH_LITE: "gemini-flash-lite-latest",
} as const;

export type GeminiModelType = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS] | (string & {});

/**
 * Google Generative AI Provider 인스턴스 생성
 * GEMINI_API_KEY 환경 변수를 주입받아 초기화합니다.
 */
const getGoogleProvider = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return createGoogleGenerativeAI({
    apiKey: apiKey ?? "",
  });
};

/**
 * Vercel AI SDK와 호환되는 Gemini LanguageModel 인스턴스를 반환합니다.
 *
 * @param modelId 사용할 모델 식별자 (기본값: GEMINI_MODELS.FLASH)
 * @returns Vercel AI SDK generateObject / streamText 등에 전달 가능한 모델 객체
 */
export const getGeminiModel = (modelId: GeminiModelType = GEMINI_MODELS.FLASH) => {
  const provider = getGoogleProvider();
  return provider(modelId);
};
