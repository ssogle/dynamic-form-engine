import { describe, it, expect } from "vitest";
import type { CoreFormField } from "@/entities/form";
import { buildDynamicFormSchema, validateSubmissionData } from "./dynamic-form.schema";

describe("Dynamic Form Schema & Validator (entities/form/schema)", () => {
  const mockFields: CoreFormField[] = [
    {
      id: "f1",
      label: "지원자 이름",
      type: "text",
      required: true,
    },
    {
      id: "f2",
      label: "경력 연수",
      type: "number",
      required: true,
    },
    {
      id: "f3",
      label: "지원 직무",
      type: "select",
      required: true,
      options: ["Frontend", "Backend", "Fullstack"],
    },
    {
      id: "f4",
      label: "포트폴리오 링크",
      type: "text",
      required: false,
    },
    {
      id: "f5",
      label: "삭제된 필드",
      type: "text",
      required: true,
      deletedAt: "2026-11-08T00:00:00.000Z",
    },
  ];

  it("모든 필수 항목이 올바르게 채워진 경우 검증을 통과해야 한다", () => {
    const rawData = {
      f1: "홍길동",
      f2: 5,
      f3: "Frontend",
      f4: "https://github.com/example",
    };

    const result = validateSubmissionData(mockFields, rawData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.cleanedData).toEqual({
      f1: "홍길동",
      f2: 5,
      f3: "Frontend",
      f4: "https://github.com/example",
    });
  });

  it("필수 입력 필드가 누락되거나 빈 문자열인 경우 에러를 반환해야 한다", () => {
    const rawData = {
      f1: "   ",
      f2: undefined,
      f3: "",
    };

    const result = validateSubmissionData(mockFields, rawData);

    expect(result.isValid).toBe(false);
    expect(result.errors.f1).toContain("필수 입력");
    expect(result.errors.f2).toContain("필수 입력");
    expect(result.errors.f3).toContain("필수 입력");
  });

  it("선택 항목(required: false)이 비어있으면 에러 없이 통과해야 한다", () => {
    const rawData = {
      f1: "홍길동",
      f2: 3,
      f3: "Backend",
      f4: "",
    };

    const result = validateSubmissionData(mockFields, rawData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.cleanedData?.f4).toBeUndefined();
  });

  describe("number 타입 필드 유효성 검증", () => {
    it("숫자 형태 문자열이 전달되면 number 타입으로 파싱하여 정제해야 한다", () => {
      const rawData = {
        f1: "홍길동",
        f2: "7",
        f3: "Fullstack",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(true);
      expect(result.cleanedData?.f2).toBe(7);
      expect(typeof result.cleanedData?.f2).toBe("number");
    });

    it("유효하지 않은 숫자 문자열이 입력되면 에러를 반환해야 한다", () => {
      const rawData = {
        f1: "홍길동",
        f2: "invalid_number",
        f3: "Backend",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(false);
      expect(result.errors.f2).toContain("유효한 숫자");
    });
  });

  describe("select 타입 필드 유효성 검증", () => {
    it("정의된 options에 포함되지 않은 값이 입력되면 에러를 반환해야 한다", () => {
      const rawData = {
        f1: "홍길동",
        f2: 2,
        f3: "DevOps",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(false);
      expect(result.errors.f3).toContain("제공된 선택지 중 하나");
    });
  });

  describe("소프트 삭제된 필드 처리", () => {
    it("deletedAt이 존재하는 필드는 신규 검증 및 cleanedData에서 제외되어야 한다", () => {
      const rawData = {
        f1: "강감찬",
        f2: 4,
        f3: "Backend",
        f5: "이 값은 무시되어야 함",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(true);
      expect(result.cleanedData?.f5).toBeUndefined();
    });
  });

  describe("buildDynamicFormSchema (React Hook Form resolver 연동용 Zod 스키마 빌더)", () => {
    it("필드 메타데이터로부터 React Hook Form에 호환되는 Zod Object 스키마를 동적으로 빌드해야 한다", () => {
      const schema = buildDynamicFormSchema(mockFields);

      expect(schema).toBeDefined();

      const parseSuccess = schema.safeParse({
        f1: "을지문덕",
        f2: 20,
        f3: "Fullstack",
      });
      expect(parseSuccess.success).toBe(true);

      const parseFailure = schema.safeParse({
        f1: "",
        f2: "not-a-number",
        f3: "Unknown",
      });
      expect(parseFailure.success).toBe(false);
    });

    it("표준 4종 외의 비표준 필드 타입에 대해 기본 fallback 스키마를 생성하고 필수 여부를 올바르게 검증해야 한다", () => {
      const customFields: CoreFormField[] = [
        {
          id: "custom_1",
          label: "커스텀 색상",
          type: "color" as unknown as CoreFormField["type"],
          required: true,
        },
      ];

      const schema = buildDynamicFormSchema(customFields);

      // 1. 필수 입력 미충족 시 검증 실패
      const failResult = schema.safeParse({ custom_1: "" });
      expect(failResult.success).toBe(false);

      // 2. 값 전달 시 통과
      const passResult = schema.safeParse({ custom_1: "#ff0000" });
      expect(passResult.success).toBe(true);
    });
  });
});
