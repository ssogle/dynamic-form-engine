import { describe, expect, it } from "vitest";
import { insertFormSchema, selectFormSchema, updateFormSchema } from "./form.schema";

describe("Form Schema Validation Engine", () => {
  describe("insertFormSchema (폼 신규 생성 검증)", () => {
    it("올바른 폼 메타데이터가 주어지면 검증을 통과해야 한다", () => {
      const validPayload = {
        slug: "daily-task-report",
        title: "일일 업무 보고서",
        description: "일일 업무 내역을 기록하는 폼입니다.",
        schemaDefinition: {
          fields: [{ name: "taskName", type: "text", label: "업무명", required: true }],
        },
      };

      const result = insertFormSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("선택 항목인 description이 누락되어도 검증을 통과해야 한다", () => {
      const validPayloadWithoutDesc = {
        slug: "simple-form",
        title: "간단 폼",
        schemaDefinition: { fields: [] },
      };

      const result = insertFormSchema.safeParse(validPayloadWithoutDesc);
      expect(result.success).toBe(true);
    });

    it("슬러그가 2자 미만이면 검증에 실패해야 한다", () => {
      const invalidPayload = {
        slug: "a",
        title: "테스트 폼",
        schemaDefinition: { fields: [] },
      };

      const result = insertFormSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("식별 슬러그는 최소 2글자 이상이어야 합니다.");
      }
    });

    it("슬러그에 영문 대문자나 특수문자가 포함되면 정규식 검증에 실패해야 한다", () => {
      const invalidSlugPayload = {
        slug: "Daily_Report!", // 대문자, 언더바, 느낌표 포함 (금지)
        title: "테스트 폼",
        schemaDefinition: { fields: [] },
      };

      const result = insertFormSchema.safeParse(invalidSlugPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "식별 슬러그는 영문 소문자, 숫자, 하이픈(-) 조합만 허용됩니다."
        );
      }
    });

    it("폼 제목(title)이 빈 문자열이면 검증에 실패해야 한다", () => {
      const emptyTitlePayload = {
        slug: "valid-slug",
        title: "",
        schemaDefinition: { fields: [] },
      };

      const result = insertFormSchema.safeParse(emptyTitlePayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("폼 제목을 입력해 주세요.");
      }
    });

    it("동적 폼 스키마 정의(schemaDefinition)가 누락되면 검증에 실패해야 한다", () => {
      const missingSchemaPayload = {
        slug: "valid-slug",
        title: "제목",
      };

      const result = insertFormSchema.safeParse(missingSchemaPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("selectFormSchema (DB 조회 엔티티 검증)", () => {
    it("DB에서 조회된 완성된 폼 엔티티 레코드(publishedAt, deletedAt 포함)를 정상 파싱해야 한다", () => {
      const mockDbRecord = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        slug: "project-log",
        title: "프로젝트 작업 기록",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-11-05T00:00:00Z"),
        updatedAt: new Date("2026-11-05T00:00:00Z"),
        publishedAt: null,
        deletedAt: null,
      };

      const result = selectFormSchema.safeParse(mockDbRecord);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(mockDbRecord.id);
        expect(result.data.slug).toBe("project-log");
        expect(result.data.publishedAt).toBeNull();
        expect(result.data.deletedAt).toBeNull();
      }
    });

    it("발행 일시가 존재하는 폼 엔티티도 정상 파싱해야 한다", () => {
      const mockPublishedRecord = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        slug: "published-survey",
        title: "공개 설문조사",
        description: "공식 설문입니다.",
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-11-05T00:00:00Z"),
        updatedAt: new Date("2026-11-05T00:00:00Z"),
        publishedAt: new Date("2026-11-06T12:00:00Z"),
        deletedAt: null,
      };

      const result = selectFormSchema.safeParse(mockPublishedRecord);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.publishedAt).toEqual(mockPublishedRecord.publishedAt);
      }
    });
  });

  describe("updateFormSchema (폼 정보 부분 수정 검증)", () => {
    it("일부 필드(title만 변경)만 전달되어도 유효해야 한다", () => {
      const partialUpdate = {
        title: "수정된 프로젝트 작업 기록",
      };

      const result = updateFormSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });
  });
});
