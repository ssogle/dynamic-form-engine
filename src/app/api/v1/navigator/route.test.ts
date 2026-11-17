import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as navigatorServer from "@/features/execute-navigator-action/server";
import { POST } from "./route";

// navigator engine 서비스 모킹
vi.mock("@/features/execute-navigator-action/server", async () => {
  const actual = await vi.importActual<typeof navigatorServer>(
    "@/features/execute-navigator-action/server"
  );
  return {
    ...actual,
    runNavigatorEngine: vi.fn(),
  };
});

describe("POST /api/v1/navigator (AI Navigator Thin Route Handler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("요청 페이로드에 prompt가 누락된 경우 400 에러를 반환해야 한다", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("기본(builder) 모드로 요청 시 runNavigatorEngine을 호출하고 200 성공 응답을 반환해야 한다", async () => {
    const mockExecutionResponse = {
      reply: "테스트 설문 화면으로 이동합니다.",
      action: {
        type: "NAVIGATE" as const,
        targetPath: "/builder/forms/test-survey",
        message: "테스트 설문 화면으로 이동합니다.",
      },
      updatedForm: null,
    };

    vi.spyOn(navigatorServer, "runNavigatorEngine").mockResolvedValueOnce(mockExecutionResponse);

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "테스트 설문으로 이동해줘",
        mode: "builder",
        messages: [{ role: "user", content: "이전 발화" }],
        currentContext: {
          currentPath: "/builder/forms",
        },
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(mockExecutionResponse);
    expect(navigatorServer.runNavigatorEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "builder",
        prompt: "테스트 설문으로 이동해줘",
      })
    );
  });

  it("mode: 'consumer'로 요청 시 runNavigatorEngine에 mode: 'consumer'를 전달하고 200 성공 응답을 반환해야 한다", async () => {
    const mockConsumerResponse = {
      reply: "지원서 화면으로 이동합니다.",
      action: {
        type: "NAVIGATE" as const,
        targetPath: "/consumer/forms/developer-hire",
        message: "지원서 화면으로 이동합니다.",
      },
    };

    vi.spyOn(navigatorServer, "runNavigatorEngine").mockResolvedValueOnce(mockConsumerResponse);

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        mode: "consumer",
        prompt: "채용 지원서 작성하러 갈래",
        currentContext: {
          currentPath: "/consumer/forms",
        },
      }),
    });

    const response = await POST(request, {});
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(mockConsumerResponse);
    expect(navigatorServer.runNavigatorEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "consumer",
        prompt: "채용 지원서 작성하러 갈래",
      })
    );
  });

  it("?stream=1 요청 시 NDJSON 스트림으로 status 이벤트와 최종 result 이벤트를 반환해야 한다", async () => {
    const mockStreamResponse = {
      reply: "집계 완료",
      action: null,
    };

    vi.spyOn(navigatorServer, "runNavigatorEngine").mockImplementationOnce(
      async (_payload, options) => {
        options?.onProgress?.("데이터를 집계하고 있습니다...");
        return mockStreamResponse;
      }
    );

    const request = new NextRequest("http://localhost:3000/api/v1/navigator?stream=1", {
      method: "POST",
      body: JSON.stringify({
        mode: "analyst",
        prompt: "비용 집계해줘",
      }),
    });

    const response = await POST(request, {});
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");

    const text = await response.text();
    const lines = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; message?: string; data?: unknown });

    expect(lines).toEqual([
      { type: "status", message: "데이터를 집계하고 있습니다..." },
      { type: "result", data: mockStreamResponse },
    ]);
  });

  it("?stream=1 요청 중 응답이 지연되면 3초 간격으로 status와 구분된 heartbeat 이벤트를 전송해야 한다", async () => {
    vi.useFakeTimers();
    try {
      const mockStreamResponse = {
        reply: "지연 후 완료",
        action: null,
      };

      let resolveEngine: ((value: typeof mockStreamResponse) => void) | undefined;
      vi.spyOn(navigatorServer, "runNavigatorEngine").mockImplementationOnce(
        async (_payload, options) => {
          options?.onProgress?.("스키마를 분석하고 있습니다...");
          return new Promise((resolve) => {
            resolveEngine = resolve;
          });
        }
      );

      const request = new NextRequest("http://localhost:3000/api/v1/navigator?stream=1", {
        method: "POST",
        body: JSON.stringify({
          mode: "builder",
          prompt: "폼 분석해줘",
        }),
      });

      const response = await POST(request, {});
      // onProgress 직후 lastEventAt이 갱신되므로 3초 + 3초 경과시켜 heartbeat 발생 유도
      await vi.advanceTimersByTimeAsync(6_200);
      resolveEngine?.(mockStreamResponse);

      const text = await response.text();
      const lines = text
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { type: string; message?: string; data?: unknown });

      expect(lines[0]).toEqual({ type: "status", message: "스키마를 분석하고 있습니다..." });
      expect(lines.some((line) => line.type === "heartbeat")).toBe(true);
      expect(lines[lines.length - 1]).toEqual({ type: "result", data: mockStreamResponse });
    } finally {
      vi.useRealTimers();
    }
  });
});
