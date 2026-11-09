import { describe, it, expect, vi, beforeEach } from "vitest";
import { runNavigatorEngine } from "./navigator-engine.server";

// 1. Entities DB 함수 모킹
vi.mock("@/entities/form/server", () => ({
  findActiveForms: vi.fn().mockResolvedValue([
    {
      id: "form-uuid-1",
      slug: "survey-1",
      title: "고객 만족도 조사",
      schemaDefinition: { fields: [] },
      publishedAt: null,
    },
  ]),
  findPublishedForms: vi.fn().mockResolvedValue([
    {
      id: "form-uuid-2",
      slug: "developer-hire",
      title: "개발자 채용 지원서",
      schemaDefinition: {
        fields: [{ id: "f1", name: "applicantName", label: "이름", type: "text" }],
      },
      publishedAt: "2026-01-01T00:00:00Z",
    },
  ]),
  findFormBySlug: vi.fn(),
  insertForm: vi.fn(),
  updateFormById: vi.fn(),
  softDeleteFormById: vi.fn(),
  softDeleteFormsBySlugs: vi.fn(),
}));

// 2. Vercel AI SDK generateText 모킹
const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  tool: (config: unknown) => config,
}));

// 3. AI Model 모킹
vi.mock("@/shared/lib/ai", () => ({
  getAiModel: () => "mock-model",
}));

describe("runNavigatorEngine (features/execute-navigator-action/server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("빌더 모드에서 navigate 도구 호출 시 NAVIGATE 액션을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "폼 목록 화면으로 이동합니다.",
      toolResults: [
        {
          toolName: "navigate",
          input: { targetPath: "/builder/forms", reason: "폼 목록 조회" },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "builder",
      prompt: "폼 목록 보여줘",
    });

    expect(result.action?.type).toBe("NAVIGATE");
    if (result.action?.type === "NAVIGATE") {
      expect(result.action.targetPath).toBe("/builder/forms");
    }
  });

  it("컨슈머 모드에서 fillFields 도구 호출 시 FILL_FIELDS 액션을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "지원자 이름을 입력했습니다.",
      toolResults: [
        {
          toolName: "fillFields",
          input: {
            formSlug: "developer-hire",
            fields: { applicantName: "홍길동" },
            message: "지원자 이름을 입력했습니다.",
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "consumer",
      prompt: "내 이름은 홍길동이야",
      currentContext: {
        currentFormSlug: "developer-hire",
      },
    });

    expect(result.action?.type).toBe("FILL_FIELDS");
    if (result.action?.type === "FILL_FIELDS") {
      expect(result.action.fields).toEqual({ applicantName: "홍길동" });
    }
  });

  it("컨슈머 모드에서 submitForm 도구 호출 시 SUBMIT_FORM 액션을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "폼을 제출합니다.",
      toolResults: [
        {
          toolName: "submitForm",
          input: {
            formSlug: "developer-hire",
            confirmationMessage: "폼을 제출합니다.",
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "consumer",
      prompt: "제출해줘",
      currentContext: {
        currentFormSlug: "developer-hire",
      },
    });

    expect(result.action?.type).toBe("SUBMIT_FORM");
  });
});
