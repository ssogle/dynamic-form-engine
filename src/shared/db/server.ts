import "server-only";

/**
 * Database 인프라 서버 전용 Public API 진입점
 *
 * 서버 환경(Route Handler, Server Actions, Server Repository)에서만 참조할 수 있는
 * Drizzle ORM 싱글톤 인스턴스(db)를 노출합니다.
 */
export { db } from "./connection";
