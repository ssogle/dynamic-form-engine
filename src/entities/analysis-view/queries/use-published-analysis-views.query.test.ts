import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedAnalysisViews,
  usePublishedAnalysisViewsQuery,
} from "./use-published-analysis-views.query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("usePublishedAnalysisViewsQuery", () => {
  const sampleView = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    title: "발행된 분석 뷰",
    description: null,
    blocks: [],
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    publishedAt: "2026-11-16T01:00:00.000Z",
    deletedAt: null,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getPublishedAnalysisViews는 published=true 파라미터와 함께 조회해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: [sampleView] }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    const data = await getPublishedAnalysisViews();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/analysis-views?published=true",
      expect.any(Object)
    );
    expect(data).toEqual([sampleView]);
  });

  it("usePublishedAnalysisViewsQuery는 발행 목록 데이터를 반환해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: [sampleView] }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => usePublishedAnalysisViewsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleView]);
  });
});
