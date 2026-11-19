import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 분석 뷰 문서 내 개별 블록(text | table | chart)의 JSONB 저장 형태
 *
 * 상세 Zod 런타임 검증 및 구체적 유니온 타입은 `@/entities/analysis-view`에서 정의합니다.
 */
export interface AnalysisViewBlockRecord {
  id: string;
  type: "text" | "table" | "chart";
  [key: string]: unknown;
}

/**
 * 분석 뷰 문서 테이블 (analysis_views)
 *
 * 분석가가 AI Navigator와 협업하여 생성·편집한 블록 기반 분석 뷰 문서(글/테이블/차트)를 영속화합니다.
 * 멀티 소스 분석 결과를 각 블록 내부에 스냅샷 형태로 보관하므로 단일 폼 외래키 제약 없이 독립 관리됩니다.
 * 생성·수정·발행·삭제 시각은 모두 PostgreSQL 중앙 시계(UTC)를 기준으로 관리합니다.
 */
export const analysisViews = pgTable(
  "analysis_views",
  {
    /**
     * 분석 뷰 고유 식별자 (UUID v4)
     */
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * 분석 뷰 문서 제목 (최대 255자)
     */
    title: varchar("title", { length: 255 }).notNull(),

    /**
     * 분석 뷰 문서 요약 또는 부가 설명 (선택)
     */
    description: text("description"),

    /**
     * 문서를 구성하는 구조화 블록 배열 (text | table | chart)
     */
    blocks: jsonb("blocks")
      .notNull()
      .$type<AnalysisViewBlockRecord[]>()
      .default(sql`'[]'::jsonb`),

    /**
     * 낙관적 락(Optimistic Lock) 동시 수정 충돌 감지용 버전 번호
     * 생성 시 1로 초기화되며, 분석 뷰 수정 시마다 원자적으로 1씩 증가합니다.
     */
    version: integer("version").default(1).notNull(),

    /**
     * 문서 최초 생성 일시 (UTC)
     */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * 문서 최종 수정 일시 (UTC)
     */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * 컨슈머 포털 공식 발행 일시 (미발행 초안 시 null, UTC)
     */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /**
     * 소프트 삭제 일시 (미삭제 시 null, UTC)
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_analysis_views_active")
      .on(table.createdAt)
      .where(sql`deleted_at IS NULL`),
    index("idx_analysis_views_published")
      .on(table.publishedAt)
      .where(sql`deleted_at IS NULL AND published_at IS NOT NULL`),
  ]
);

export type AnalysisViewRecord = typeof analysisViews.$inferSelect;
export type InsertAnalysisViewRecord = typeof analysisViews.$inferInsert;
