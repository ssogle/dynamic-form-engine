import { describe, expect, it } from "vitest";
import { activeFormSchema, coreFieldTypeSchema, coreFormFieldSchema } from "./form-field.schema";

describe("Form Field Schema Validation Engine (src/entities/form/schema/form-field.schema.ts)", () => {
  describe("coreFieldTypeSchema (필드 유형 열거형 검증)", () => {
    it("지원하는 4가지 코어 필드 타입을 정상 통과시켜야 한다", () => {
      const validTypes = ["text", "textarea", "number", "select"];

      for (const type of validTypes) {
        const result = coreFieldTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it("지원하지 않는 임의의 필드 타입은 파싱에 실패해야 한다", () => {
      const invalidTypes = ["checkbox", "radio", "date", "file", "unknown"];

      for (const type of invalidTypes) {
        const result = coreFieldTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("coreFormFieldSchema (개별 폼 필드 정의 검증)", () => {
    it("필수 항목(id, label, type)이 모두 제공된 정상 필드를 파싱해야 한다", () => {
      const validField = {
        id: "f_applicant_name",
        label: "지원자 성명",
        type: "text",
      };

      const result = coreFormFieldSchema.safeParse(validField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("f_applicant_name");
        expect(result.data.label).toBe("지원자 성명");
        expect(result.data.type).toBe("text");
        // required 미지정 시 기본값 false 할당 검증
        expect(result.data.required).toBe(false);
      }
    });

    it("모든 선택 속성(placeholder, description, options, deletedAt)이 포함된 필드를 정상 파싱해야 한다", () => {
      const fullField = {
        id: "f_career_level",
        label: "경력 구분",
        type: "select",
        required: true,
        placeholder: "경력을 선택해 주세요",
        description: "현재 재직 중인 직급 기준입니다.",
        options: ["신입", "주니어(1~3년)", "미들(4~7년)", "시니어(8년 이상)"],
        deletedAt: "2026-11-10T00:00:00.000Z",
      };

      const result = coreFormFieldSchema.safeParse(fullField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.required).toBe(true);
        expect(result.data.options).toHaveLength(4);
        expect(result.data.deletedAt).toBe("2026-11-10T00:00:00.000Z");
      }
    });

    it("필드 ID(id)가 누락되거나 빈 문자열이면 검증에 실패해야 한다", () => {
      const missingId = {
        label: "이름",
        type: "text",
      };
      const emptyId = {
        id: "",
        label: "이름",
        type: "text",
      };

      expect(coreFormFieldSchema.safeParse(missingId).success).toBe(false);

      const emptyResult = coreFormFieldSchema.safeParse(emptyId);
      expect(emptyResult.success).toBe(false);
      if (!emptyResult.success) {
        expect(emptyResult.error.issues[0]?.message).toBe("필드 ID는 비어있을 수 없습니다.");
      }
    });

    it("필드 라벨(label)이 누락되거나 빈 문자열이면 검증에 실패해야 한다", () => {
      const missingLabel = {
        id: "f_1",
        type: "text",
      };
      const emptyLabel = {
        id: "f_1",
        label: "",
        type: "text",
      };

      expect(coreFormFieldSchema.safeParse(missingLabel).success).toBe(false);

      const emptyResult = coreFormFieldSchema.safeParse(emptyLabel);
      expect(emptyResult.success).toBe(false);
      if (!emptyResult.success) {
        expect(emptyResult.error.issues[0]?.message).toBe("필드 라벨을 입력해 주세요.");
      }
    });
  });

  describe("activeFormSchema (활성 폼 프리뷰 메타데이터 검증)", () => {
    it("정상적인 활성 폼 데이터를 파싱해야 한다", () => {
      const validActiveForm = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "신규 입사 지원서",
        description: "개발팀 입사 지원 폼입니다.",
        fields: [
          {
            id: "f_name",
            label: "이름",
            type: "text",
            required: true,
          },
        ],
        publishedAt: "2026-11-10T00:00:00.000Z",
      };

      const result = activeFormSchema.safeParse(validActiveForm);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(result.data.title).toBe("신규 입사 지원서");
        expect(result.data.fields).toHaveLength(1);
      }
    });

    it("id가 UUID 형식이 아닌 경우 검증에 실패해야 한다", () => {
      const invalidUuidForm = {
        id: "not-a-valid-uuid",
        title: "테스트 폼",
      };

      const result = activeFormSchema.safeParse(invalidUuidForm);
      expect(result.success).toBe(false);
    });

    it("title이 빈 문자열인 경우 검증에 실패해야 한다", () => {
      const emptyTitleForm = {
        title: "",
      };

      const result = activeFormSchema.safeParse(emptyTitleForm);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("폼 제목을 입력해 주세요.");
      }
    });

    it("fields가 생략되면 기본값 빈 배열([])을 할당해야 한다", () => {
      const formWithoutFields = {
        title: "간단 설문",
      };

      const result = activeFormSchema.safeParse(formWithoutFields);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fields).toEqual([]);
      }
    });

    it("publishedAt은 Date 객체, ISO 문자열, null, undefined를 모두 정상 수용해야 한다", () => {
      const testCases = [
        new Date("2026-11-10T00:00:00.000Z"),
        "2026-11-10T00:00:00.000Z",
        null,
        undefined,
      ];

      for (const pubAt of testCases) {
        const payload = {
          title: "발행일 테스트 폼",
          publishedAt: pubAt,
        };
        const result = activeFormSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });
  });
});
