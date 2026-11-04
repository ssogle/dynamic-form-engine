import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHealthQuery } from "./use-health.query";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("useHealthQuery (서버 헬스체크 쿼리 훅)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("서버 호출 성공 시 순수 HealthCheckResponseDto 데이터를 정상적으로 반환해야 한다", async () => {
    const mockHealthData = {
      status: "ok",
      timestamp: "2026-11-05T00:00:00.000Z",
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockHealthData,
      }),
    } as Response);

    const { result } = renderHook(() => useHealthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.status).toBe("ok");
    expect(result.current.data?.timestamp).toBe("2026-11-05T00:00:00.000Z");
  });

  it("서버 호출 실패 시 isError가 true가 되고 error에 HttpErrorData가 담겨야 한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "서버 내부 오류",
        },
      }),
    } as Response);

    const { result } = renderHook(() => useHealthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.status).toBe(500);
    expect(result.current.error?.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.current.error?.message).toBe("서버 내부 오류");
  });
});
