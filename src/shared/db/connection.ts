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
 * max: 10으로 풀 크기를 제어하고, Transaction Pooler 및 서버리스 환경에 최적화된 옵션(prepare: false)을 적용합니다.
 */
const client =
  globalThis.__globalPostgresClient ??
  postgres(connectionString ?? "", {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
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
