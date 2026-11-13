/**
 * Database 물리 테이블 DDL Public API
 *
 * Drizzle ORM의 모든 PostgreSQL 테이블 정의를 중앙 집중적으로 노출합니다.
 * RDBMS 외래키 참조 무결성을 보장하며, 엔티티 스키마 및 마이그레이션 도구에서 참조합니다.
 */

export { forms, type FormSchemaDefinition } from "./forms.table";
export { formSubmissions } from "./form-submissions.table";
export { relations, type RelationRecord, type InsertRelationRecord } from "./relations.table";
