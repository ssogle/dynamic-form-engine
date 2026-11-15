import { handleRoute } from "../../_lib/create-api-router";
import { formsApp } from "../forms-app";

/**
 * `/api/v1/forms` 및 하위 모든 엔드포인트의 통합 Next.js Catch-All Route Handler
 *
 * 설계 결정:
 * - 통합 Hono 앱(`formsApp`)으로 HTTP 요청을 직접 위임합니다.
 * - 기존 API v1 스펙에서 허용된 HTTP 메서드 4종(`GET`, `POST`, `PATCH`, `DELETE`)만
 *   명시적으로 export하여 불필요한 메서드(`PUT`, `OPTIONS` 등) 노출을 차단합니다.
 */
const handler = handleRoute(formsApp);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
