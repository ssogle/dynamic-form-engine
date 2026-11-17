import { describe, it, expect, vi, beforeEach } from "vitest";
import { runNavigatorEngine } from "./navigator-engine.server";
import { findActiveForms, findPublishedForms } from "@/entities/form/server";

// 1. Entities DB 함수 모킹
vi.mock("@/entities/form/server", () => ({
  findActiveForms: vi.fn().mockResolvedValue([
    {
      id: "form-uuid-1",
      title: "고객 만족도 조사",
      schemaDefinition: { fields: [] },
      publishedAt: null,
    },
  ]),
  findPublishedForms: vi.fn().mockResolvedValue([
    {
      id: "form-uuid-2",
      title: "개발자 채용 지원서",
      schemaDefinition: {
        fields: [
          {
            id: "f1",
            label: "이름",
            type: "text",
            description: "지원자의 성명을 입력합니다.",
          },
        ],
      },
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    },
  ]),
  findFormById: vi.fn(),
  insertForm: vi.fn(),
  updateFormById: vi.fn(),
  publishFormById: vi.fn(),
  softDeleteFormsByIds: vi.fn(),
}));

vi.mock("@/entities/form-submission/server", () => ({
  hasSubmissionsByFormId: vi.fn().mockResolvedValue(false),
  softDeleteSubmissionsByIds: vi.fn(),
  aggregateFormSubmissions: vi.fn(),
  queryFormSubmissionsForAnalysis: vi.fn(),
}));

vi.mock("@/entities/analysis-view/server", () => ({
  findAnalysisViewById: vi.fn(),
  insertAnalysisView: vi.fn(),
  updateAnalysisViewById: vi.fn(),
  publishAnalysisViewById: vi.fn(),
  softDeleteAnalysisViewsByIds: vi.fn(),
}));

// 2. Vercel AI SDK generateText 모킹
const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  tool: (config: unknown) => config,
  stepCountIs: (count: number) => ({ type: "stepCount", count }),
}));

// 3. AI Model 모킹
vi.mock("@/shared/lib/ai", () => ({
  getAiModel: () => "mock-model",
}));

describe("runNavigatorEngine (features/execute-navigator-action/server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("사전 전량 조회를 제거하여 턴 시작 시 findActiveForms/findPublishedForms를 호출하지 않아야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "안녕하세요! 무엇을 도와드릴까요?",
      toolResults: [],
    });

    await runNavigatorEngine({
      mode: "consumer",
      prompt: "안녕",
    });

    // 사전 전량 조회 호출이 발생하지 않아야 함
    expect(findPublishedForms).not.toHaveBeenCalled();
    expect(findActiveForms).not.toHaveBeenCalled();
  });

  it("generateText 호출 시 stopWhen(stepCountIs: 5)와 queryTools가 주입되어야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "답변입니다.",
      toolResults: [],
    });

    await runNavigatorEngine({
      mode: "consumer",
      prompt: "테스트",
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs?.stopWhen).toEqual({ type: "stepCount", count: 5 });
    expect(callArgs?.tools).toHaveProperty("searchForms");
    expect(callArgs?.tools).toHaveProperty("getFormDetails");
  });

  it("빌더 모드에서 navigate 도구 호출 시 output.clientAction을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "폼 목록 화면으로 이동합니다.",
      toolResults: [
        {
          toolName: "navigate",
          input: { targetPath: "/builder/forms", reason: "폼 목록 조회" },
          output: {
            success: true,
            targetPath: "/builder/forms",
            clientAction: {
              type: "NAVIGATE",
              targetPath: "/builder/forms",
              message: "폼 목록 화면으로 이동합니다.",
            },
          },
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

  it("컨슈머 모드에서 fillFields 도구 호출 시 output.clientAction을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "지원자 이름을 입력했습니다.",
      toolResults: [
        {
          toolName: "fillFields",
          input: {
            formId: "developer-hire",
            fields: { f1: "홍길동" },
            message: "지원자 이름을 입력했습니다.",
          },
          output: {
            success: true,
            formId: "developer-hire",
            clientAction: {
              type: "FILL_FIELDS",
              formId: "developer-hire",
              fields: { f1: "홍길동" },
              message: "지원자 이름을 입력했습니다.",
            },
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "consumer",
      prompt: "내 이름은 홍길동이야",
      currentContext: {
        currentFormId: "developer-hire",
      },
    });

    expect(result.action?.type).toBe("FILL_FIELDS");
    if (result.action?.type === "FILL_FIELDS") {
      expect(result.action.fields).toEqual({ f1: "홍길동" });
    }
  });

  it("컨슈머 모드에서 submitForm 도구 호출 시 output.clientAction을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "폼을 제출합니다.",
      toolResults: [
        {
          toolName: "submitForm",
          input: {
            formId: "developer-hire",
            confirmationMessage: "폼을 제출합니다.",
          },
          output: {
            success: true,
            formId: "developer-hire",
            clientAction: {
              type: "SUBMIT_FORM",
              formId: "developer-hire",
              message: "폼을 제출합니다.",
            },
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "consumer",
      prompt: "제출해줘",
      currentContext: {
        currentFormId: "developer-hire",
      },
    });

    expect(result.action?.type).toBe("SUBMIT_FORM");
  });

  it("다단계 실행으로 navigate와 fillFields 복합 액션이 발생할 때 actions 배열을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "프로젝트 폼으로 이동하여 필드를 입력합니다.",
      toolResults: [
        {
          toolName: "navigate",
          input: { targetPath: "/consumer/forms/project" },
          output: {
            success: true,
            clientAction: {
              type: "NAVIGATE",
              targetPath: "/consumer/forms/project",
            },
          },
        },
        {
          toolName: "fillFields",
          input: {
            formId: "project",
            fields: { f1: "새 프로젝트" },
          },
          output: {
            success: true,
            clientAction: {
              type: "FILL_FIELDS",
              formId: "project",
              fields: { f1: "새 프로젝트" },
            },
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "consumer",
      prompt: "프로젝트 추가할 건데 제목은 새 프로젝트야",
    });

    expect(result.actions).toHaveLength(2);
    expect(result.actions?.[0]?.type).toBe("NAVIGATE");
    expect(result.actions?.[1]?.type).toBe("FILL_FIELDS");
    expect(result.action?.type).toBe("NAVIGATE");
  });

  it("컨슈머 모드에서 deleteSubmissions 도구 호출 시 DELETE_SUBMISSIONS 액션을 올바르게 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "선택한 응답들을 삭제했습니다.",
      toolResults: [
        {
          toolName: "deleteSubmissions",
          input: { submissionIds: ["sub-1", "sub-2"] },
          output: {
            success: true,
            deletedIds: ["sub-1", "sub-2"],
            clientAction: {
              type: "DELETE_SUBMISSIONS",
              deletedIds: ["sub-1", "sub-2"],
              message: "선택한 응답들을 삭제했습니다.",
            },
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "consumer",
      prompt: "1번, 2번 응답 삭제해줘",
      currentContext: {
        currentPath: "/consumer/forms/developer-hire/submissions",
      },
    });

    expect(result.action?.type).toBe("DELETE_SUBMISSIONS");
    if (result.action?.type === "DELETE_SUBMISSIONS") {
      expect(result.action.deletedIds).toEqual(["sub-1", "sub-2"]);
    }
  });

  it("분석가 모드에서는 stepCountIs(10) 및 analyst 도구들이 주입되고 updatedAnalysisView를 추출해야 한다", async () => {
    const createdView = {
      id: "view-uuid-1",
      title: "분기 비교 리포트",
      description: "요약",
      blocks: [],
      publishedAt: null,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
      deletedAt: null,
    };

    mockGenerateText.mockResolvedValueOnce({
      text: "분석 뷰를 생성했습니다.",
      toolResults: [
        {
          toolName: "createAnalysisView",
          input: { title: "분기 비교 리포트", blocks: [] },
          output: {
            success: true,
            viewId: "view-uuid-1",
            analysisView: createdView,
            clientAction: {
              type: "CREATE_ANALYSIS_VIEW",
              viewId: "view-uuid-1",
              title: "분기 비교 리포트",
              blocks: [],
              message: "분석 뷰를 생성했습니다.",
            },
          },
        },
      ],
    });

    const result = await runNavigatorEngine({
      mode: "analyst",
      prompt: "분기 비교 리포트 만들어줘",
    });

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    expect(callArgs?.stopWhen).toEqual({ type: "stepCount", count: 10 });
    expect(callArgs?.providerOptions).toEqual({
      google: {
        thinkingConfig: {
          thinkingBudget: 512,
        },
      },
    });
    expect(callArgs?.tools).toHaveProperty("aggregateFormSubmissions");
    expect(callArgs?.tools).toHaveProperty("computeSeriesMetric");
    expect(callArgs?.tools).toHaveProperty("createAnalysisView");
    expect(callArgs?.tools).toHaveProperty("searchForms");
    expect(result.action?.type).toBe("CREATE_ANALYSIS_VIEW");
    expect(result.updatedAnalysisView?.id).toBe("view-uuid-1");
  });

  it("지원하지 않는 모드가 전달되면 명시적인 오류를 던져야 한다", async () => {
    await expect(
      runNavigatorEngine({
        mode: "unknown_mode" as unknown as "builder",
        prompt: "테스트",
      })
    ).rejects.toThrow('지원하지 않는 네비게이터 모드입니다: "unknown_mode"');
  });

  it("maxRetries: 0, step/total timeout, 외부 abortSignal 및 onStepStart/onToolExecutionStart/onStepEnd 진행 메시지를 전달해야 한다", async () => {
    const abortController = new AbortController();
    const progressLogs: string[] = [];

    mockGenerateText.mockImplementationOnce(
      async (args: {
        onStepStart?: (e: { stepNumber: number }) => void;
        onToolExecutionStart?: (e: { toolCall: { toolName: string } }) => void;
        onStepEnd?: (e: { toolCalls: Array<{ toolName: string }>; finishReason: string }) => void;
      }) => {
        args.onStepStart?.({ stepNumber: 0 });
        args.onToolExecutionStart?.({ toolCall: { toolName: "aggregateFormSubmissions" } });
        args.onStepEnd?.({
          toolCalls: [{ toolName: "aggregateFormSubmissions" }],
          finishReason: "tool-calls",
        });
        args.onStepStart?.({ stepNumber: 1 });
        args.onToolExecutionStart?.({ toolCall: { toolName: "updateAnalysisView" } });
        args.onStepEnd?.({
          toolCalls: [{ toolName: "updateAnalysisView" }],
          finishReason: "stop",
        });

        return {
          text: "최신 데이터로 갱신했습니다.",
          toolResults: [],
        };
      }
    );

    const result = await runNavigatorEngine(
      { mode: "analyst", prompt: "갱신해줘" },
      {
        abortSignal: abortController.signal,
        onProgress: (msg) => progressLogs.push(msg),
      }
    );

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    expect(callArgs?.maxRetries).toBe(0);
    expect(callArgs?.timeout).toEqual({ stepMs: 25_000, totalMs: 65_000 });
    expect(callArgs?.abortSignal).toBe(abortController.signal);
    expect(result.reply).toBe("최신 데이터로 갱신했습니다.");
    expect(progressLogs).toEqual([
      "요청을 분석하고 필요한 작업을 준비하고 있습니다...",
      "AI가 요청을 분석해 작업 계획을 세우고 있습니다...",
      "데이터베이스에서 최신 데이터를 집계·조회하고 있습니다...",
      "데이터 집계·조회를 마쳤습니다. 분석 결과를 구성하고 있습니다...",
      "추가 분석 단계(2단계)를 진행하고 있습니다...",
      "분석 뷰 문서를 최신 상태로 반영하고 있습니다...",
      "응답 작성을 완료했습니다.",
    ]);
  });

  it("최대 스텝 소진 등으로 finishReason이 stop이 아니고 텍스트·액션 없이 종료되면 미완료 안내 문구를 반환해야 한다", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "",
      finishReason: "tool-calls",
      toolResults: [],
    });

    const result = await runNavigatorEngine({
      mode: "analyst",
      prompt: "복잡한 다중 분석 실행해줘",
    });

    expect(result.reply).toContain("완료하지 못했습니다");
    expect(result.reply).not.toBe("요청을 처리했습니다.");
  });
});
