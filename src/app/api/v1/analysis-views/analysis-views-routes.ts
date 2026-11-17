import { z } from "zod";
import { extractAnalysisBlocks } from "@/entities/analysis-view";
import {
  findActiveAnalysisViews,
  findPublishedAnalysisViews,
  publishAnalysisViewById,
  softDeleteAnalysisViewById,
} from "@/entities/analysis-view/server";
import { apiResponse, badRequest, notFound } from "@/shared/lib/http";
import { createSubRouter } from "../_lib/create-api-router";
import { parseJsonBody, parseQueryParams } from "../_lib/request-helpers";
import type { AnalysisViewsRouterVariables } from "./analysis-views-middleware";

const analysisViewsQuerySchema = z.object({
  published: z.enum(["true", "false"]).optional(),
});

const publishAnalysisViewBodySchema = z.object({
  isPublished: z
    .boolean({ message: "발행 여부(isPublished)는 불리언 값이어야 합니다." })
    .default(true),
});

/**
 * `/api/v1/analysis-views` 최소 HTTP 라우터
 *
 * 생성 및 블록 단위 수정/재집계는 AI Navigator(`/api/v1/navigator`, mode="analyst")가 서버 도구로 직접 처리하며,
 * 본 라우터는 UI가 실제로 호출하는 4개 엔드포인트(목록/상세 조회, 발행 토글, 단건 소프트 삭제)만 노출합니다.
 */
export const analysisViewsRoutes = createSubRouter<AnalysisViewsRouterVariables>();

/**
 * 활성 분석 뷰 전체 목록 또는 발행된 분석 뷰 목록 조회
 * @route GET /api/v1/analysis-views
 */
analysisViewsRoutes.get("/", async (c) => {
  const { published } = parseQueryParams(c, analysisViewsQuerySchema);
  const views =
    published === "true" ? await findPublishedAnalysisViews() : await findActiveAnalysisViews();
  return apiResponse.ok(views);
});

/**
 * 특정 분석 뷰 단건 상세 조회 (?published=true 시 발행 완료 문서만 허용)
 * @route GET /api/v1/analysis-views/:id
 */
analysisViewsRoutes.get("/:id", (c) => {
  const analysisView = c.get("analysisView");
  const { published } = parseQueryParams(c, analysisViewsQuerySchema);

  if (published === "true" && !analysisView.publishedAt) {
    throw notFound("발행된 분석 뷰를 찾을 수 없습니다.");
  }

  return apiResponse.ok(analysisView);
});

/**
 * 분석 뷰 공식 발행(`isPublished: true`) 또는 초안 회수(`isPublished: false`)
 * @route POST /api/v1/analysis-views/:id/publish
 */
analysisViewsRoutes.post("/:id/publish", async (c) => {
  const analysisView = c.get("analysisView");
  const { isPublished } = await parseJsonBody(
    c,
    publishAnalysisViewBodySchema,
    "유효하지 않은 발행 요청 데이터입니다.",
    { allowEmpty: true }
  );

  if (isPublished) {
    const blocks = extractAnalysisBlocks(analysisView);
    if (blocks.length === 0) {
      throw badRequest("분석 뷰를 발행하려면 최소 1개 이상의 콘텐츠 블록이 필요합니다.");
    }
  }

  const updated = await publishAnalysisViewById(analysisView.id, isPublished);
  if (!updated) {
    throw notFound("발행 대상 분석 뷰를 찾을 수 없습니다.");
  }

  return apiResponse.ok(updated);
});

/**
 * 분석 뷰 단건 소프트 삭제
 * @route DELETE /api/v1/analysis-views/:id
 */
analysisViewsRoutes.delete("/:id", async (c) => {
  const analysisView = c.get("analysisView");
  const deleted = await softDeleteAnalysisViewById(analysisView.id);

  if (!deleted) {
    throw notFound("삭제할 분석 뷰를 찾을 수 없습니다.");
  }

  return apiResponse.ok(deleted);
});
