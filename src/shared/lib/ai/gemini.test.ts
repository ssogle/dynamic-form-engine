import { beforeEach, describe, expect, it, vi } from "vitest";
import { GEMINI_MODELS, getGeminiModel } from "./gemini";

// @ai-sdk/google 모킹
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

describe("Gemini AI Client (shared/lib/ai)", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-api-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  it("GEMINI_MODELS 상수에 권장 모델 식별자가 정의되어 있어야 한다", () => {
    expect(GEMINI_MODELS.FLASH).toBe("gemini-flash-latest");
    expect(GEMINI_MODELS.FLASH_LITE).toBe("gemini-flash-lite-latest");
  });

  it("기본 모델 인자로 호출 시 기본 고성능 플래시 모델을 반환해야 한다", () => {
    const model = getGeminiModel();

    expect(model).toBeDefined();
    expect(model.modelId).toBe(GEMINI_MODELS.FLASH);
  });

  it("특정 모델 식별자(FLASH_LITE 등)를 지정하면 해당 모델을 반환해야 한다", () => {
    const model = getGeminiModel(GEMINI_MODELS.FLASH_LITE);

    expect(model).toBeDefined();
    expect(model.modelId).toBe("gemini-flash-lite-latest");
  });
});
