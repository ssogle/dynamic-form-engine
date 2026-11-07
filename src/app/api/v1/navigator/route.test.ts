import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as navigatorServer from "@/features/execute-navigator-builder-action/server";
import { POST } from "./route";

// navigator engine 서비스 모킹
vi.mock("@/features/execute-navigator-builder-action/server", () => ({
  runNavigatorEngine: vi.fn(),
}));

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

  it("올바른 페이로드가 전달되면 runNavigatorEngine을 호출하고 200 성공 응답을 반환해야 한다", async () => {
    const mockExecutionResponse = {
      reply: "테스트 설문 화면으로 이동합니다.",
      action: {
        type: "NAVIGATE" as const,
        targetPath: "/builder/forms/test-survey",
        message: "테스트 설문 화면으로 이동합니다.",
      },
      updatedForm: null,
      toolCalls: [
        {
          toolName: "navigate",
          args: { targetPath: "/builder/forms/test-survey" },
        },
      ],
    };

    vi.spyOn(navigatorServer, "runNavigatorEngine").mockResolvedValueOnce(mockExecutionResponse);

    const request = new NextRequest("http://localhost:3000/api/v1/navigator", {
      method: "POST",
      body: JSON.stringify({
        prompt: "테스트 설문으로 이동해줘",
        messages: [
          {
            role: "user",
            content: "이전 발화",
          },
        ],
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

    expect(navigatorServer.runNavigatorEngine).toHaveBeenCalledWith({
      prompt: "테스트 설문으로 이동해줘",
      messages: [
        {
          role: "user",
          content: "이전 발화",
        },
      ],
      currentContext: {
        currentPath: "/builder/forms",
      },
    });
  });
});
