import { index, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { formSubmissions } from "./form-submissions.table";

/**
 * PostgreSQL relations 테이블 DDL 정의 (경량 관계 인덱스 엣지 테이블)
 *
 * 서브미션 데이터 간의 참조 관계를 다대다(N:M) 그래프 엣지 형태로 영속화합니다.
 * 팔란티어 파운드리 방식의 2단계 조회(Two-Phase Query) 아키텍처에서
 * 1단계 고속 링크 탐색(Link Traversal)을 담당하며, 관계의 도메인 의미는 폼 스키마의 field.description이 담당합니다.
 */
export const relations = pgTable(
  "relations",
  {
    /**
     * 관계의 출발점(자식 응답) ID (form_submissions.id 참조 외래키)
     * 소스 응답 물리 삭제 시 연관된 엣지 레코드도 함께 정리됩니다.
     */
    sourceId: uuid("source_id")
      .notNull()
      .references(() => formSubmissions.id, { onDelete: "cascade" }),

    /**
     * 관계의 목적지(참조 대상 응답) ID (form_submissions.id 참조 외래키)
     * 타깃 응답 물리 삭제 시 연관된 엣지 레코드도 함께 정리됩니다.
     */
    targetId: uuid("target_id")
      .notNull()
      .references(() => formSubmissions.id, { onDelete: "cascade" }),

    /**
     * 이 연결을 생성한 소스 폼의 관계형 필드 ID (예: "f_rel_requester")
     * 동일 응답 쌍 간 복수 관계 필드(예: 요청자 vs 승인자)를 충돌 없이 구분합니다.
     */
    fieldId: varchar("field_id", { length: 100 }).notNull(),

    /**
     * 관계 생성 일시 (중앙 DB 시계 기준 UTC)
     */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /**
     * 동일 출발점-목적지-필드 조합 중복 방지를 위한 복합 기본키
     */
    primaryKey({ columns: [table.sourceId, table.targetId, table.fieldId] }),

    /**
     * 정방향 조회 인덱스 (특정 sourceId가 바라보는 target 목록 탐색)
     */
    index("idx_relations_source").on(table.sourceId),

    /**
     * 역방향 조회 인덱스 (특정 targetId를 바라보는 자식 레코드 목록 초고속 탐색)
     */
    index("idx_relations_target").on(table.targetId),
  ]
);

export type RelationRecord = typeof relations.$inferSelect;
export type InsertRelationRecord = typeof relations.$inferInsert;
