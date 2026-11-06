import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getForms, useFormsQuery } from "./use-forms.query";

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

describe("useFormsQuery (엔티티 공용 폼 목록 조회 훅)", () => {
  let queryClient: QueryClient;

  const mockForms = [
    {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      slug: "sample-form-1",
      title: "샘플 폼 1",
      description: "설명 1",
      schemaDefinition: { fields: [] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
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

  it("getForms 순수 함수가 /api/v1/forms GET 요청을 수행해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: mockForms }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    const result = await getForms();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/forms",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual(mockForms);
  });

  it("useFormsQuery 훅이 서버로부터 폼 목록을 성공적으로 받아와야 한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: mockForms }),
    } as unknown as Response);

    const { result } = renderHook(() => useFormsQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockForms);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.slug).toBe("sample-form-1");
  });
});
