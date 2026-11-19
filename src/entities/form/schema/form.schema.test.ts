import { describe, expect, it } from "vitest";
import { insertFormSchema, selectFormSchema, updateFormSchema } from "./form.schema";

describe("Form Schema Validation Engine", () => {
  describe("insertFormSchema (폼 신규 생성 검증)", () => {
    it("올바른 폼 메타데이터(primaryFieldId 및 1개 이상 활성 필드 포함)가 주어지면 검증을 통과해야 한다", () => {
      const validPayload = {
        title: "일일 업무 보고서",
        description: "일일 업무 내역을 기록하는 폼입니다.",
        schemaDefinition: {
          primaryFieldId: "taskName",
          fields: [
            {
              id: "taskName",
              type: "text",
              label: "업무명",
              required: true,
              description: "수행한 업무의 제목을 입력합니다.",
            },
          ],
        },
      };

      const result = insertFormSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("선택 항목인 description이 누락되어도 유효한 fields 및 primaryFieldId가 있으면 검증을 통과해야 한다", () => {
      const validPayloadWithoutDesc = {
        title: "간단 폼",
        schemaDefinition: {
          primaryFieldId: "f_title",
          fields: [
            {
              id: "f_title",
              type: "text",
              label: "제목",
              required: true,
              description: "항목의 대표 제목을 입력합니다.",
            },
          ],
        },
      };

      const result = insertFormSchema.safeParse(validPayloadWithoutDesc);
      expect(result.success).toBe(true);
    });

    it("필드가 비어있거나 primaryFieldId가 누락/유효하지 않으면 검증에 실패해야 한다", () => {
      const emptyFieldsPayload = {
        title: "빈 폼",
        schemaDefinition: { primaryFieldId: "f_1", fields: [] },
      };
      const missingPrimaryPayload = {
        title: "대표 필드 없는 폼",
        schemaDefinition: {
          fields: [
            {
              id: "f_1",
              type: "text",
              label: "이름",
              description: "사용자 이름",
            },
          ],
        },
      };
      const invalidPrimaryTypePayload = {
        title: "부적합 대표 필드 폼",
        schemaDefinition: {
          primaryFieldId: "f_tags",
          fields: [
            {
              id: "f_tags",
              type: "checkbox",
              label: "분류",
              description: "다중 분류 선택",
              options: [{ label: "A", value: "A", description: "분류 A입니다.", disabled: false }],
            },
          ],
        },
      };

      expect(insertFormSchema.safeParse(emptyFieldsPayload).success).toBe(false);
      expect(insertFormSchema.safeParse(missingPrimaryPayload).success).toBe(false);
      expect(insertFormSchema.safeParse(invalidPrimaryTypePayload).success).toBe(false);
    });

    it("폼 제목(title)이 빈 문자열이면 검증에 실패해야 한다", () => {
      const emptyTitlePayload = {
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
        title: "제목",
      };

      const result = insertFormSchema.safeParse(missingSchemaPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("selectFormSchema (DB 조회 엔티티 검증)", () => {
    it("DB에서 조회된 완성된 폼 엔티티 레코드(publishedAt, deletedAt, version 포함)를 정상 파싱해야 한다", () => {
      const mockDbRecord = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "프로젝트 작업 기록",
        description: null,
        schemaDefinition: { fields: [] },
        version: 1,
        createdAt: new Date("2026-11-05T00:00:00Z"),
        updatedAt: new Date("2026-11-05T00:00:00Z"),
        publishedAt: null,
        deletedAt: null,
      };

      const result = selectFormSchema.safeParse(mockDbRecord);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(mockDbRecord.id);
        expect(result.data.version).toBe(1);
        expect(result.data.publishedAt).toBeNull();
        expect(result.data.deletedAt).toBeNull();
      }
    });

    it("발행 일시가 존재하는 폼 엔티티도 정상 파싱해야 한다", () => {
      const mockPublishedRecord = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        title: "공개 설문조사",
        description: "공식 설문입니다.",
        schemaDefinition: { fields: [] },
        version: 2,
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
    it("일부 필드(title만 변경)와 expectedVersion이 전달되면 유효해야 한다", () => {
      const partialUpdate = {
        title: "수정된 프로젝트 작업 기록",
        expectedVersion: 1,
      };

      const result = updateFormSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it("expectedVersion이 누락되면 검증에 실패해야 한다", () => {
      const missingVersionUpdate = {
        title: "수정된 프로젝트 작업 기록",
      };

      const result = updateFormSchema.safeParse(missingVersionUpdate);
      expect(result.success).toBe(false);
    });

    it("시스템 전유 필드(id, version, createdAt, updatedAt, deletedAt, publishedAt)는 스키마에서 제외되어 파싱 결과에 포함되지 않아야 한다", () => {
      const payloadWithSystemFields = {
        title: "수정 제목",
        expectedVersion: 3,
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        version: 99,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        publishedAt: new Date(),
      };

      const result = updateFormSchema.safeParse(payloadWithSystemFields);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ title: "수정 제목", expectedVersion: 3 });
        expect(result.data).not.toHaveProperty("id");
        expect(result.data).not.toHaveProperty("version");
        expect(result.data).not.toHaveProperty("createdAt");
        expect(result.data).not.toHaveProperty("updatedAt");
        expect(result.data).not.toHaveProperty("deletedAt");
        expect(result.data).not.toHaveProperty("publishedAt");
      }
    });
  });
});
