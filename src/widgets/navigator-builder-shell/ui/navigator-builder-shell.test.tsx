import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as navigatorFeature from "@/features/execute-navigator-builder-action";
import { useNavigatorBuilderChatStore } from "../store/navigator-builder-chat.store";
import { NavigatorBuilderShell } from "./navigator-builder-shell";

// Next.js 라우터 모킹
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/forms",
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("NavigatorBuilderShell (상주형 AI Builder Navigator 패널 위젯)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNavigatorBuilderChatStore.getState().reset();
  });

  it("기본 웰컴 메시지와 입력창이 화면에 렌더링되어야 한다", () => {
    renderWithClient(<NavigatorBuilderShell />);

    expect(screen.getByText("AI Navigator")).toBeInTheDocument();
    expect(screen.getByText(/안녕하세요! AI Navigator입니다/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/무엇을 도와드릴까요/)).toBeInTheDocument();
  });

  it("사용자가 메시지를 입력하고 전송하면 사용자 메시지가 화면에 추가되어야 한다", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({
      action: {
        type: "NAVIGATE",
        targetPath: "/builder/forms/test-survey",
        message: "테스트 설문 화면으로 이동합니다.",
      },
      updatedForm: null,
    });

    vi.spyOn(navigatorFeature, "useNavigatorActionMutation").mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof navigatorFeature.useNavigatorActionMutation>);

    renderWithClient(<NavigatorBuilderShell />);

    const input = screen.getByPlaceholderText(/무엇을 도와드릴까요/);
    const sendButton = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "테스트 설문으로 가줘" } });
    fireEvent.click(sendButton);

    // 사용자 메시지가 대화 목록에 추가되었는지 확인
    expect(screen.getByText("테스트 설문으로 가줘")).toBeInTheDocument();

    // 뮤테이션이 올바른 페이로드로 호출되었는지 확인
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "테스트 설문으로 가줘",
      })
    );

    // AI 응답 안내 메시지가 화면에 나타나는지 확인
    await waitFor(() => {
      expect(screen.getByText("테스트 설문 화면으로 이동합니다.")).toBeInTheDocument();
    });

    // NAVIGATE에 따라 router.push가 호출되었는지 확인
    expect(mockPush).toHaveBeenCalledWith("/builder/forms/test-survey");
  });

  it("CREATE_FORM 액션이 반환되면 해당 슬러그 빌더 경로로 라우팅되어야 한다", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({
      action: {
        type: "CREATE_FORM",
        slug: "new-application",
        title: "신규 접수창",
        fields: [],
        message: "신규 접수창 폼이 생성되었습니다.",
      },
      updatedForm: {
        slug: "new-application",
        title: "신규 접수창",
        fields: [],
      },
    });

    vi.spyOn(navigatorFeature, "useNavigatorActionMutation").mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof navigatorFeature.useNavigatorActionMutation>);

    renderWithClient(<NavigatorBuilderShell />);

    const input = screen.getByPlaceholderText(/무엇을 도와드릴까요/);
    const sendButton = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "접수창 만들어줘" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("신규 접수창 폼이 생성되었습니다.")).toBeInTheDocument();
    });

    expect(mockPush).toHaveBeenCalledWith("/builder/forms/new-application");
  });

  it("단순 질의로 액션 없이 reply만 반환된 경우 화면 이동 없이 답변 텍스트만 표시되어야 한다", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({
      reply: "현재 등록된 폼은 '고객 설문'이 있습니다.",
      action: null,
      updatedForm: null,
    });

    vi.spyOn(navigatorFeature, "useNavigatorActionMutation").mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof navigatorFeature.useNavigatorActionMutation>);

    renderWithClient(<NavigatorBuilderShell />);

    const input = screen.getByPlaceholderText(/무엇을 도와드릴까요/);
    const sendButton = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "등록된 폼 뭐 있어?" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("현재 등록된 폼은 '고객 설문'이 있습니다.")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("이전 대화 내역이 스토어에 존재하는 경우 executeAction 호출 시 messages 히스토리가 함께 전달되어야 한다", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({
      reply: "수정 완료했습니다.",
      action: null,
      updatedForm: null,
    });

    vi.spyOn(navigatorFeature, "useNavigatorActionMutation").mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof navigatorFeature.useNavigatorActionMutation>);

    // 이전 대화 2건(사용자 1건, 어시스턴트 1건) 미리 추가
    useNavigatorBuilderChatStore.getState().addMessage({
      role: "user",
      content: "고객만족도 폼 보여줘",
    });
    useNavigatorBuilderChatStore.getState().addMessage({
      role: "assistant",
      content: "고객만족도 폼에는 이름과 평점 필드가 있습니다. 어떻게 수정해드릴까요?",
    });

    renderWithClient(<NavigatorBuilderShell />);

    const input = screen.getByPlaceholderText(/무엇을 도와드릴까요/);
    const sendButton = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "평점 필드 삭제해줘" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "평점 필드 삭제해줘",
          messages: [
            {
              role: "user",
              content: "고객만족도 폼 보여줘",
            },
            {
              role: "assistant",
              content: "고객만족도 폼에는 이름과 평점 필드가 있습니다. 어떻게 수정해드릴까요?",
            },
          ],
        })
      );
    });
  });
});
