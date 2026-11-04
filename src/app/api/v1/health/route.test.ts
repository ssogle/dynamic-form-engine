import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("GET /api/v1/health (API v1 헬스체크 엔드포인트)", () => {
  it("정상 호출 시 200 상태 코드와 함께 { success: true, data: { status: 'ok', ... } } JSON 응답을 반환해야 한다", async () => {
    // 1. /api/v1/health URI로 NextRequest 생성
    const request = new NextRequest("http://localhost:3000/api/v1/health");

    // 2. GET 핸들러 실행
    const response = await GET(request, {});

    // 3. HTTP 상태 코드 검증
    expect(response.status).toBe(200);

    // 4. 응답 본문 검증
    const json = (await response.json()) as {
      success: boolean;
      data: { status: string; timestamp: string };
    };

    expect(json.success).toBe(true);
    expect(json.data.status).toBe("ok");
    expect(typeof json.data.timestamp).toBe("string");
    // ISO 8601 날짜 형식 유효성 검증
    expect(new Date(json.data.timestamp).getTime()).not.toBeNaN();
  });
});
