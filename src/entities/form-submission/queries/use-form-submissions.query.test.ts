import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFormSubmissions,
  getFormSubmissionDetail,
  useFormSubmissionsQuery,
  useInfiniteFormSubmissionsQuery,
  useFormSubmissionDetailQuery,
} from "./use-form-submissions.query";

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
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("useFormSubmissionsQuery (특정 폼의 응답 목록 조회 훅)", () => {
  let queryClient: QueryClient;

  const mockSubmissions = [
    {
      id: "sub-1",
      formId: "form-1",
      data: { name: "홍길동" },
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

  it("getFormSubmissions 함수가 올바른 엔드포인트로 GET 요청을 수행해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockSubmissions,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const data = await getFormSubmissions("daily-report");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/forms/daily-report/submissions",
      expect.objectContaining({ method: "GET" })
    );
    expect(data).toEqual(mockSubmissions);
  });

  it("useFormSubmissionsQuery가 성공적으로 데이터를 로드해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockSubmissions,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useFormSubmissionsQuery("daily-report"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSubmissions);
  });

  it("getFormSubmissionDetail 함수가 올바른 URL로 단건 조회를 수행해야 한다", async () => {
    const mockSingle = mockSubmissions[0];
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockSingle,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const data = await getFormSubmissionDetail("daily-report", "sub-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/forms/daily-report/submissions/sub-1",
      expect.objectContaining({ method: "GET" })
    );
    expect(data).toEqual(mockSingle);
  });

  it("useFormSubmissionDetailQuery가 단건 응답 상세 데이터를 정상 로드해야 한다", async () => {
    const mockSingle = mockSubmissions[0];
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockSingle,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useFormSubmissionDetailQuery("daily-report", "sub-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSingle);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/forms/daily-report/submissions/sub-1",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("useInfiniteFormSubmissionsQuery가 페이지 파라미터와 함께 무한 스크롤 데이터를 페칭해야 한다", async () => {
    const mockPaginated = {
      items: mockSubmissions,
      page: 1,
      limit: 20,
      totalCount: 1,
      totalPages: 1,
      hasMore: false,
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockPaginated,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(
      () =>
        useInfiniteFormSubmissionsQuery("form-1", {
          sort: "f_exp:desc",
          filters: JSON.stringify({ f_role: "frontend" }),
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]).toEqual(mockPaginated);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("sort=f_exp%3Adesc"),
      expect.anything()
    );
  });
});
