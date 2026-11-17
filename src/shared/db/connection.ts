import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * 전역 싱글톤 캐시 선언
 * Next.js 개발 모드 핫 리로딩 시 커넥션 풀 중복 생성을 방지합니다.
 */
declare global {
  var __globalPostgresClient: postgres.Sql | undefined;
  var __globalDrizzleInstance: PostgresJsDatabase | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
}

/**
 * PostgreSQL 연결 드라이버
 * - max: 10으로 풀 크기를 제어합니다.
 * - prepare: false, max_pipeline: 1, fetch_types: false를 적용하여 Supabase Transaction Pooler(포트 6543)에서
 *   다중 쿼리 파이프라이닝 및 2단계 Extended Query(Flush)로 인한 프로토콜 프레이밍 충돌(08P01)을 방지합니다.
 */
const client =
  globalThis.__globalPostgresClient ??
  postgres(connectionString ?? "", {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_pipeline: 1,
    fetch_types: false,
    prepare: false,
  });

/**
 * 애플리케이션 전역 Drizzle ORM 싱글톤 인스턴스
 */
export const db = globalThis.__globalDrizzleInstance ?? drizzle(client);

// 개발 환경 핫 리로딩 간 커넥션 풀 재사용
if (process.env.NODE_ENV !== "production") {
  globalThis.__globalPostgresClient = client;
  globalThis.__globalDrizzleInstance = db;
}
