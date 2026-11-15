import { relationsQuerySchema } from "@/entities/form-submission";
import { findInboundRelatedSubmissions } from "@/entities/form-submission/server";
import { apiResponse } from "@/shared/lib/http";
import { createApiRouter, handleRoute } from "../_lib/create-api-router";
import { parseQueryParams } from "../_lib/request-helpers";

/**
 * `/api/v1/relations` 역참조 관계 조회 전용 Hono Thin Controller 라우터
 *
 * 설계 원칙:
 * - 쿼리 검증 스키마(`relationsQuerySchema`)와 2-Phase 역참조 그룹핑 로직(`findInboundRelatedSubmissions`)은
 *   `@/entities/form-submission` 레이어로 하향 분리되어 라우트 파일의 책임을 HTTP 경계로 제한합니다.
 * - Next.js App Router Route Export 제약을 준수하기 위해 `relationsApp`은 내부 상수로 유지하고
 *   오직 허용된 HTTP 메서드(`GET`)만 export합니다.
 */
const relationsApp = createApiRouter({
  basePath: "/api/v1/relations",
});

/**
 * 특정 타깃 응답 레코드(`targetId`)를 참조 중인 역참조 소스 폼/응답 그룹 조회
 * @route GET /api/v1/relations?targetId=<uuid>
 */
relationsApp.get("/", async (c) => {
  const { targetId } = parseQueryParams(c, relationsQuerySchema);
  const relatedGroups = await findInboundRelatedSubmissions(targetId);
  return apiResponse.ok(relatedGroups);
});

export const GET = handleRoute(relationsApp);
