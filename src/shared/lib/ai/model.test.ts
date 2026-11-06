import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_MODELS, getAiModel } from "./model";

// @ai-sdk/google 모킹 (내부 프로바이더 검증용)
vi.mock("@ai-sdk/google", () => {
  return {
    createGoogleGenerativeAI: vi.fn((config) => {
      return (modelId: string) => ({
        provider: "google.generative-ai",
        modelId,
        apiKey: config.apiKey,
      });
    }),
  };
});

describe("AI Model Provider (shared/lib/ai)", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-ai-api-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  it("AI_MODELS 상수에 범용 모델 티어가 정의되어 있어야 한다", () => {
    expect(AI_MODELS.DEFAULT).toBeDefined();
    expect(AI_MODELS.FAST).toBeDefined();
  });

  it("인자 없이 getAiModel 호출 시 기본 고성능 모델을 반환해야 한다", () => {
    const model = getAiModel();

    expect(model).toBeDefined();
    expect(model.modelId).toBe(AI_MODELS.DEFAULT);
  });

  it("FAST 티어를 지정하여 호출 시 경량 고속 모델을 반환해야 한다", () => {
    const model = getAiModel(AI_MODELS.FAST);

    expect(model).toBeDefined();
    expect(model.modelId).toBe(AI_MODELS.FAST);
  });
});
