import { describe, expect, it } from "vitest";
import {
  insertFormSubmissionSchema,
  updateFormSubmissionSchema,
  selectFormSubmissionSchema,
} from "./form-submission.schema";

describe("Form Submission Schemas (entities/form-submission)", () => {
  describe("insertFormSubmissionSchema", () => {
    it("유효한 formId(UUID)와 data 객체가 전달되면 파싱을 성공해야 한다", () => {
      const validPayload = {
        formId: "123e4567-e89b-12d3-a456-426614174000",
        data: {
          customerName: "홍길동",
          score: 5,
          feedback: "서비스가 매우 만족스럽습니다.",
        },
      };

      const result = insertFormSubmissionSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.formId).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(result.data.data).toEqual(validPayload.data);
      }
    });

    it("formId가 유효한 UUID 형식이 아니면 유효성 검증에 실패해야 한다", () => {
      const invalidPayload = {
        formId: "not-a-valid-uuid",
        data: { text: "테스트" },
      };

      const result = insertFormSubmissionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("유효한 폼 UUID");
      }
    });

    it("formId가 누락되면 유효성 검증에 실패해야 한다", () => {
      const missingPayload = {
        data: { text: "테스트" },
      };

      const result = insertFormSubmissionSchema.safeParse(missingPayload);
      expect(result.success).toBe(false);
    });

    it("data가 객체가 아닌 원시값이거나 누락되면 유효성 검증에 실패해야 한다", () => {
      const invalidPayload = {
        formId: "123e4567-e89b-12d3-a456-426614174000",
        data: "문자열데이터",
      };

      const result = insertFormSubmissionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("updateFormSubmissionSchema", () => {
    it("수정할 data 객체가 전달되면 성공적으로 파싱되어야 한다", () => {
      const validPayload = {
        data: {
          score: 4,
          feedback: "수정된 의견입니다.",
        },
      };

      const result = updateFormSubmissionSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toEqual(validPayload.data);
      }
    });

    it("data 객체가 누락되거나 잘못된 형식이면 실패해야 한다", () => {
      const invalidPayload = {
        data: null,
      };

      const result = updateFormSubmissionSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("selectFormSubmissionSchema", () => {
    it("데이터베이스에서 조회된 유효한 Submission 레코드를 통과시켜야 한다", () => {
      const mockRecord = {
        id: "123e4567-e89b-12d3-a456-426614174001",
        formId: "123e4567-e89b-12d3-a456-426614174000",
        data: { field1: "value1" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
      };

      const result = selectFormSubmissionSchema.safeParse(mockRecord);
      expect(result.success).toBe(true);
    });
  });
});
