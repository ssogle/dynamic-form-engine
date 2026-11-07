import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { formSubmissions } from "@/shared/db";

/**
 * 폼 응답 데이터 테이블 (form_submissions) re-export
 * 물리 DDL 정의는 @/shared/db/schema/form-submissions.schema.ts에 위치하며,
 * 도메인 레이어에서 일관된 타입 참조를 위해 노출합니다.
 */
export { formSubmissions };

/**
 * 폼 응답 등록용 Zod 스키마
 * 클라이언트 또는 API 요청 본문에서 formId와 data의 규격을 검증합니다.
 */
export const insertFormSubmissionSchema = createInsertSchema(formSubmissions, {
  formId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "유효한 폼 UUID 식별자여야 합니다."
    ),
  data: z.record(z.string(), z.unknown(), {
    message: "응답 데이터는 Key-Value 형태의 객체여야 합니다.",
  }),
});

/**
 * 폼 응답 수정용 Zod 스키마
 * 기제출된 응답 데이터(data)를 부분 갱신할 때 사용합니다.
 */
export const updateFormSubmissionSchema = z.object({
  data: z.record(z.string(), z.unknown(), {
    message: "응답 데이터는 Key-Value 형태의 객체여야 합니다.",
  }),
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
