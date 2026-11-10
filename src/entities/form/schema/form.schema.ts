import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { forms } from "@/shared/tables";

/**
 * 폼 메타데이터 테이블 (forms) re-export
 * 물리 DDL 정의는 @/shared/tables/forms.table.ts에 위치하며,
 * 도메인 레이어에서 일관된 타입 참조를 위해 노출합니다.
 */
export { forms };

/**
 * 시스템 내부 또는 중앙 DB 시계에 의해 전적으로 관리되는 메타데이터 필드 목록
 *
 * id: 불변 기본키 (DB defaultRandom UUID)
 * createdAt: 최초 생성 일시 (DB defaultNow)
 * updatedAt: 최종 수정 일시 (DB sql`now()`)
 * deletedAt: 소프트 삭제 일시 (소프트 삭제 API에서만 DB sql`now()`로 관리)
 * publishedAt: 공식 발행 일시 (발행 전용 API에서만 DB sql`now()`로 관리)
 *
 * 위 5개 필드는 클라이언트가 임의로 주입하거나 위변조하지 못하도록 스키마 레벨에서 원천 차단합니다.
 */
const systemManagedFields = {
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  publishedAt: true,
} as const;

/**
 * 폼 신규 등록 시 클라이언트 요청 본문(Request Body)을 검증하는 Zod 스키마
 *
 * drizzle-zod를 통해 forms 테이블 정의로부터 자동 파생되며,
 * 시스템 전유 필드 5종을 엄격히 제외하고 순수 비즈니스 필드만 수신합니다.
 */
export const insertFormSchema = createInsertSchema(forms, {
  title: (schema) =>
    schema.min(1, "폼 제목을 입력해 주세요.").max(255, "폼 제목은 최대 255자까지 가능합니다."),
}).omit(systemManagedFields);

/**
 * 데이터베이스에서 조회된 폼 엔티티의 런타임 유효성 검증 Zod 스키마
 */
export const selectFormSchema = createSelectSchema(forms);

/**
 * 폼 엔티티 TypeScript 정적 타입 (조회 결과 모델)
 * forms 테이블 정의로부터 직접 자동 추론되므로 DB 스키마와 100% 동기화됩니다.
 */
export type Form = typeof forms.$inferSelect;

/**
 * 폼 신규 생성 입력 데이터 TypeScript 정적 타입
 * insertFormSchema로부터 자동 추론됩니다.
 */
export type InsertForm = z.infer<typeof insertFormSchema>;

/**
 * 폼 수정 시 클라이언트 요청 본문을 검증하는 Zod 스키마
 *
 * 순수 비즈니스 필드(title, description, schemaDefinition)만 선택적(partial)으로 수정 가능하며,
 * 시스템 전유 필드(id, createdAt, updatedAt, deletedAt, publishedAt)는 철저히 차단됩니다.
 */
export const updateFormSchema = insertFormSchema.partial();

/**
 * 폼 정보 수정 입력 데이터 TypeScript 정적 타입
 */
export type UpdateForm = z.infer<typeof updateFormSchema>;
