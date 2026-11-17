import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { forms } from "@/shared/tables";
import { coreFormFieldSchema } from "./form-field.schema";
import { validatePrimaryFieldSelection } from "../lib/primary-field";

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
/**
 * 폼 도메인 스키마 정의(schema_definition) JSONB 검증 스키마
 *
 * 모든 도메인 폼은 최소 1개 이상의 필드를 가져야 하며,
 * 데이터를 대표하여 식별/노출할 수 있는 primaryFieldId를 필수로 지정해야 합니다.
 */
export const formSchemaDefinitionSchema = z
  .object({
    primaryFieldId: z
      .string({ message: "대표 필드(primaryFieldId) 지정은 필수입니다." })
      .trim()
      .min(1, "대표 필드(primaryFieldId) 지정은 필수입니다."),
    fields: z.array(coreFormFieldSchema).min(1, "최소 1개 이상의 폼 필드가 포함되어야 합니다."),
  })
  .catchall(z.unknown())
  .superRefine((val, ctx) => {
    const check = validatePrimaryFieldSelection(val.fields, val.primaryFieldId);
    if (!check.isValid) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryFieldId"],
        message: check.reason ?? "유효하지 않은 대표 필드입니다.",
      });
    }
  });

export const insertFormSchema = createInsertSchema(forms, {
  title: (schema) =>
    schema.min(1, "폼 제목을 입력해 주세요.").max(255, "폼 제목은 최대 255자까지 가능합니다."),
  schemaDefinition: formSchemaDefinitionSchema,
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

/**
 * 동적 경로 파라미터 `:id` 검증용 Zod 스키마 (UUID 표준 포맷 검사)
 */
export const formIdParamSchema = z.object({
  id: z.uuid("올바른 폼 ID(UUID) 형식이 아닙니다."),
});
export type FormIdParam = z.infer<typeof formIdParamSchema>;

/**
 * 폼 목록 조회(`GET /api/v1/forms`) 쿼리 파라미터 검증 스키마
 *
 * - `?published=true` 전달 시 공식 발행된 폼만 필터링하여 컨슈머 포털에 제공합니다.
 */
export const formsListQuerySchema = z.object({
  published: z.enum(["true", "false"]).optional(),
});
export type FormsListQuery = z.infer<typeof formsListQuerySchema>;

/**
 * 폼 발행 상태 토글(`POST /api/v1/forms/:id/publish`) 요청 본문 검증 스키마
 *
 * - 본문이 비어 있거나 `isPublished`가 생략된 경우 기본값 `true`(공식 발행)로 처리합니다.
 * - 문자열이나 숫자 등 잘못된 타입이 전달되면 Zod 검증으로 `400 BAD_REQUEST`를 반환합니다.
 */
export const publishFormBodySchema = z.object({
  isPublished: z
    .boolean({ message: "발행 여부(isPublished)는 불리언 값이어야 합니다." })
    .default(true),
});
export type PublishFormBody = z.infer<typeof publishFormBodySchema>;
