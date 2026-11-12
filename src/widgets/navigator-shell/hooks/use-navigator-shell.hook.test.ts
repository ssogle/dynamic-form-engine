import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNavigatorChatStore } from "../store/navigator-chat.store";
import { useConsumerFormDraftStore } from "@/entities/form-submission";
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
vi.mock("@/features/execute-navigator-action", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/execute-navigator-action")>();
  return {
    ...actual,
    useNavigatorMutation: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  };
});

describe("useNavigatorShell (widgets/navigator-shell/hooks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNavigatorChatStore.setState({
      messages: [],
      currentMode: "consumer",
      isGenerating: false,
    });
    useConsumerFormDraftStore.setState({
      currentFormId: null,
      draftValues: {},
      submitTriggerCount: 0,
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
});
