import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNavigatorChatStore } from "../store/navigator-chat.store";
import { useConsumerFormDraftStore } from "@/entities/form-submission";
import { useAnalysisViewRefreshStore } from "@/entities/analysis-view";
import { useNavigatorShell } from "./use-navigator-shell.hook";

// Router & Pathname 모킹
const mockPush = vi.fn();
let currentPathname = "/consumer/forms/form-uuid-1/new";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => currentPathname,
}));

// React Query 모킹
const mockInvalidateQueries = vi.fn();
const mockGetQueryData = vi.fn();
const mockGetQueriesData = vi.fn().mockReturnValue([]);

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    getQueryData: mockGetQueryData,
    getQueriesData: mockGetQueriesData,
  }),
}));

// AI Mutation 모킹
const mockMutateAsync = vi.fn();
let capturedOnProgress:
  ((statusText: string, meta?: { isHeartbeat?: boolean }) => void) | undefined;
vi.mock("@/features/execute-navigator-action", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/execute-navigator-action")>();
  return {
    ...actual,
    useNavigatorMutation: (options?: {
      onProgress?: (statusText: string, meta?: { isHeartbeat?: boolean }) => void;
    }) => {
      capturedOnProgress = options?.onProgress;
      return {
        mutateAsync: mockMutateAsync,
        isPending: false,
      };
    },
  };
});

describe("useNavigatorShell (widgets/navigator-shell/hooks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnProgress = undefined;
    useNavigatorChatStore.setState({
      messages: [],
      currentMode: "consumer",
      isGenerating: false,
      progressMessage: null,
      progressSteps: [],
    });
    useConsumerFormDraftStore.setState({
      currentFormId: null,
      draftValues: {},
      submitTriggerCount: 0,
    });
    useAnalysisViewRefreshStore.setState({
      pendingRefresh: null,
      isRefreshingByAi: false,
    });
    currentPathname = "/consumer/forms/form-uuid-1/new";
  });

  it("초기 마운트 시 모드를 동기화하고 해당 모드 설정을 반환해야 한다", () => {
    const { result } = renderHook(() => useNavigatorShell({ mode: "consumer" }));

    expect(result.current.config.badgeLabel).toBe("Consumer");
    expect(result.current.isBusy).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it("프롬프트 제출 시 AI 뮤테이션을 호출하고 NAVIGATE 액션을 올바르게 디스패치해야 한다", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      reply: "제출 목록으로 이동합니다.",
      action: {
        type: "NAVIGATE",
        targetPath: "/consumer/forms/form-uuid-1/submissions",
      },
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "consumer" }));

    act(() => {
      result.current.setInputValue("목록 보여줘");
    });

    await act(async () => {
      await result.current.handleExecutePrompt("목록 보여줘");
    });

    expect(mockMutateAsync).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-uuid-1/submissions");
  });

  it("원샷 복합 명령 시 FILL_FIELDS 액션이 NAVIGATE 액션보다 먼저 실행되어야 한다", async () => {
    const executedOrder: string[] = [];

    mockPush.mockImplementationOnce(() => {
      executedOrder.push("NAVIGATE");
    });

    const spyApplyDraftFields = vi.spyOn(useConsumerFormDraftStore.getState(), "applyDraftFields");
    spyApplyDraftFields.mockImplementationOnce(() => {
      executedOrder.push("FILL_FIELDS");
    });

    // AI 응답으로 NAVIGATE가 앞에 오더라도 FILL_FIELDS가 선행되어야 함
    mockMutateAsync.mockResolvedValueOnce({
      reply: "필드를 채우고 수정 화면으로 이동합니다.",
      actions: [
        {
          type: "NAVIGATE",
          targetPath: "/consumer/forms/form-uuid-1/submissions/sub-1/edit",
        },
        {
          type: "FILL_FIELDS",
          formId: "form-uuid-1",
          fields: { name: "홍길동" },
        },
      ],
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "consumer" }));

    await act(async () => {
      await result.current.handleExecutePrompt("홍길동으로 수정해줘");
    });

    expect(executedOrder).toEqual(["FILL_FIELDS", "NAVIGATE"]);
  });

  it("빌더 모드에서 프롬프트 실행 시 캐시된 폼의 primaryFieldId를 currentForm 컨텍스트에 포함해야 한다", async () => {
    currentPathname = "/builder/forms/form-uuid-1";
    mockGetQueryData.mockImplementationOnce(() => ({
      id: "form-uuid-1",
      title: "프로젝트 관리",
      description: "프로젝트 도메인 폼",
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      schemaDefinition: {
        primaryFieldId: "p_name",
        fields: [
          {
            id: "p_code",
            label: "코드",
            type: "text",
            required: true,
            description: "코드 입력",
          },
          {
            id: "p_name",
            label: "프로젝트명",
            type: "text",
            required: true,
            description: "프로젝트명 입력",
          },
        ],
      },
    }));

    mockMutateAsync.mockResolvedValueOnce({
      reply: "확인했습니다.",
      action: null,
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "builder" }));

    await act(async () => {
      await result.current.handleExecutePrompt("대표 필드 확인해줘");
    });

    const callArg = mockMutateAsync.mock.calls[0]?.[0] as {
      currentContext?: { currentForm?: { primaryFieldId?: string } };
    };
    expect(callArg.currentContext?.currentForm?.primaryFieldId).toBe("p_name");
  });

  it("컨슈머 모드에서 visibleSubmissions 요약 제목 생성 시 첫 번째 키가 아닌 폼의 primaryFieldId 값을 우선 사용해야 한다", async () => {
    currentPathname = "/consumer/forms/form-uuid-1/submissions";
    mockGetQueryData.mockImplementation((key: unknown) => {
      if (Array.isArray(key) && key[0] === "forms") {
        return {
          id: "form-uuid-1",
          title: "직원 마스터",
          schemaDefinition: {
            primaryFieldId: "f_name",
            fields: [
              {
                id: "f_note",
                label: "비고",
                type: "text",
                required: false,
                description: "비고",
              },
              {
                id: "f_name",
                label: "성명",
                type: "text",
                required: true,
                description: "직원 이름",
              },
            ],
          },
        };
      }
      return undefined;
    });
    mockGetQueriesData.mockImplementation(() => [
      [
        ["form-submissions", "list"],
        [
          {
            id: "sub-1111",
            formId: "form-uuid-1",
            data: { f_note: "신규 입사자 메모", f_name: "김철수" },
            createdAt: new Date("2026-11-02T00:00:00Z"),
          },
        ],
      ],
    ]);

    mockMutateAsync.mockResolvedValueOnce({
      reply: "첫 번째 응답을 찾았습니다.",
      action: null,
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "consumer" }));

    await act(async () => {
      await result.current.handleExecutePrompt("김철수 응답 찾아줘");
    });

    const callArg = mockMutateAsync.mock.calls[0]?.[0] as {
      currentContext?: { visibleSubmissions?: Array<{ title: string }> };
    };
    expect(callArg.currentContext?.visibleSubmissions?.[0]?.title).toContain("김철수");
    expect(callArg.currentContext?.visibleSubmissions?.[0]?.title).not.toContain(
      "신규 입사자 메모"
    );
  });

  it("analyst 모드에서 currentAnalysisView와 visibleAnalysisViews 컨텍스트를 추출하고 CREATE/UPDATE/DELETE 액션을 디스패치해야 한다", async () => {
    currentPathname = "/analyst/views/view-1";
    mockGetQueryData.mockImplementation((key: readonly unknown[]) => {
      if (Array.isArray(key) && key[1] === "detail" && key[2] === "view-1") {
        return {
          id: "view-1",
          title: "1분기 리포트",
          description: "요약",
          blocks: [{ id: "b1", type: "text", content: "본문" }],
          publishedAt: null,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        };
      }
      if (Array.isArray(key) && key[1] === "list" && key.length === 2) {
        return [
          {
            id: "view-1",
            title: "1분기 리포트",
            description: "요약",
            blocks: [],
            publishedAt: null,
            createdAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        ];
      }
      return undefined;
    });

    mockMutateAsync.mockResolvedValueOnce({
      reply: "새 뷰 생성 및 수정",
      actions: [
        {
          type: "CREATE_ANALYSIS_VIEW",
          viewId: "view-2",
          title: "새 리포트",
          blocks: [],
        },
        {
          type: "UPDATE_ANALYSIS_VIEW",
          operation: "ADD_BLOCK",
          viewId: "view-2",
          blocks: [],
        },
        {
          type: "PUBLISH_ANALYSIS_VIEW",
          viewId: "view-2",
          isPublished: true,
        },
        {
          type: "DELETE_ANALYSIS_VIEWS",
          deletedIds: ["view-1"],
        },
      ],
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "analyst" }));
    expect(result.current.config.badgeLabel).toBe("Analyst");

    await act(async () => {
      await result.current.handleExecutePrompt("새 분석 뷰 만들어줘");
    });

    const callArg = mockMutateAsync.mock.calls[0]?.[0] as {
      mode: string;
      currentContext?: {
        currentAnalysisView?: { id: string; blocks: unknown[] };
        visibleAnalysisViews?: Array<{ id: string }>;
      };
    };
    expect(callArg.mode).toBe("analyst");
    expect(callArg.currentContext?.currentAnalysisView?.id).toBe("view-1");
    expect(callArg.currentContext?.currentAnalysisView?.blocks).toHaveLength(1);
    expect(callArg.currentContext?.visibleAnalysisViews?.[0]?.id).toBe("view-1");

    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/analyst/views/view-2");
    expect(mockPush).toHaveBeenCalledWith("/analyst/views");
  });

  it("analyst 모드에서 pendingRefresh가 요청되면 자동으로 AI 프롬프트를 실행하고 스토어 요청을 비워야 한다", async () => {
    currentPathname = "/analyst/views/view-1";
    mockGetQueryData.mockReturnValue(undefined);
    mockMutateAsync.mockResolvedValueOnce({
      reply: "최신 데이터로 재집계했습니다.",
      actions: [
        {
          type: "UPDATE_ANALYSIS_VIEW",
          operation: "SET_ALL_BLOCKS",
          viewId: "view-1",
          blocks: [],
        },
      ],
    });

    renderHook(() => useNavigatorShell({ mode: "analyst" }));

    await act(async () => {
      useAnalysisViewRefreshStore.getState().requestAiRefresh({
        viewId: "view-1",
        viewTitle: "11월 리포트",
        prompt: "최신 데이터로 갱신해 주세요.",
        requestedAt: 1000,
      });
    });

    expect(useAnalysisViewRefreshStore.getState().pendingRefresh).toBeNull();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "analyst",
        prompt: "최신 데이터로 갱신해 주세요.",
      })
    );
  });

  it("스트리밍 실행 중 status 단계만 누적하여 응답 메시지의 steps로 저장하고 heartbeat는 제외해야 한다", async () => {
    mockMutateAsync.mockImplementationOnce(async () => {
      capturedOnProgress?.("폼 목록 조회 중...", { isHeartbeat: false });
      capturedOnProgress?.("AI가 분석 작업을 진행하고 있습니다... (3초 경과)", {
        isHeartbeat: true,
      });
      capturedOnProgress?.("필드 스키마 검증 중...", { isHeartbeat: false });
      return {
        reply: "폼을 생성했습니다.",
        action: null,
      };
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "builder" }));

    await act(async () => {
      await result.current.handleExecutePrompt("문의 폼 만들어줘");
    });

    const assistantMessage = result.current.messages[result.current.messages.length - 1];
    expect(assistantMessage?.role).toBe("assistant");
    expect(assistantMessage?.content).toBe("폼을 생성했습니다.");
    expect(assistantMessage?.steps).toEqual(["폼 목록 조회 중...", "필드 스키마 검증 중..."]);
    // 실행 완료 후 현재 진행 중 상태는 초기화되어야 함
    expect(result.current.progressSteps).toEqual([]);
    expect(result.current.progressMessage).toBeNull();
  });

  it("toggleStepsExpanded 호출 시 특정 메시지의 수행 과정 펼침 상태를 토글해야 한다", () => {
    const { result } = renderHook(() => useNavigatorShell({ mode: "builder" }));

    expect(result.current.expandedStepMessageIds["msg-1"]).toBeUndefined();

    act(() => {
      result.current.toggleStepsExpanded("msg-1");
    });
    expect(result.current.expandedStepMessageIds["msg-1"]).toBe(true);

    act(() => {
      result.current.toggleStepsExpanded("msg-1");
    });
    expect(result.current.expandedStepMessageIds["msg-1"]).toBe(false);
  });

  it("컨슈머 응답 수정/상세 화면에서 캐시된 submission.data를 currentDraftValues와 병합해 전달해야 한다", async () => {
    currentPathname = "/consumer/forms/form-uuid-1/submissions/sub-edit-1/edit";
    useConsumerFormDraftStore.setState({
      currentFormId: "form-uuid-1",
      draftValues: { f_amount: 50000 },
      submitTriggerCount: 0,
    });

    mockGetQueryData.mockImplementation((key: unknown) => {
      if (Array.isArray(key) && key[0] === "forms") {
        return {
          id: "form-uuid-1",
          title: "비용 정산서",
          schemaDefinition: {
            primaryFieldId: "f_title",
            fields: [
              {
                id: "f_title",
                label: "항목명",
                type: "text",
                required: true,
                description: "항목명",
              },
              {
                id: "f_amount",
                label: "금액",
                type: "number",
                required: true,
                description: "금액",
              },
            ],
          },
        };
      }
      if (Array.isArray(key) && key[0] === "submissions" && key[1] === "detail") {
        return {
          id: "sub-edit-1",
          formId: "form-uuid-1",
          version: 2,
          data: { f_title: "팀 회식", f_amount: 30000 },
        };
      }
      return undefined;
    });

    mockMutateAsync.mockResolvedValueOnce({ reply: "확인했습니다.", action: null });

    const { result } = renderHook(() => useNavigatorShell({ mode: "consumer" }));
    await act(async () => {
      await result.current.handleExecutePrompt("지금 입력된 값 확인해줘");
    });

    const callArg = mockMutateAsync.mock.calls[0]?.[0] as {
      currentContext?: { currentDraftValues?: Record<string, unknown> };
    };
    expect(callArg.currentContext?.currentDraftValues).toEqual({
      f_title: "팀 회식",
      f_amount: 50000,
    });
  });

  it("동일 경로에서 쿼리스트링이 다른 NAVIGATE 액션(예: 필터 초기화) 시 router.push를 실행해야 한다", async () => {
    currentPathname = "/consumer/forms/form-uuid-1";
    window.history.replaceState(null, "", "/consumer/forms/form-uuid-1?sort=f_amount%3Adesc");

    mockMutateAsync.mockResolvedValueOnce({
      reply: "필터와 정렬을 초기화했습니다.",
      action: {
        type: "NAVIGATE",
        targetPath: "/consumer/forms/form-uuid-1",
      },
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "consumer" }));
    await act(async () => {
      await result.current.handleExecutePrompt("필터 초기화해줘");
    });

    expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-uuid-1");
    window.history.replaceState(null, "", "/");
  });

  it("이미지 첨부 상태와 텍스트 없는 전송을 지원하고, HITL 승인 및 취소 처리가 동작해야 한다", async () => {
    currentPathname = "/builder/forms/form-uuid-1";
    const file = new File(["img"], "receipt.png", { type: "image/png" });

    mockMutateAsync.mockResolvedValueOnce({
      reply: "승인이 필요합니다.",
      action: null,
      pendingConfirmations: [
        {
          confirmationId: "conf-hitl-1",
          toolName: "publishForm",
          title: "폼 발행",
          description: "공식 발행합니다.",
          targetIds: ["form-uuid-1"],
          payload: { formId: "form-uuid-1", isPublished: true },
        },
      ],
    });

    const { result } = renderHook(() => useNavigatorShell({ mode: "builder" }));

    await act(async () => {
      await result.current.handleAddAttachmentFiles([file]);
    });
    expect(result.current.attachments).toHaveLength(1);

    await act(async () => {
      await result.current.handleExecutePrompt("");
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [expect.objectContaining({ name: "receipt.png", mimeType: "image/png" })],
      })
    );
    expect(result.current.attachments).toHaveLength(0);

    const lastMsg = result.current.messages[result.current.messages.length - 1]!;
    const pendingItem = lastMsg.pendingConfirmations?.[0];
    expect(pendingItem?.status).toBe("pending");

    mockMutateAsync.mockResolvedValueOnce({
      reply: "발행했습니다.",
      action: { type: "PUBLISH_FORM", formId: "form-uuid-1", isPublished: true },
    });

    await act(async () => {
      await result.current.handleApproveConfirmation(lastMsg.id, pendingItem!);
    });

    expect(mockMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        confirmedAction: {
          confirmationId: "conf-hitl-1",
          toolName: "publishForm",
          payload: { formId: "form-uuid-1", isPublished: true },
        },
      })
    );
    expect(mockInvalidateQueries).toHaveBeenCalled();

    const updatedMsg = useNavigatorChatStore.getState().messages.find((m) => m.id === lastMsg.id);
    expect(updatedMsg?.pendingConfirmations?.[0]?.status).toBe("approved");
  });
});
