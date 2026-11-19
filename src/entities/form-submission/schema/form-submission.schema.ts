import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { formSubmissions } from "@/shared/tables";

/**
 * 폼 응답 데이터 테이블 (form_submissions) re-export
 * 물리 DDL 정의는 @/shared/tables/form-submissions.table.ts에 위치하며,
 * 도메인 레이어에서 일관된 타입 참조를 위해 노출합니다.
 */
export { formSubmissions };

/**
 * 시스템 내부 또는 중앙 DB 시계에 의해 전적으로 관리되는 폼 응답 메타데이터 필드 목록
 *
 * id: 불변 기본키 (DB defaultRandom UUID)
 * createdAt: 최초 제출 일시 (DB defaultNow)
 * updatedAt: 최종 수정 일시 (DB sql`now()`)
 * deletedAt: 소프트 삭제 일시 (소프트 삭제 API에서만 DB sql`now()`로 관리)
 *
 * 위 4개 필드는 클라이언트가 임의로 주입하거나 위변조하지 못하도록 스키마 레벨에서 원천 차단합니다.
 */
const systemManagedSubmissionFields = {
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

/**
 * 폼 응답 등록용 Zod 스키마
 *
 * drizzle-zod를 통해 form_submissions 테이블 정의로부터 자동 파생되며,
 * 시스템 전유 필드 4종을 엄격히 제외하고 순수 비즈니스 필드(formId, data)만 수신합니다.
 */
export const insertFormSubmissionSchema = createInsertSchema(formSubmissions, {
  formId: z.uuid("유효한 폼 UUID 식별자여야 합니다."),
  data: z.record(z.string(), z.unknown(), {
    message: "응답 데이터는 Key-Value 형태의 객체여야 합니다.",
  }),
}).omit(systemManagedSubmissionFields);

/**
 * 폼 응답 수정용 Zod 스키마
 *
 * 기제출된 응답 데이터(data)만 선택적/부분 갱신 가능하며,
 * 낙관적 락 검증을 위한 expectedVersion을 필수로 수신합니다.
 * 시스템 전유 필드(id, version, createdAt, updatedAt, deletedAt) 및 부모 폼 식별자(formId)는 철저히 차단됩니다.
 */
export const updateFormSubmissionSchema = insertFormSubmissionSchema
  .partial()
  .omit({ formId: true })
  .extend({
    expectedVersion: z
      .number({ message: "낙관적 락 검증을 위한 expectedVersion(정수)이 필요합니다." })
      .int("expectedVersion은 정수여야 합니다.")
      .positive("expectedVersion은 1 이상의 정수여야 합니다."),
  });

/**
 * 데이터베이스에서 조회된 폼 응답 엔티티 검증용 Zod 스키마
 */
export const selectFormSubmissionSchema = createSelectSchema(formSubmissions);

/**
 * Drizzle 및 Zod 추론 TypeScript 타입
 */
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type UpdateFormSubmission = z.infer<typeof updateFormSubmissionSchema>;
