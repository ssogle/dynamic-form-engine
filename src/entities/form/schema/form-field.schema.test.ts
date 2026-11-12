import { describe, expect, it } from "vitest";
import {
  activeFormSchema,
  coreFieldTypeSchema,
  coreFormFieldSchema,
  relationConfigSchema,
  selectOptionSchema,
} from "./form-field.schema";

describe("Form Field Schema Validation Engine (src/entities/form/schema/form-field.schema.ts)", () => {
  describe("coreFieldTypeSchema (필드 유형 열거형 검증)", () => {
    it("확장된 9가지 순수 데이터 코어 필드 타입을 정상 통과시켜야 한다", () => {
      const validTypes = [
        "text",
        "textarea",
        "number",
        "select",
        "radio",
        "checkbox",
        "date",
        "switch",
        "relation",
      ];

      for (const type of validTypes) {
        const result = coreFieldTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it("지원하지 않는 임의의 필드 타입(section 포함)은 파싱에 실패해야 한다", () => {
      const invalidTypes = ["section", "tags", "file", "unknown", "slider", "multiselect"];

      for (const type of invalidTypes) {
        const result = coreFieldTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("selectOptionSchema (인라인 옵션 단일 규격 검증)", () => {
    it("객체 형태의 옵션을 정상 파싱하고 disabled 미지정 시 기본값 false를 할당해야 한다", () => {
      const optionPayload = {
        label: "신규 개발",
        value: "new_dev",
        description: "신규 기능 및 신규 프로젝트 개발 업무에 선택합니다.",
      };

      const result = selectOptionSchema.safeParse(optionPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe("신규 개발");
        expect(result.data.value).toBe("new_dev");
        expect(result.data.description).toBe("신규 기능 및 신규 프로젝트 개발 업무에 선택합니다.");
        expect(result.data.disabled).toBe(false);
      }
    });

    it("disabled: true로 소프트 비활성화된 옵션을 정상 수용해야 한다", () => {
      const deprecatedOption = {
        label: "레거시 유지보수",
        value: "legacy_maint",
        description: "기존 구버전 시스템 유지보수 분류로 현재는 신규 선택 불가입니다.",
        disabled: true,
      };

      const result = selectOptionSchema.safeParse(deprecatedOption);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.disabled).toBe(true);
      }
    });

    it("옵션 description이 누락되거나 공백만 있으면 파싱에 실패해야 한다", () => {
      const missingDescription = {
        label: "신규 개발",
        value: "new_dev",
      };
      const blankDescription = {
        label: "신규 개발",
        value: "new_dev",
        description: "   ",
      };

      expect(selectOptionSchema.safeParse(missingDescription).success).toBe(false);
      expect(selectOptionSchema.safeParse(blankDescription).success).toBe(false);
    });

    it("단순 문자열 옵션이 유입되면 객체 규격 위반으로 파싱에 실패해야 한다", () => {
      const stringOption = "신규 개발";
      const result = selectOptionSchema.safeParse(stringOption);
      expect(result.success).toBe(false);
    });
  });

  describe("relationConfigSchema (관계형 필드 설정 검증)", () => {
    it("정상적인 관계형 설정(targetFormId, displayField)을 파싱해야 한다", () => {
      const validConfig = {
        targetFormId: "123e4567-e89b-12d3-a456-426614174000",
        displayField: "f_project_name",
      };

      const result = relationConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetFormId).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(result.data.displayField).toBe("f_project_name");
        // multiple 미지정 시 기본값 false 할당 검증
        expect(result.data.multiple).toBe(false);
      }
    });

    it("targetFormId가 UUID 형식이 아니면 실패해야 한다", () => {
      const invalidConfig = {
        targetFormId: "not-a-uuid",
        displayField: "f_name",
      };

      const result = relationConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it("displayField가 비어있으면 실패해야 한다", () => {
      const emptyFieldConfig = {
        targetFormId: "123e4567-e89b-12d3-a456-426614174000",
        displayField: "",
      };

      const result = relationConfigSchema.safeParse(emptyFieldConfig);
      expect(result.success).toBe(false);
    });
  });

  describe("coreFormFieldSchema (개별 폼 필드 정의 검증)", () => {
    it("필수 항목(id, label, type, description)이 모두 제공된 정상 텍스트 필드를 파싱해야 한다", () => {
      const validField = {
        id: "f_applicant_name",
        label: "지원자 성명",
        type: "text",
        description: "지원자의 실명(한글 성명)을 입력받는 항목",
      };

      const result = coreFormFieldSchema.safeParse(validField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("f_applicant_name");
        expect(result.data.label).toBe("지원자 성명");
        expect(result.data.type).toBe("text");
        expect(result.data.description).toBe("지원자의 실명(한글 성명)을 입력받는 항목");
        expect(result.data.required).toBe(false);
      }
    });

    it("필드 설명(description)이 누락되거나 공백 문자열이면 검증에 실패해야 한다", () => {
      const missingDescription = {
        id: "f_applicant_name",
        label: "지원자 성명",
        type: "text",
      };
      const emptyDescription = {
        id: "f_applicant_name",
        label: "지원자 성명",
        type: "text",
        description: "   ",
      };

      expect(coreFormFieldSchema.safeParse(missingDescription).success).toBe(false);
      expect(coreFormFieldSchema.safeParse(emptyDescription).success).toBe(false);
    });

    it("라디오(radio) 및 체크박스(checkbox) 필드의 options는 SelectOption 객체 배열만 허용하고 문자열 배열은 거부해야 한다", () => {
      const validRadioField = {
        id: "f_priority",
        label: "우선순위",
        type: "radio",
        description: "업무 처리의 긴급도를 구분하는 선택 값",
        options: [
          { label: "높음", value: "HIGH", description: "당일 내 즉시 처리가 필요한 긴급 건" },
          { label: "보통", value: "MEDIUM", description: "일반 일정에 따라 순차 처리하는 건" },
          {
            label: "낮음",
            value: "LOW",
            description: "여유 일정으로 배정하는 비긴급 건",
            disabled: true,
          },
        ],
      };

      const validResult = coreFormFieldSchema.safeParse(validRadioField);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data.options).toEqual([
          {
            label: "높음",
            value: "HIGH",
            description: "당일 내 즉시 처리가 필요한 긴급 건",
            disabled: false,
          },
          {
            label: "보통",
            value: "MEDIUM",
            description: "일반 일정에 따라 순차 처리하는 건",
            disabled: false,
          },
          {
            label: "낮음",
            value: "LOW",
            description: "여유 일정으로 배정하는 비긴급 건",
            disabled: true,
          },
        ]);
      }

      const legacyStringOptionsField = {
        id: "f_priority_legacy",
        label: "우선순위",
        type: "radio",
        description: "업무 처리의 긴급도",
        options: ["높음", "보통", "낮음"],
      };

      const legacyResult = coreFormFieldSchema.safeParse(legacyStringOptionsField);
      expect(legacyResult.success).toBe(false);
    });

    it("관계형(relation) 필드의 relationConfig와 도메인 연결 설명(description)을 정상 수용해야 한다", () => {
      const relationField = {
        id: "f_parent_project",
        label: "소속 프로젝트",
        type: "relation",
        required: true,
        description: "이 비용 집행이 귀속되는 상위 프로젝트 도메인 레코드 연결",
        relationConfig: {
          targetFormId: "123e4567-e89b-12d3-a456-426614174000",
          displayField: "f_title",
          multiple: true,
        },
      };

      const result = coreFormFieldSchema.safeParse(relationField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relationConfig?.multiple).toBe(true);
        expect(result.data.relationConfig?.targetFormId).toBe(
          "123e4567-e89b-12d3-a456-426614174000"
        );
      }
    });

    it("날짜(date), 스위치(switch) 필드를 정상 파싱해야 한다", () => {
      const fields = [
        {
          id: "f_date",
          label: "계약일자",
          type: "date",
          description: "계약 효력이 발생하는 기준 일자",
        },
        {
          id: "f_switch",
          label: "공개 여부",
          type: "switch",
          description: "외부 포털 노출 여부를 제어하는 불리언 상태",
        },
      ];

      for (const field of fields) {
        const result = coreFormFieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      }
    });

    it("필드 ID(id)가 누락되거나 빈 문자열이면 검증에 실패해야 한다", () => {
      const missingId = {
        label: "이름",
        type: "text",
        description: "사용자 성명",
      };
      const emptyId = {
        id: "",
        label: "이름",
        type: "text",
        description: "사용자 성명",
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
        description: "사용자 성명",
      };
      const emptyLabel = {
        id: "f_1",
        label: "",
        type: "text",
        description: "사용자 성명",
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
            description: "지원자의 실명",
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
