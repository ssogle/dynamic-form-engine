import { NextRequest } from "next/server";
import {
  runNavigatorEngine,
  navigatorRequestSchema,
} from "@/features/execute-navigator-action/server";
import { apiResponse, parseRequestData, withErrorHandler } from "@/shared/lib/http";

/**
 * AI Navigator 통합 HTTP 엔드포인트 핸들러 (POST /api/v1/navigator)
 *
 * - 기본 요청: 단건 JSON 응답 (`{ success: true, data: NavigatorExecutionResponse }`)
 * - `?stream=1` 요청: `application/x-ndjson` 진행 상태(`status`) + 최종 결과(`result`) 스트림 응답
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const json: unknown = await request.json().catch(() => null);
  const parsedRequest = parseRequestData(
    navigatorRequestSchema,
    json,
    "요청 페이로드가 올바르지 않습니다."
  );

  const streamParam = request.nextUrl.searchParams.get("stream");
  const isStreamRequested = streamParam === "1" || streamParam === "true";

  if (!isStreamRequested) {
    const result = await runNavigatorEngine(parsedRequest);
    return apiResponse.ok(result);
  }

  const encoder = new TextEncoder();
  const streamAbortController = new AbortController();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;

  const cleanupStream = (onRequestAbort?: () => void) => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (onRequestAbort) {
      request.signal.removeEventListener("abort", onRequestAbort);
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastEventAt = startedAt;

      const enqueueEvent = (event: Record<string, unknown>) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          lastEventAt = Date.now();
        } catch {
          isClosed = true;
        }
      };

      const onRequestAbort = () => {
        streamAbortController.abort();
      };

      if (request.signal.aborted) {
        streamAbortController.abort();
      } else {
        request.signal.addEventListener("abort", onRequestAbort, { once: true });
      }

      // LLM 단일 스텝이 길어져도 첫 청크 이후 스트림 침묵이 발생하지 않도록 3초마다 경과 상태를 전송합니다.
      heartbeatTimer = setInterval(() => {
        if (isClosed || streamAbortController.signal.aborted) return;
        if (Date.now() - lastEventAt >= 2_800) {
          const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
          enqueueEvent({
            type: "status",
            message: `AI가 분석 작업을 진행하고 있습니다... (${elapsedSec}초 경과)`,
          });
        }
      }, 3_000);

      try {
        const result = await runNavigatorEngine(parsedRequest, {
          abortSignal: streamAbortController.signal,
          onProgress: (message) => {
            enqueueEvent({ type: "status", message });
          },
        });
        enqueueEvent({ type: "result", data: result });
      } catch (err) {
        const errorMessage = streamAbortController.signal.aborted
          ? "요청이 중단되었거나 응답 제한 시간을 초과했습니다. 다시 시도해 주세요."
          : err instanceof Error
            ? err.message
            : "AI 네비게이터 처리 중 오류가 발생했습니다.";
        enqueueEvent({
          type: "error",
          message: errorMessage,
        });
      } finally {
        cleanupStream(onRequestAbort);
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {
            // 이미 닫힌 스트림 무시
          }
        }
      }
    },
    cancel() {
      isClosed = true;
      streamAbortController.abort();
      cleanupStream();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
