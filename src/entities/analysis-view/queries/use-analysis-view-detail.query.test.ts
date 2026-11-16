import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAnalysisViewDetail,
  useAnalysisViewDetailQuery,
} from "./use-analysis-view-detail.query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("useAnalysisViewDetailQuery", () => {
  const sampleId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const sampleView = {
    id: sampleId,
    title: "상세 분석 뷰",
    description: null,
    blocks: [],
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    publishedAt: null,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishedOnly 옵션 여부에 따라 올바른 상세 URL을 호출해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: sampleView }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    await getAnalysisViewDetail(sampleId);
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/analysis-views/${sampleId}`,
      expect.any(Object)
    );

    await getAnalysisViewDetail(sampleId, { publishedOnly: true });
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/v1/analysis-views/${sampleId}?published=true`,
      expect.any(Object)
    );
  });

  it("useAnalysisViewDetailQuery는 viewId가 비어있으면 요청하지 않고 존재 시 상세를 반환해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: sampleView }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    const empty = renderHook(() => useAnalysisViewDetailQuery(""), { wrapper: createWrapper() });
    expect(empty.result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();

    const { result } = renderHook(() => useAnalysisViewDetailQuery(sampleId), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleView);
  });
});
