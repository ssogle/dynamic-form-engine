import { index, jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * PostgreSQL relations 테이블 DDL 정의 (경량 온톨로지 엣지 테이블)
 *
 * 폼 및 서브미션 데이터 간의 비즈니스 관계를 다대다(N:M) 그래프 엣지 형태로 영속화합니다.
 * 팔란티어 파운드리 방식의 2단계 조회(Two-Phase Query) 아키텍처에서
 * 1단계 고속 링크 탐색(Link Traversal)의 단일 진실 원천(Single Source of Truth)으로 동작합니다.
 */
export const relations = pgTable(
  "relations",
  {
    /**
     * 관계의 출발점(자식 엔티티) ID (예: 비용 서브미션 UUID)
     */
    sourceId: uuid("source_id").notNull(),

    /**
     * 출발점 엔티티 유형 ('SUBMISSION' | 'FORM')
     */
    sourceType: varchar("source_type", { length: 50 }).notNull(),

    /**
     * 관계의 목적지(부모/참조 엔티티) ID (예: 프로젝트 서브미션 UUID)
     */
    targetId: uuid("target_id").notNull(),

    /**
     * 목적지 엔티티 유형 ('SUBMISSION' | 'FORM')
     */
    targetType: varchar("target_type", { length: 50 }).notNull(),

    /**
     * 관계 유형 식별자 (예: 'LINKED_TO', 'EXPENSE_OF')
     */
    relationType: varchar("relation_type", { length: 50 }).notNull(),

    /**
     * 관계 부가 메타데이터 (참조 필드 ID `fieldId` 등)
     */
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),

    /**
     * 관계 생성 일시 (중앙 DB 시계 기준 UTC)
     */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /**
     * 동일 엔티티 간 동일 관계 중복 방지를 위한 복합 기본키
     */
    primaryKey({ columns: [table.sourceId, table.targetId, table.relationType] }),

    /**
     * 정방향 조회 인덱스 (특정 sourceId가 바라보는 target 목록 탐색)
     */
    index("idx_relations_source").on(table.sourceId, table.relationType),

    /**
     * 역방향 조회 인덱스 (특정 targetId를 바라보는 자식 레코드 목록 초고속 탐색)
     */
    index("idx_relations_target").on(table.targetId, table.relationType),
  ]
);

export type RelationRecord = typeof relations.$inferSelect;
export type InsertRelationRecord = typeof relations.$inferInsert;
