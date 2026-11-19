import "server-only";
import type { OptimisticUpdateResult } from "@/shared/lib/http";

/**
 * Database 인프라 서버 전용 Public API 진입점
 *
 * 서버 환경(Route Handler, Server Actions, Server Repository)에서만 참조할 수 있는
 * Drizzle ORM 싱글톤 인스턴스(db)와 공통 낙관적 락 결과 해석기를 노출합니다.
 */
export { db } from "./connection";

/**
 * 낙관적 락 조건(`WHERE version = expectedVersion`)으로 수행한 UPDATE 결과를 해석합니다.
 *
 * - 갱신된 행이 반환되면 `updated` 상태를 반환합니다.
 * - 갱신된 행이 없으면 활성 레코드의 현재 버전 존재 여부를 조회해 `conflict`(409) 또는 `not_found`(404)로 분기합니다.
 *
 * @param updatedRow UPDATE ... RETURNING 결과 행 (없으면 undefined)
 * @param findCurrentVersion 활성 레코드의 현재 DB version 조회 함수
 * @returns OptimisticUpdateResult<T>
 */
export async function resolveOptimisticUpdateResult<T>(
  updatedRow: T | undefined,
  findCurrentVersion: () => Promise<number | undefined>
): Promise<OptimisticUpdateResult<T>> {
  if (updatedRow !== undefined) {
    return { status: "updated", data: updatedRow };
  }

  const currentVersion = await findCurrentVersion();
  if (currentVersion !== undefined) {
    return { status: "conflict", currentVersion };
  }

  return { status: "not_found" };
}
