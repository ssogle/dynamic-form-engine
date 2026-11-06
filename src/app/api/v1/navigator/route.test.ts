import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiModule from "ai";
import * as formServer from "@/entities/form/server";
import { POST } from "./route";

// AI SDK 모킹
vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config),
}));

// AI 모델 공급자 모킹 (추상화된 getAiModel)
vi.mock("@/shared/lib/ai", () => ({
  getAiModel: vi.fn(() => ({ modelId: "test-ai-model" })),
}));

// Form 엔티티 DB 서버 함수 모킹
vi.mock("@/entities/form/server", () => ({
  findActiveForms: vi.fn(),
  findFormBySlug: vi.fn(),
  insertForm: vi.fn(),
  updateFormById: vi.fn(),
  softDeleteFormById: vi.fn(),
}));

interface MockToolOptions {
  tools: {
    navigate: { execute: (input: { targetPath: string }) => Promise<unknown> };
    createForm: { execute: (input: unknown) => Promise<unknown> };
    listForms: { execute: (input: unknown) => Promise<unknown> };
    deleteForm?: { execute: (input: unknown) => Promise<unknown> };
  };
}

describe("POST /api/v1/navigator (AI Navigator 도구 카탈로그 엔드포인트)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(formServer.findActiveForms).mockResolvedValue([]);
  });

  it("요청 페이로드에 prompt가 누락된 경우 400 에러를 반환해야 한다", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("navigate 도구가 호출된 경우 targetPath와 함께 화면 이동 액션을 반환해야 한다", async () => {
    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const tool = (options as MockToolOptions).tools.navigate;
      await tool.execute({ targetPath: "/builder/forms/test-survey" });

      return {
        text: "테스트 설문 화면으로 이동합니다.",
        toolCalls: [
          {
            toolCallId: "call_1",
            toolName: "navigate",
            input: { targetPath: "/builder/forms/test-survey" },
          },
        ],
        toolResults: [
          {
            toolCallId: "call_1",
            toolName: "navigate",
            input: { targetPath: "/builder/forms/test-survey" },
            result: { success: true, targetPath: "/builder/forms/test-survey" },
          },
        ],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "테스트 설문으로 이동해줘",
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.reply).toBe("테스트 설문 화면으로 이동합니다.");
    expect(json.data.action?.type).toBe("NAVIGATE");
    expect(json.data.action?.targetPath).toBe("/builder/forms/test-survey");
  });

  it("createForm 도구가 호출된 경우 DB에 신규 폼을 저장하고 CREATE_FORM 액션 및 생성된 폼 정보를 반환해야 한다", async () => {
    const mockCreatedForm = {
      id: "form-uuid-1",
      slug: "event-registration",
      title: "행사 사전 등록",
      description: "사전 등록 안내",
      schemaDefinition: {
        fields: [
          {
            id: "f_name",
            name: "applicantName",
            label: "신청자 이름",
            type: "text" as const,
            required: true,
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    vi.spyOn(formServer, "insertForm").mockResolvedValueOnce(mockCreatedForm);
    vi.spyOn(formServer, "findFormBySlug").mockResolvedValueOnce(mockCreatedForm);

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const tool = (options as MockToolOptions).tools.createForm;
      const result = await tool.execute({
        slug: "event-registration",
        title: "행사 사전 등록",
        description: "사전 등록 안내",
        fields: mockCreatedForm.schemaDefinition.fields,
      });

      return {
        text: "행사 사전 등록 폼을 생성했습니다.",
        toolCalls: [
          {
            toolCallId: "call_2",
            toolName: "createForm",
            input: {
              slug: "event-registration",
              title: "행사 사전 등록",
              description: "사전 등록 안내",
              fields: mockCreatedForm.schemaDefinition.fields,
            },
          },
        ],
        toolResults: [
          {
            toolCallId: "call_2",
            toolName: "createForm",
            result,
          },
        ],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "행사 사전 등록 폼 만들어줘",
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(formServer.insertForm).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "event-registration",
        title: "행사 사전 등록",
      })
    );
    expect(json.data.action?.type).toBe("CREATE_FORM");
    expect(json.data.action?.slug).toBe("event-registration");
    expect(json.data.updatedForm?.slug).toBe("event-registration");
  });

  it("listForms 도구가 호출된 경우 등록된 폼 목록을 조회하고 안내 메시지를 반환해야 한다", async () => {
    vi.spyOn(formServer, "findActiveForms").mockResolvedValueOnce([
      {
        id: "form-1",
        slug: "customer-feedback",
        title: "고객 피드백 설문",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]);

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const tool = (options as MockToolOptions).tools.listForms;
      const result = await tool.execute({});

      return {
        text: "현재 '고객 피드백 설문' 폼이 등록되어 있습니다.",
        toolCalls: [
          {
            toolCallId: "call_3",
            toolName: "listForms",
            input: {},
          },
        ],
        toolResults: [
          {
            toolCallId: "call_3",
            toolName: "listForms",
            result,
          },
        ],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "현재 등록된 폼 목록 알려줘",
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(formServer.findActiveForms).toHaveBeenCalled();
    expect(json.data.reply).toContain("고객 피드백 설문");
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

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "고객만족도 폼 수정할게",
        currentContext: {
          currentPath: "/builder/forms",
        },
      }),
    });

    await POST(request, {});

    // 맥락에 현재 경로와 등록된 폼 목록이 명시적으로 포함되어 있는지 검증
    expect(capturedPrompt).toContain("/builder/forms");
    expect(capturedPrompt).toContain("고객 만족도 설문");
    expect(capturedPrompt).toContain("customer-satisfaction");
  });

  it("사용자가 특정 폼 수정을 요청했을 때 해당 폼 캔버스(/builder/forms/[slug])로 navigate 액션을 반환해야 한다", async () => {
    vi.spyOn(formServer, "findActiveForms").mockResolvedValueOnce([
      {
        id: "form-1",
        slug: "customer-survey",
        title: "고객 만족도 설문",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]);

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const tool = (options as MockToolOptions).tools.navigate;
      await tool.execute({ targetPath: "/builder/forms/customer-survey" });

      return {
        text: "고객 만족도 설문 캔버스로 이동합니다.",
        toolCalls: [
          {
            toolCallId: "call_nav_slug",
            toolName: "navigate",
            input: { targetPath: "/builder/forms/customer-survey" },
          },
        ],
        toolResults: [
          {
            toolCallId: "call_nav_slug",
            toolName: "navigate",
            input: { targetPath: "/builder/forms/customer-survey" },
            result: { success: true, targetPath: "/builder/forms/customer-survey" },
          },
        ],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "고객만족도 폼 수정할게",
        currentContext: {
          currentPath: "/builder/forms",
        },
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.action?.type).toBe("NAVIGATE");
    expect(json.data.action?.targetPath).toBe("/builder/forms/customer-survey");
    expect(json.data.reply).toBe("고객 만족도 설문 캔버스로 이동합니다.");
  });

  it("이전 대화 목록(messages)이 제공되면 generateText의 messages 배열에 포함되어야 한다", async () => {
    let capturedMessages: unknown = null;

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      capturedMessages = (options as { messages?: unknown }).messages;
      return {
        text: "연락처 필드를 추가했습니다.",
        toolCalls: [],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "연락처 필드 추가해줘",
        messages: [
          { role: "user", content: "고객만족도 폼 수정할게" },
          { role: "assistant", content: "어떤 필드를 수정할까요?" },
        ],
        currentContext: {
          currentPath: "/builder/forms/customer-survey",
        },
      }),
    });

    await POST(request, {});

    expect(capturedMessages).toBeDefined();
    expect(Array.isArray(capturedMessages)).toBe(true);
    expect(capturedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "고객만족도 폼 수정할게" }),
        expect.objectContaining({ role: "assistant", content: "어떤 필드를 수정할까요?" }),
      ])
    );
  });

  it("deleteForm 도구가 호출되면 소프트 삭제를 실행하고 폼 목록으로 NAVIGATE 액션을 반환해야 한다", async () => {
    const mockExistingForm = {
      id: "form-del-1",
      slug: "customer-feedback",
      title: "고객 피드백 폼",
      description: null,
      schemaDefinition: { fields: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    vi.spyOn(formServer, "findFormBySlug").mockResolvedValueOnce(mockExistingForm);
    vi.spyOn(formServer, "softDeleteFormById").mockResolvedValueOnce({
      ...mockExistingForm,
      deletedAt: new Date(),
    });

    vi.spyOn(aiModule, "generateText").mockImplementationOnce(async (options: unknown) => {
      const tool = (options as MockToolOptions).tools.deleteForm;
      await tool?.execute({ formSlug: "customer-feedback" });

      return {
        text: "'고객 피드백 폼'이 삭제되었습니다. 폼 목록으로 이동합니다.",
        toolCalls: [
          {
            toolCallId: "call_del_1",
            toolName: "deleteForm",
            input: { formSlug: "customer-feedback" },
          },
        ],
        toolResults: [
          {
            toolCallId: "call_del_1",
            toolName: "deleteForm",
            input: { formSlug: "customer-feedback" },
            result: { success: true, formSlug: "customer-feedback", title: "고객 피드백 폼" },
          },
        ],
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>;
    });

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "고객 피드백 폼 삭제해줘",
        currentContext: {
          currentPath: "/builder/forms/customer-feedback",
        },
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.action?.type).toBe("NAVIGATE");
    expect(json.data.action?.targetPath).toBe("/builder/forms");
    expect(json.data.reply).toContain("삭제되었습니다");
  });
});
