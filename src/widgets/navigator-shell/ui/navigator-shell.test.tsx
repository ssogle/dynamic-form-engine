import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigatorShell } from "./navigator-shell";
import { useNavigatorChatStore } from "../store/navigator-chat.store";

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

  it("메시지 입력 및 전송 시 AI 응답과 액션 디스패치가 정상 동작해야 한다", async () => {
    const mockResponse = {
      reply: "설문지 폼으로 이동합니다.",
      action: {
        type: "NAVIGATE" as const,
        targetPath: "/builder/forms/customer-survey",
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

    expect(mockPush).toHaveBeenCalledWith("/builder/forms/customer-survey");
    expect(document.activeElement).toBe(input);
  });
});
