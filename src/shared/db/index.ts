/**
 * Database 인프라 Public API 진입점
 *
 * FSD 원칙에 따라 외부 레이어는 `@/shared/db`를 통해 데이터베이스 인스턴스를 참조합니다.
 */
export { db } from "./connection";
