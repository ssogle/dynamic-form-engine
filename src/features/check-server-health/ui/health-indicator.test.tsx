import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthIndicator } from "./health-indicator";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("<HealthIndicator /> (서버 헬스체크 상태 컴포넌트)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("로딩 중에는 '서버 상태 확인 중...' 문구를 표시해야 한다", () => {
    // 무한 대기 Promise로 로딩 상태 유지
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

    renderWithClient(<HealthIndicator />);
    expect(screen.getByText("서버 상태 확인 중...")).toBeInTheDocument();
  });

  it("서버 응답 성공 시 '서버 정상 작동 중' 문구와 타임스탬프를 표시해야 한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: {
          status: "ok",
          timestamp: "2026-11-05T00:00:00.000Z",
        },
      }),
    } as Response);

    renderWithClient(<HealthIndicator />);

    await waitFor(() => {
      expect(screen.getByText("서버 정상 작동 중")).toBeInTheDocument();
    });
    expect(screen.getByText(/2026-11-05/)).toBeInTheDocument();
  });

  it("서버 응답 실패 시 '서버 연결 실패' 문구를 표시해야 한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "서버 에러",
        },
      }),
    } as Response);

    renderWithClient(<HealthIndicator />);

    await waitFor(() => {
      expect(screen.getByText("서버 연결 실패")).toBeInTheDocument();
    });
  });
});
