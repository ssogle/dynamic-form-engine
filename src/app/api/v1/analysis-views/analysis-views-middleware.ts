import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AnalysisView } from "@/entities/analysis-view";
import { findAnalysisViewById } from "@/entities/analysis-view/server";
import { notFound } from "@/shared/lib/http";
import { parseRouteParams } from "../_lib/request-helpers";

/**
 * `/api/v1/analysis-views` 라우터 컨텍스트 변수 맵
 */
export interface AnalysisViewsRouterVariables {
  viewId: string;
  analysisView: AnalysisView;
}

export type AnalysisViewsMiddleware = MiddlewareHandler<{
  Variables: AnalysisViewsRouterVariables;
}>;

const analysisViewIdParamSchema = z.object({
  id: z.uuid("올바른 분석 뷰 ID(UUID) 형식이 아닙니다."),
});

/**
 * 경로 파라미터 `:id` UUID 검증 미들웨어
 */
export const validateAnalysisViewIdParam: AnalysisViewsMiddleware = async (c, next) => {
  const existingViewId = c.get("viewId") as string | undefined;
  if (existingViewId) {
    await next();
    return;
  }

  const { id } = parseRouteParams(c, analysisViewIdParamSchema);
  c.set("viewId", id);
  await next();
};

/**
 * 컨텍스트에 주입된 `viewId`로 활성 분석 뷰를 조회하고 존재하지 않으면 404를 반환하는 미들웨어
 */
export const requireAnalysisView: AnalysisViewsMiddleware = async (c, next) => {
  const viewId = c.get("viewId");
  const analysisView = await findAnalysisViewById(viewId);

  if (!analysisView) {
    throw notFound("해당 분석 뷰를 찾을 수 없습니다.");
  }

  c.set("analysisView", analysisView);
  await next();
};
