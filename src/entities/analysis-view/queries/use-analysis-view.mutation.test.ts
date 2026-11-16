import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analysisViewKeys } from "./analysis-view.keys";
import {
  deleteAnalysisView,
  publishAnalysisView,
  useDeleteAnalysisViewMutation,
  usePublishAnalysisViewMutation,
} from "./use-analysis-view.mutation";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const createWrapper = (queryClient: QueryClient) => {
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("useAnalysisViewMutation", () => {
  const sampleId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const sampleView = {
    id: sampleId,
    title: "분석 뷰",
    description: null,
    blocks: [],
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    publishedAt: "2026-11-16T01:00:00.000Z",
    deletedAt: null,
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishAnalysisView 및 usePublishAnalysisViewMutation은 POST 발행 요청 후 캐시를 무효화해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: sampleView }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    await publishAnalysisView(sampleId, true);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/analysis-views/${sampleId}/publish`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ isPublished: true }),
      })
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => usePublishAnalysisViewMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: sampleId, isPublished: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: analysisViewKeys.all });
  });

  it("deleteAnalysisView 및 useDeleteAnalysisViewMutation은 DELETE 요청 후 캐시를 무효화해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: sampleView }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    await deleteAnalysisView(sampleId);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/analysis-views/${sampleId}`,
      expect.objectContaining({ method: "DELETE" })
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteAnalysisViewMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(sampleId);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: analysisViewKeys.all });
  });
});
