import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedForms, usePublishedFormsQuery } from "./use-published-forms.query";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const createWrapper = (queryClient: QueryClient) => {
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("usePublishedFormsQuery (발행된 폼 목록 조회 훅)", () => {
  let queryClient: QueryClient;

  const mockPublishedForms = [
    {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      slug: "published-form-1",
      title: "발행된 설문지 1",
      description: "응답 가능한 설문지입니다.",
      schemaDefinition: { fields: [] },
      publishedAt: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getPublishedForms 순수 함수가 /api/v1/forms?published=true GET 요청을 수행해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockPublishedForms,
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    const result = await getPublishedForms();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/forms?published=true",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual(mockPublishedForms);
  });

  it("usePublishedFormsQuery 훅이 발행된 폼 목록을 성공적으로 반환해야 한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockPublishedForms,
      }),
    } as unknown as Response);

    const { result } = renderHook(() => usePublishedFormsQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPublishedForms);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.slug).toBe("published-form-1");
  });
});
