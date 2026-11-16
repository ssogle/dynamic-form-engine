import { handleRoute } from "../../_lib/create-api-router";
import { analysisViewsApp } from "../analysis-views-app";

/**
 * `/api/v1/analysis-views` Next.js Catch-All Route Handler
 * UI가 사용하는 조회(GET), 발행 토글(POST), 단건 삭제(DELETE) 메서드만 노출합니다.
 */
const handler = handleRoute(analysisViewsApp);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
