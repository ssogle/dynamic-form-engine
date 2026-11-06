import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formKeys } from "@/entities/form";
import type { NavigatorExecutionResponse } from "../types/action.types";
import { executeNavigatorAction, useNavigatorActionMutation } from "./use-navigator.mutation";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe("useNavigatorActionMutation (네비게이터 액션 뮤테이션 훅)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockResponse: NavigatorExecutionResponse = {
    reply: "고객 피드백 설문지가 생성되었습니다.",
    action: {
      type: "CREATE_FORM",
      slug: "customer-feedback",
      title: "고객 피드백 설문지",
      fields: [
        {
          id: "f_name",
          name: "customerName",
          label: "고객 성함",
          type: "text",
          required: true,
        },
      ],
      message: "고객 피드백 설문지가 생성되었습니다.",
    },
    updatedForm: {
      slug: "customer-feedback",
      title: "고객 피드백 설문지",
      fields: [
        {
          id: "f_name",
          name: "customerName",
          label: "고객 성함",
          type: "text",
          required: true,
        },
      ],
    },
  };

  it("executeNavigatorAction API 호출이 성공하면 NavigatorExecutionResponse를 반환해야 한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    } as unknown as Response);

    const result = await executeNavigatorAction({
      prompt: "고객 피드백 설문지 생성해줘",
    });

    expect(result).toEqual(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/navigator",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "고객 피드백 설문지 생성해줘" }),
      })
    );
  });

  it("뮤테이션 성공 시 updatedForm이 있으면 해당 슬러그의 상세 캐시를 즉시 갱신하고 목록을 무효화해야 한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    } as unknown as Response);

    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useNavigatorActionMutation(), { wrapper });

    result.current.mutate({
      prompt: "고객 피드백 설문지 생성해줘",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 1. 해당 폼 상세 캐시 즉시 갱신 검증
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      formKeys.detail("customer-feedback"),
      mockResponse.updatedForm
    );

    // 2. 폼 목록 캐시 무효화 검증
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: formKeys.all,
    });
  });

  it("API가 실패 응답을 반환할 경우 에러 상태로 전이되어야 한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "요청 페이로드가 올바르지 않습니다.",
        },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useNavigatorActionMutation(), { wrapper });

    result.current.mutate({
      prompt: "",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("요청 페이로드가 올바르지 않습니다.");
  });
});
