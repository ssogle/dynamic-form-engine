import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import { executeNavigatorActionStream, useNavigatorMutation } from "./use-navigator.mutation";
import type { NavigatorExecutionResponse } from "../types/navigator-action.types";

vi.mock("@/shared/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/http")>();
  return {
    ...actual,
    httpClient: {
      ...actual.httpClient,
      post: vi.fn(),
    },
  };
});

describe("useNavigatorMutation (features/execute-navigator-action/queries)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it("executeNavigatorAction 성공 시 응답 데이터를 정상 반환해야 한다", async () => {
    const mockResponse: NavigatorExecutionResponse = {
      reply: "설문지 폼으로 이동합니다.",
      action: {
        type: "NAVIGATE",
        targetPath: "/builder/forms/my-survey",
      },
    };

    vi.mocked(httpClient.post).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useNavigatorMutation(), { wrapper });

    result.current.mutate({
      mode: "builder",
      prompt: "내 설문지로 가줘",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
  });

  it("executeNavigatorActionStream은 NDJSON status 이벤트를 onProgress로 전달하고 최종 result를 반환해야 한다", async () => {
    const encoder = new TextEncoder();
    const mockResult: NavigatorExecutionResponse = {
      reply: "갱신 완료",
      action: null,
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "status", message: "집계 중..." })}\n`)
        );
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "result", data: mockResult })}\n`)
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        })
      )
    );

    const statuses: Array<{ msg: string; isHeartbeat?: boolean | undefined }> = [];
    const data = await executeNavigatorActionStream(
      { mode: "analyst", prompt: "갱신" },
      (msg, meta) => statuses.push({ msg, isHeartbeat: meta?.isHeartbeat })
    );

    expect(statuses).toEqual([{ msg: "집계 중...", isHeartbeat: false }]);
    expect(data).toEqual(mockResult);
    vi.unstubAllGlobals();
  });

  it("executeNavigatorActionStream은 heartbeat 이벤트 수신 시 isHeartbeat: true 메타와 함께 onProgress를 호출해야 한다", async () => {
    const encoder = new TextEncoder();
    const mockResult: NavigatorExecutionResponse = {
      reply: "완료",
      action: null,
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "status", message: "데이터 조회 중..." })}\n`)
        );
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: "heartbeat", message: "AI가 분석 작업을 진행하고 있습니다... (3초 경과)" })}\n`
          )
        );
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "result", data: mockResult })}\n`)
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        })
      )
    );

    const received: Array<{ msg: string; isHeartbeat?: boolean | undefined }> = [];
    const data = await executeNavigatorActionStream(
      { mode: "analyst", prompt: "갱신" },
      (msg, meta) => received.push({ msg, isHeartbeat: meta?.isHeartbeat })
    );

    expect(received).toEqual([
      { msg: "데이터 조회 중...", isHeartbeat: false },
      { msg: "AI가 분석 작업을 진행하고 있습니다... (3초 경과)", isHeartbeat: true },
    ]);
    expect(data).toEqual(mockResult);
    vi.unstubAllGlobals();
  });

  it("executeNavigatorActionStream은 스트림 내 error 이벤트 수신 시 예외를 throw해야 한다", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "status", message: "시작" })}\n`)
        );
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "error", message: "스텝 시간 초과" })}\n`)
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        })
      )
    );

    await expect(
      executeNavigatorActionStream({ mode: "analyst", prompt: "갱신" }, vi.fn())
    ).rejects.toThrow("스텝 시간 초과");
    vi.unstubAllGlobals();
  });

  it("executeNavigatorActionStream은 result 이벤트 없이 스트림이 종료되면 비정상 종료 예외를 throw해야 한다", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "status", message: "준비 중..." })}\n`)
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        })
      )
    );

    await expect(
      executeNavigatorActionStream({ mode: "analyst", prompt: "갱신" }, vi.fn())
    ).rejects.toThrow("AI 네비게이터 응답 스트림이 비정상 종료되었습니다.");
    vi.unstubAllGlobals();
  });
});
