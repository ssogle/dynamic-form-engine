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
});
