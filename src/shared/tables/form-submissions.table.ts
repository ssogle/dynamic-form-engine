import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { forms } from "./forms.table";

/**
 * PostgreSQL form_submissions 테이블 DDL 정의
 *
 * 발행된 폼에 대해 엔드유저(컨슈머)가 제출한 동적 응답 데이터를 영속화합니다.
 * forms 테이블과 외래키(Foreign Key) 및 물리 삭제 시 CASCADE 제약조건을 가집니다.
 */
export const formSubmissions = pgTable(
  "form_submissions",
  {
    /**
     * 응답 레코드 고유 식별자 (UUID v4)
     */
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * 응답 대상 폼 식별자 (forms.id 참조 외래키)
     * 폼 레코드 완전 삭제 시 종속된 모든 응답 데이터도 함께 정리됩니다.
     */
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),

    /**
     * 동적 응답 데이터 JSONB 객체
     * 필드 키(name)와 입력값 쌍으로 구성됩니다.
     */
    data: jsonb("data").notNull().$type<Record<string, unknown>>(),

    /**
     * 최초 제출 일시 (UTC)
     */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * 사후 수정 일시 (UTC)
     */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * 논리적 소프트 삭제 일시 (미삭제 시 null, UTC)
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_form_submissions_form_id").on(table.formId),
    index("idx_form_submissions_active")
      .on(table.formId, table.createdAt)
      .where(sql`deleted_at IS NULL`),
  ]
);
