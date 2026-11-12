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
  // shared/tables 하위의 모든 물리 DDL 테이블 정의 파일을 자동 수집합니다.
  schema: "./src/shared/tables/*.table.ts",
  out: "./drizzle",
  dbCredentials: {
    /**
     * 마이그레이션 및 스키마 푸시(DDL)는 Prepared Statement / 세션 유지가 가능한 DIRECT_URL(예: 5432)을 우선 사용합니다.
     * 미설정 시 하위 호환을 위해 DATABASE_URL로 fallback합니다.
     */
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  // 테이블 생성 시 엄격 모드 활성화
  strict: true,
  verbose: true,
});
