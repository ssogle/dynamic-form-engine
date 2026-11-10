import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigatorShell } from "./navigator-shell";
import { useNavigatorChatStore } from "../store/navigator-chat.store";
import { useConsumerFormDraftStore } from "@/entities/form-submission";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/builder/forms",
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

describe("NavigatorShell (widgets/navigator-shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    useNavigatorChatStore.getState().reset();
    useConsumerFormDraftStore.getState().resetDraft();
  });

  it("빌더 모드에서 Builder 뱃지와 기본 안내 메시지가 올바르게 렌더링되어야 한다", () => {
    renderWithClient(<NavigatorShell mode="builder" />);

    expect(screen.getByText("AI Navigator")).toBeDefined();
    expect(screen.getByText("Builder")).toBeDefined();
    expect(screen.getByText(/마우스 클릭 없이 자연어로 원하시는 폼 생성/)).toBeDefined();
  });

  it("컨슈머 모드에서 Consumer 뱃지와 기본 안내 메시지가 올바르게 렌더링되어야 한다", () => {
    renderWithClient(<NavigatorShell mode="consumer" />);

    expect(screen.getByText("AI Navigator")).toBeDefined();
    expect(screen.getByText("Consumer")).toBeDefined();
    expect(screen.getByText(/참여하고자 하는 설문이나 작성하고 싶은 신청서/)).toBeDefined();
  });

  it("메시지 입력 및 전송 시 AI 응답과 단일 액션 디스패치가 정상 동작해야 한다", async () => {
    const mockResponse = {
      reply: "설문지 폼으로 이동합니다.",
      action: {
        type: "NAVIGATE" as const,
        targetPath: "/builder/forms/form-123",
        message: "설문지 폼으로 이동합니다.",
      },
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<NavigatorShell mode="builder" />);

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "설문지로 가줘" } });
    fireEvent.click(submitBtn);

    expect(screen.getByText("설문지로 가줘")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("설문지 폼으로 이동합니다.")).toBeDefined();
    });

    expect(mockPush).toHaveBeenCalledWith("/builder/forms/form-123");
    expect(document.activeElement).toBe(input);
  });

  it("원샷 복합 명령(actions: [NAVIGATE, FILL_FIELDS]) 시 FILL_FIELDS 선주입 후 NAVIGATE가 순차 실행되어야 한다", async () => {
    const mockResponse = {
      reply: "프로젝트 폼으로 이동하여 필드를 채웁니다.",
      action: {
        type: "NAVIGATE" as const,
        targetPath: "/consumer/forms/form-proj",
      },
      actions: [
        {
          type: "NAVIGATE" as const,
          targetPath: "/consumer/forms/form-proj",
        },
        {
          type: "FILL_FIELDS" as const,
          formId: "form-proj",
          fields: { f_title: "새 프로젝트", f_dueDate: "2026-12-31" },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<NavigatorShell mode="consumer" />);

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "프로젝트 만들고 제목은 새 프로젝트야" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("프로젝트 폼으로 이동하여 필드를 채웁니다.")).toBeDefined();
    });

    // 1. FILL_FIELDS가 선실행되어 Zustand 스토어에 상태가 보존되었는지 검증
    const draftStore = useConsumerFormDraftStore.getState();
    expect(draftStore.currentFormId).toBe("form-proj");
    expect(draftStore.draftValues).toEqual({
      f_title: "새 프로젝트",
      f_dueDate: "2026-12-31",
    });

    // 2. NAVIGATE가 호출되어 화면 이동을 수행했는지 검증
    expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-proj");
  });

  it("빌더 모드에서 React Query 캐시에 있는 폼 목록을 visibleForms 컨텍스트로 전달해야 한다", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      ["forms", "list"],
      [
        {
          id: "f-1",
          title: "고객 만족도 조사",
          description: "설명",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]
    );

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: { reply: "첫 번째 폼을 확인했습니다." },
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    render(
      <QueryClientProvider client={queryClient}>
        <NavigatorShell mode="builder" />
      </QueryClientProvider>
    );

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "첫 번째 폼 확인해줘" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const callArg = mockFetch.mock.calls[0]?.[1];
    expect(callArg).toBeDefined();
    const requestBody = JSON.parse(callArg?.body as string);
    expect(requestBody.currentContext.visibleForms).toBeDefined();
    expect(requestBody.currentContext.visibleForms[0].id).toBe("f-1");
  });

  it("컨슈머 모드에서 DELETE_SUBMISSIONS 액션 수신 시 캐시 무효화가 정상 호출되어야 한다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const mockResponse = {
      reply: "응답을 삭제했습니다.",
      action: {
        type: "DELETE_SUBMISSIONS" as const,
        deletedIds: ["sub-1"],
        message: "응답을 삭제했습니다.",
      },
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    render(
      <QueryClientProvider client={queryClient}>
        <NavigatorShell mode="consumer" />
      </QueryClientProvider>
    );

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "첫 번째 응답 삭제해줘" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("응답을 삭제했습니다.")).toBeDefined();
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["submissions"],
      })
    );
  });

  it("빌더 모드에서 PUBLISH_FORM 액션 수신 시 폼 캐시 무효화가 정상 호출되어야 한다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const mockResponse = {
      reply: "폼이 공식 발행되었습니다.",
      action: {
        type: "PUBLISH_FORM" as const,
        formId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        isPublished: true,
        message: "폼이 공식 발행되었습니다.",
      },
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    render(
      <QueryClientProvider client={queryClient}>
        <NavigatorShell mode="builder" />
      </QueryClientProvider>
    );

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "이 폼 발행해줘" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("폼이 공식 발행되었습니다.")).toBeDefined();
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["forms"],
      })
    );
  });
});
