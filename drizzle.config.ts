import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js 로컬 환경 변수(.env.local)를 명시적으로 로드합니다.
dotenv.config({ path: ".env.local" });

/**
 * Drizzle Kit CLI 설정 파일
 *
 * FSD 아키텍처 원칙에 따라 entities 레이어의 각 도메인 schema 폴더를 탐색하며,
 * 생성된 DDL SQL 마이그레이션 파일은 루트의 drizzle/ 디렉터리에 축적합니다.
 */
export default defineConfig({
  dialect: "postgresql",
  // entities 하위의 모든 도메인 schema 파일을 자동 수집합니다.
  schema: "./src/entities/**/schema/*.schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // 테이블 생성 시 엄격 모드 활성화
  strict: true,
  verbose: true,
});
