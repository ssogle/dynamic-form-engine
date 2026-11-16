import { createApiRouter } from "../_lib/create-api-router";
import {
  requireAnalysisView,
  validateAnalysisViewIdParam,
  type AnalysisViewsRouterVariables,
} from "./analysis-views-middleware";
import { analysisViewsRoutes } from "./analysis-views-routes";

/**
 * `/api/v1/analysis-views` 도메인 통합 Hono API 앱
 */
export const analysisViewsApp = createApiRouter<AnalysisViewsRouterVariables>({
  basePath: "/api/v1/analysis-views",
});

analysisViewsApp.use("/:id", validateAnalysisViewIdParam, requireAnalysisView);
analysisViewsApp.use("/:id/*", validateAnalysisViewIdParam, requireAnalysisView);

analysisViewsApp.route("/", analysisViewsRoutes);
