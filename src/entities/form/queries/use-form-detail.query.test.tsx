import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFormDetail, useFormDetailQuery } from "./use-form-detail.query";

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

describe("useFormDetailQuery (폼 단건 상세 조회 훅)", () => {
  let queryClient: QueryClient;

  const mockForm = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    slug: "project-info",
    title: "프로젝트 정보 등록",
    description: "신규 프로젝트 폼입니다.",
    schemaDefinition: { fields: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getFormDetail 순수 함수가 올바른 엔드포인트를 호출해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: mockForm }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    const result = await getFormDetail("project-info");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/forms/project-info",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual(mockForm);
  });

  it("성공적으로 단건 폼 데이터를 받아와 캐싱해야 한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockForm }),
      } as unknown as Response)
    );

    const { result } = renderHook(() => useFormDetailQuery("project-info"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockForm);
    expect(result.current.data?.slug).toBe("project-info");
  });

  it("identifier가 비어있으면 enabled: false가 되어 쿼리를 실행하지 않아야 한다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFormDetailQuery(""), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서버 오류 응답 시 에러 상태를 올바르게 반영해야 한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "NOT_FOUND", message: "존재하지 않는 폼입니다." },
        }),
      } as unknown as Response)
    );

    const { result } = renderHook(() => useFormDetailQuery("non-existent"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.status).toBe(404);
    expect(result.current.error?.code).toBe("NOT_FOUND");
  });
});
