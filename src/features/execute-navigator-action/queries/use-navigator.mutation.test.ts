import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import { useNavigatorMutation } from "./use-navigator.mutation";
import type { NavigatorExecutionResponse } from "../types/navigator-action.types";

vi.mock("@/shared/lib/http", () => ({
  httpClient: {
    post: vi.fn(),
  },
}));

describe("useNavigatorMutation (features/execute-navigator-action/queries)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it("executeNavigatorAction 성공 시 응답 데이터를 정상 반환해야 한다", async () => {
    const mockResponse: NavigatorExecutionResponse = {
      reply: "설문지 폼으로 이동합니다.",
      action: {
        type: "NAVIGATE",
        targetPath: "/builder/forms/my-survey",
      },
    };

    vi.mocked(httpClient.post).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useNavigatorMutation(), { wrapper });

    result.current.mutate({
      mode: "builder",
      prompt: "내 설문지로 가줘",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
  });
});
