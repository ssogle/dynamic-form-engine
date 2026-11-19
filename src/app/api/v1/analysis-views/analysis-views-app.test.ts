import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisView } from "@/entities/analysis-view";
import * as analysisViewServer from "@/entities/analysis-view/server";
import * as analysisViewsRouteModule from "./[[...route]]/route";
import { analysisViewsApp } from "./analysis-views-app";

// 엔티티 서버 DB 함수들을 모킹하여 API 라우터, 미들웨어, 도메인 검증 계약을 순수하게 검증합니다.
vi.mock("@/entities/analysis-view/server", () => ({
  findActiveAnalysisViews: vi.fn(),
  findPublishedAnalysisViews: vi.fn(),
  findAnalysisViewById: vi.fn(),
  publishAnalysisViewById: vi.fn(),
  softDeleteAnalysisViewById: vi.fn(),
}));

const VALID_VIEW_ID = "550e8400-e29b-41d4-a716-446655440101";
const BLOCK_ID = "660e8400-e29b-41d4-a716-446655440202";

const createMockAnalysisView = (overrides: Partial<AnalysisView> = {}): AnalysisView => ({
  id: VALID_VIEW_ID,
  title: "월별 만족도 비교 리포트",
  description: "1월과 2월 만족도 지표 비교",
  blocks: [
    {
      id: BLOCK_ID,
      type: "text",
      title: "핵심 요약",
      content: "전월 대비 만족도가 상승했습니다.",
    },
  ],
  publishedAt: new Date("2026-02-01T00:00:00.000Z"),
  version: 1,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

describe("analysisViewsApp (Hono Unified API Router)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/v1/analysis-views", () => {
    it("returns active analysis views by default", async () => {
      vi.mocked(analysisViewServer.findActiveAnalysisViews).mockResolvedValue([
        createMockAnalysisView(),
      ]);

      const res = await analysisViewsApp.request("/api/v1/analysis-views");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { success: boolean; data: Array<{ id: string }> };
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0]?.id).toBe(VALID_VIEW_ID);
      expect(analysisViewServer.findActiveAnalysisViews).toHaveBeenCalledTimes(1);
      expect(analysisViewServer.findPublishedAnalysisViews).not.toHaveBeenCalled();
    });

    it("returns only published analysis views when ?published=true is provided", async () => {
      vi.mocked(analysisViewServer.findPublishedAnalysisViews).mockResolvedValue([
        createMockAnalysisView(),
      ]);

      const res = await analysisViewsApp.request("/api/v1/analysis-views?published=true");
      expect(res.status).toBe(200);
      expect(analysisViewServer.findPublishedAnalysisViews).toHaveBeenCalledTimes(1);
      expect(analysisViewServer.findActiveAnalysisViews).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/analysis-views/:id", () => {
    it("returns 400 BAD_REQUEST for invalid UUID parameter", async () => {
      const res = await analysisViewsApp.request("/api/v1/analysis-views/not-a-uuid");
      expect(res.status).toBe(400);

      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("returns 404 NOT_FOUND when analysis view does not exist", async () => {
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(undefined);

      const res = await analysisViewsApp.request(`/api/v1/analysis-views/${VALID_VIEW_ID}`);
      expect(res.status).toBe(404);
    });

    it("returns 200 for draft view when ?published=true is omitted", async () => {
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(
        createMockAnalysisView({ publishedAt: null })
      );

      const res = await analysisViewsApp.request(`/api/v1/analysis-views/${VALID_VIEW_ID}`);
      expect(res.status).toBe(200);
    });

    it("returns 404 NOT_FOUND for draft view when ?published=true is provided", async () => {
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(
        createMockAnalysisView({ publishedAt: null })
      );

      const res = await analysisViewsApp.request(
        `/api/v1/analysis-views/${VALID_VIEW_ID}?published=true`
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/analysis-views/:id/publish", () => {
    it("rejects publishing with 400 BAD_REQUEST when view has 0 blocks", async () => {
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(
        createMockAnalysisView({ blocks: [], publishedAt: null })
      );

      const res = await analysisViewsApp.request(
        `/api/v1/analysis-views/${VALID_VIEW_ID}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublished: true }),
        }
      );

      expect(res.status).toBe(400);
      expect(analysisViewServer.publishAnalysisViewById).not.toHaveBeenCalled();
    });

    it("publishes an analysis view that has at least 1 block (supports empty body default true)", async () => {
      const published = createMockAnalysisView();
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(
        createMockAnalysisView({ publishedAt: null })
      );
      vi.mocked(analysisViewServer.publishAnalysisViewById).mockResolvedValue(published);

      const res = await analysisViewsApp.request(
        `/api/v1/analysis-views/${VALID_VIEW_ID}/publish`,
        { method: "POST" }
      );

      expect(res.status).toBe(200);
      expect(analysisViewServer.publishAnalysisViewById).toHaveBeenCalledWith(VALID_VIEW_ID, true);
    });

    it("allows unpublishing (isPublished: false) even when blocks are empty", async () => {
      const unpublished = createMockAnalysisView({ blocks: [], publishedAt: null });
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(
        createMockAnalysisView({ blocks: [] })
      );
      vi.mocked(analysisViewServer.publishAnalysisViewById).mockResolvedValue(unpublished);

      const res = await analysisViewsApp.request(
        `/api/v1/analysis-views/${VALID_VIEW_ID}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublished: false }),
        }
      );

      expect(res.status).toBe(200);
      expect(analysisViewServer.publishAnalysisViewById).toHaveBeenCalledWith(VALID_VIEW_ID, false);
    });
  });

  describe("DELETE /api/v1/analysis-views/:id", () => {
    it("soft deletes an existing analysis view and returns deleted entity", async () => {
      const deleted = createMockAnalysisView({ deletedAt: new Date("2026-02-02T00:00:00.000Z") });
      vi.mocked(analysisViewServer.findAnalysisViewById).mockResolvedValue(
        createMockAnalysisView()
      );
      vi.mocked(analysisViewServer.softDeleteAnalysisViewById).mockResolvedValue(deleted);

      const res = await analysisViewsApp.request(`/api/v1/analysis-views/${VALID_VIEW_ID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(analysisViewServer.softDeleteAnalysisViewById).toHaveBeenCalledWith(VALID_VIEW_ID);
    });
  });

  describe("Catch-All Route Handler Exports", () => {
    it("exports only GET, POST, DELETE from [[...route]]/route.ts and handles NextRequest", async () => {
      expect(typeof analysisViewsRouteModule.GET).toBe("function");
      expect(typeof analysisViewsRouteModule.POST).toBe("function");
      expect(typeof analysisViewsRouteModule.DELETE).toBe("function");
      expect("PATCH" in analysisViewsRouteModule).toBe(false);
      expect("PUT" in analysisViewsRouteModule).toBe(false);

      vi.mocked(analysisViewServer.findActiveAnalysisViews).mockResolvedValue([
        createMockAnalysisView(),
      ]);
      const req = new NextRequest("http://localhost:3000/api/v1/analysis-views");
      const res = await analysisViewsRouteModule.GET(req);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: Array<{ id: string }> };
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });
  });
});
