import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { forms } from "@/shared/db";

/**
 * 폼 메타데이터 테이블 (forms) re-export
 * 물리 DDL 정의는 @/shared/db/schema/forms.schema.ts에 위치하며,
 * 도메인 레이어에서 일관된 타입 참조를 위해 노출합니다.
 */
export { forms };

/**
 * 폼 신규 등록 시 클라이언트 요청 본문(Request Body)을 검증하는 Zod 스키마
 *
 * drizzle-zod를 통해 forms 테이블 정의로부터 자동 파생되며,
 * 슬러그 형식 검증(정규식) 및 제목 길이 제한 등 추가 비즈니스 룰을 결합합니다.
 */
export const insertFormSchema = createInsertSchema(forms, {
  slug: (schema) =>
    schema
      .min(2, "식별 슬러그는 최소 2글자 이상이어야 합니다.")
      .max(100, "식별 슬러그는 최대 100자까지 가능합니다.")
      .regex(/^[a-z0-9-]+$/, "식별 슬러그는 영문 소문자, 숫자, 하이픈(-) 조합만 허용됩니다."),
  title: (schema) =>
    schema.min(1, "폼 제목을 입력해 주세요.").max(255, "폼 제목은 최대 255자까지 가능합니다."),
});

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
 * 모든 필드가 선택 항목(partial)이며 기본키(id) 및 생성일은 변경할 수 없습니다.
 */
export const updateFormSchema = insertFormSchema.partial().omit({ id: true });

/**
 * 폼 정보 수정 입력 데이터 TypeScript 정적 타입
 */
export type UpdateForm = z.infer<typeof updateFormSchema>;
