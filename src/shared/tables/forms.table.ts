import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * 폼 엔티티의 JSON 스키마 필드 정의 타입
 */
export interface FormSchemaDefinition {
  fields: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * 폼 메타데이터 테이블 (forms)
 *
 * 동적으로 생성되는 모든 폼의 구조(설계도)를 영속화하는 핵심 메타데이터 테이블입니다.
 * 필드 구조 자체는 schema_definition JSONB 컬럼에 캡슐화하여 물리적 DDL 변경 없이 유연한 확장을 지원합니다.
 */
export const forms = pgTable(
  "forms",
  {
    /**
     * 폼 고유 식별자 (UUID v4)
     * PostgreSQL의 gen_random_uuid()를 통해 데이터베이스 레벨에서 자동으로 생성됩니다.
     */
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * 폼의 URL 친화적 고유 식별 슬러그 (예: "daily-task-report")
     * 영문 소문자, 숫자, 하이픈(-)으로 구성되며 소프트 삭제되지 않은 활성 폼들 사이에서 유일해야 합니다.
     */
    slug: varchar("slug", { length: 100 }).notNull(),

    /**
     * 폼의 공식 표시 명칭 (예: "일일 업무 보고서", "프로젝트 정보 등록")
     * 화면 헤더, 목록 카드, 내비게이션 등 UI 전반에 노출되는 대표 제목입니다.
     */
    title: varchar("title", { length: 255 }).notNull(),

    /**
     * 폼 작성자를 위한 부가 안내 및 설명 문구 (선택 항목)
     * 폼의 목적, 작성 가이드라인, 주의사항 등을 서술합니다.
     */
    description: text("description"),

    /**
     * 동적 폼 필드 스키마 정의 (JSONB)
     *
     * 폼을 구성하는 각 입력 필드(text, select, number 등), 검증 규칙(min, max, required),
     * 그리고 다른 폼과의 연결 관계(dataSource: form_lookup 등)를 온톨로지 규격의 JSON 객체로 저장합니다.
     * 물리적 테이블 구조를 변경하지 않고도 무한한 폼 확장을 가능하게 하는 핵심 컬럼입니다.
     */
    schemaDefinition: jsonb("schema_definition").notNull().$type<FormSchemaDefinition>(),

    /**
     * 폼 스키마가 최초 생성된 일시 (UTC 기준 타임스탬프)
     */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * 폼 스키마가 마지막으로 수정된 일시 (UTC 기준 타임스탬프)
     */
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * 폼이 공식 발행(공개)된 일시 (UTC 기준 타임스탬프, 미발행/초안 시 null)
     * 폼이 활성화되어 일반 응답자에게 노출 가능한 상태인지를 시간과 함께 표현합니다.
     */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /**
     * 폼 소프트 삭제 일시 (UTC 기준 타임스탬프, 미삭제 시 null)
     * 실제 레코드를 영구 파기하지 않고 본 컬럼에 삭제 시각을 기록하여 소프트 삭제를 수행합니다.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    /**
     * 소프트 삭제되지 않은(deleted_at IS NULL) 활성 폼 간의 슬러그 중복을 방지하는 부분 고유 인덱스
     * 삭제된 폼의 슬러그는 재사용할 수 있도록 허용하면서도, 활성 폼들 간의 고유성을 100% 보장합니다.
     */
    uniqueIndex("forms_active_slug_unique")
      .on(table.slug)
      .where(sql`deleted_at IS NULL`),
  ]
);
