import * as aiModule from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as formServer from "@/entities/form/server";
import { runNavigatorEngine } from "./navigator-runner.server";

// AI SDK 및 Drizzle DB 함수 모킹
vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config),
}));

vi.mock("@/shared/lib/ai", () => ({
  getAiModel: vi.fn(() => ({ modelId: "test-ai-model" })),
}));

vi.mock("@/entities/form/server", () => ({
  findActiveForms: vi.fn(),
  findFormBySlug: vi.fn(),
  insertForm: vi.fn(),
  updateFormById: vi.fn(),
  softDeleteFormById: vi.fn(),
  softDeleteFormsBySlugs: vi.fn(),
}));

describe("runNavigatorEngine (AI Navigator 코어 오케스트레이션 엔진)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(formServer, "findActiveForms").mockResolvedValue([]);
  });

  it("navigate 도구가 호출된 경우 targetPath와 함께 화면 이동 액션을 반환해야 한다", async () => {
    vi.spyOn(aiModule, "generateText").mockResolvedValueOnce({
      text: "폼 목록 화면으로 이동합니다.",
      toolCalls: [
        {
          toolName: "navigate",
          input: { targetPath: "/builder/forms" },
        },
      ],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await runNavigatorEngine({
      prompt: "폼 목록으로 가줘",
    });

    expect(result.action).toEqual({
      type: "NAVIGATE",
      targetPath: "/builder/forms",
      message: "폼 목록 화면으로 이동합니다.",
    });
    expect(result.reply).toBe("폼 목록 화면으로 이동합니다.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]?.toolName).toBe("navigate");
  });

  it("createForm 도구가 호출된 경우 DB에 신규 폼을 저장하고 CREATE_FORM 액션 및 생성된 폼 정보를 반환해야 한다", async () => {
    const mockCreatedForm = {
      id: "form-new-1",
      slug: "customer-feedback",
      title: "고객 피드백 폼",
      description: "고객 의견을 수집합니다.",
      schemaDefinition: {
        fields: [
          {
            id: "f_1",
            name: "email",
            label: "이메일",
            type: "text",
            required: true,
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
      deletedAt: null,
    };

    vi.spyOn(formServer, "findFormBySlug").mockResolvedValueOnce(mockCreatedForm);

    vi.spyOn(aiModule, "generateText").mockResolvedValueOnce({
      text: "'고객 피드백 폼'이 생성되었습니다.",
      toolCalls: [
        {
          toolName: "createForm",
          input: {
            slug: "customer-feedback",
            title: "고객 피드백 폼",
            description: "고객 의견을 수집합니다.",
            fields: mockCreatedForm.schemaDefinition.fields,
          },
        },
      ],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await runNavigatorEngine({
      prompt: "고객 피드백 폼 만들어줘",
    });

    expect(result.action).toEqual({
      type: "CREATE_FORM",
      slug: "customer-feedback",
      title: "고객 피드백 폼",
      description: "고객 의견을 수집합니다.",
      fields: mockCreatedForm.schemaDefinition.fields,
      message: "'고객 피드백 폼'이 생성되었습니다.",
    });
    expect(result.updatedForm).toEqual({
      slug: "customer-feedback",
      title: "고객 피드백 폼",
      description: "고객 의견을 수집합니다.",
      fields: mockCreatedForm.schemaDefinition.fields,
      publishedAt: null,
    });
  });

  it("listForms 도구가 호출된 경우 등록된 폼 목록을 조회하고 안내 메시지를 반환해야 한다", async () => {
    vi.spyOn(aiModule, "generateText").mockResolvedValueOnce({
      text: "현재 등록된 폼 목록은 1개입니다.",
      toolCalls: [
        {
          toolName: "listForms",
          input: {},
        },
      ],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await runNavigatorEngine({
      prompt: "등록된 폼 뭐 있어?",
    });

    expect(result.reply).toBe("현재 등록된 폼 목록은 1개입니다.");
    expect(result.action).toBeNull();
  });

  it("프롬프트에 현재 화면 경로와 DB 활성 폼 목록(전체 맥락)이 올바르게 주입되어야 한다", async () => {
    let capturedPrompt = "";

    vi.spyOn(formServer, "findActiveForms").mockResolvedValueOnce([
      {
        id: "form-1",
        slug: "customer-satisfaction",
        title: "고객 만족도 설문",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
        deletedAt: null,
      },
    ]);

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const opts = options as { messages?: Array<{ role: string; content: string }> };
      capturedPrompt = opts.messages?.[opts.messages.length - 1]?.content ?? "";
      return {
        text: "안내 메시지",
        toolCalls: [],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    await runNavigatorEngine({
      prompt: "고객만족도 폼 수정할게",
      currentContext: {
        currentPath: "/builder/forms",
      },
    });

    expect(capturedPrompt).toContain("/builder/forms");
    expect(capturedPrompt).toContain("고객 만족도 설문");
    expect(capturedPrompt).toContain("customer-satisfaction");
  });

  it("이전 대화 목록(messages)이 제공되면 generateText의 messages 배열에 포함되어야 한다", async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const opts = options as { messages?: Array<{ role: string; content: string }> };
      capturedMessages = opts.messages ?? [];
      return {
        text: "답변 메시지",
        toolCalls: [],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    await runNavigatorEngine({
      prompt: "이메일 필드 삭제해줘",
      messages: [
        {
          role: "user",
          content: "고객만족도 폼 보여줘",
        },
        {
          role: "assistant",
          content: "고객만족도 폼에는 이름과 이메일 필드가 있습니다.",
        },
      ],
    });

    expect(capturedMessages.length).toBe(3);
    expect(capturedMessages[0]).toEqual({
      role: "user",
      content: "고객만족도 폼 보여줘",
    });
    expect(capturedMessages[1]).toEqual({
      role: "assistant",
      content: "고객만족도 폼에는 이름과 이메일 필드가 있습니다.",
    });
    expect(capturedMessages[2]?.content).toContain("이메일 필드 삭제해줘");
  });

  it("deleteForm 도구가 호출되면 소프트 삭제를 실행하고 폼 목록으로 NAVIGATE 액션을 반환해야 한다", async () => {
    vi.spyOn(aiModule, "generateText").mockResolvedValueOnce({
      text: "'test-form' 폼이 삭제되었습니다.",
      toolCalls: [
        {
          toolName: "deleteForm",
          input: { formSlug: "test-form" },
        },
      ],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await runNavigatorEngine({
      prompt: "test-form 삭제해줘",
    });

    expect(result.action).toEqual({
      type: "NAVIGATE",
      targetPath: "/builder/forms",
      message: "'test-form' 폼이 삭제되었습니다.",
    });
  });

  it("deleteForms 도구가 호출되면 일괄 소프트 삭제를 실행하고 폼 목록으로 NAVIGATE 액션을 반환해야 한다", async () => {
    vi.spyOn(aiModule, "generateText").mockResolvedValueOnce({
      text: "'form-1, form-2' 폼이 삭제되었습니다.",
      toolCalls: [
        {
          toolName: "deleteForms",
          input: { formSlugs: ["form-1", "form-2"] },
        },
      ],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await runNavigatorEngine({
      prompt: "form-1이랑 form-2 둘 다 삭제해줘",
    });

    expect(result.action).toEqual({
      type: "NAVIGATE",
      targetPath: "/builder/forms",
      message: "'form-1, form-2' 폼이 삭제되었습니다.",
    });
  });

  it("publishForm 도구가 호출되면 PUBLISH_FORM 액션 및 갱신된 폼 상태를 반환해야 한다", async () => {
    const publishedDate = new Date("2026-11-08T00:00:00Z");
    vi.spyOn(formServer, "findFormBySlug").mockResolvedValueOnce({
      id: "form-123",
      slug: "event-survey",
      title: "이벤트 설문",
      description: null,
      schemaDefinition: { fields: [] },
      createdAt: publishedDate,
      updatedAt: publishedDate,
      publishedAt: publishedDate,
      deletedAt: null,
    });

    vi.spyOn(aiModule, "generateText").mockResolvedValueOnce({
      text: "'이벤트 설문' 폼이 공식 발행되었습니다.",
      toolCalls: [
        {
          toolName: "publishForm",
          input: { formSlug: "event-survey", isPublished: true },
        },
      ],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const result = await runNavigatorEngine({
      prompt: "이벤트 설문 발행해줘",
    });

    expect(result.action).toEqual({
      type: "PUBLISH_FORM",
      formSlug: "event-survey",
      isPublished: true,
      publishedAt: publishedDate.toISOString(),
      message: "'이벤트 설문' 폼이 공식 발행되었습니다.",
    });
    expect(result.updatedForm?.publishedAt).toEqual(publishedDate);
  });
});
