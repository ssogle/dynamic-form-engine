import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "./client";
import { isHttpError } from "./errors";
import type { HttpErrorData } from "./types";

describe("HTTP Client Utilities (httpClient)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("성공 응답 시 봉투 껍데기 없이 순수 data 객체만 바로 반환해야 한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: { id: "form_1", title: "출장 신청서" },
      }),
    } as unknown as Response);

    const data = await httpClient.get<{ id: string; title: string }>("/api/v1/forms/form_1");

    expect(data).toEqual({ id: "form_1", title: "출장 신청서" });
  });

  it("쿼리 파라미터(params)가 URL에 올바르게 인코딩되어야 한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, data: [] }),
    } as unknown as Response);

    global.fetch = fetchMock;

    await httpClient.get("/api/v1/forms", {
      params: { page: 1, search: "신청서", empty: undefined },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/forms?page=1&search=%EC%8B%A0%EC%B2%AD%EC%84%9C",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("HTTP 404 에러 응답 시 정규화된 HttpErrorData를 throw해야 한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "폼을 찾을 수 없습니다.",
        },
      }),
    } as unknown as Response);

    try {
      await httpClient.get("/api/v1/forms/invalid");
      expect.unreachable("에러가 throw되어야 합니다");
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      const httpError = error as HttpErrorData;
      expect(httpError.status).toBe(404);
      expect(httpError.code).toBe("NOT_FOUND");
      expect(httpError.message).toBe("폼을 찾을 수 없습니다.");
    }
  });

  it("네트워크 연결 실패 시 status: 0, code: NETWORK_ERROR인 HttpErrorData를 throw해야 한다", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    try {
      await httpClient.get("/api/v1/forms");
      expect.unreachable("네트워크 에러가 throw되어야 합니다");
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      const httpError = error as HttpErrorData;
      expect(httpError.status).toBe(0);
      expect(httpError.code).toBe("NETWORK_ERROR");
      expect(httpError.message).toBe("Failed to fetch");
    }
  });

  it("streamNdjson은 청크 경계에 걸쳐 분할된 NDJSON 라인을 순차 파싱해 onEvent로 전달해야 한다", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"status","message":"준비'));
        controller.enqueue(encoder.encode(' 중..."}\n{"type":"result","data":{"ok":true}}\n'));
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      })
    );
    global.fetch = fetchMock;

    const events: unknown[] = [];
    await httpClient.streamNdjson(
      "/api/v1/navigator",
      { prompt: "테스트" },
      {
        params: { stream: 1 },
        onEvent: (event) => {
          events.push(event);
        },
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/navigator?stream=1",
      expect.objectContaining({ method: "POST" })
    );
    expect(events).toEqual([
      { type: "status", message: "준비 중..." },
      { type: "result", data: { ok: true } },
    ]);
  });

  it("streamNdjson은 무활동 타임아웃 초과 시 STREAM_TIMEOUT HttpErrorData를 throw해야 한다", async () => {
    vi.useFakeTimers();
    try {
      const encoder = new TextEncoder();
      const hangingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{"type":"status","message":"첫 줄"}\n'));
          // 의도적으로 close 하지 않고 대기 상태를 유지합니다.
        },
      });

      global.fetch = vi.fn().mockResolvedValue(
        new Response(hangingStream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        })
      );

      const events: unknown[] = [];
      const streamPromise = httpClient.streamNdjson(
        "/api/v1/navigator",
        { prompt: "테스트" },
        {
          inactivityTimeoutMs: 5_000,
          onEvent: (event) => {
            events.push(event);
          },
        }
      );

      const assertion = expect(streamPromise).rejects.toMatchObject({
        status: 408,
        code: "STREAM_TIMEOUT",
        isHttpError: true,
      });

      await vi.advanceTimersByTimeAsync(5_500);
      await assertion;
      expect(events).toEqual([{ type: "status", message: "첫 줄" }]);
    } finally {
      vi.useRealTimers();
    }
  });
});
