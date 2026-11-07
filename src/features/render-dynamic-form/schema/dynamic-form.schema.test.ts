import { describe, it, expect } from "vitest";
import type { CoreFormField } from "@/entities/form";
import { buildDynamicFormSchema, validateSubmissionData } from "./dynamic-form.schema";

describe("Dynamic Form Schema & Validator (features/render-dynamic-form/schema)", () => {
  const mockFields: CoreFormField[] = [
    {
      id: "f1",
      name: "applicantName",
      label: "지원자 이름",
      type: "text",
      required: true,
    },
    {
      id: "f2",
      name: "yearsOfExperience",
      label: "경력 연수",
      type: "number",
      required: true,
    },
    {
      id: "f3",
      name: "targetPosition",
      label: "지원 직무",
      type: "select",
      required: true,
      options: ["Frontend", "Backend", "Fullstack"],
    },
    {
      id: "f4",
      name: "portfolioUrl",
      label: "포트폴리오 링크",
      type: "text",
      required: false,
    },
    {
      id: "f5",
      name: "deletedField",
      label: "삭제된 필드",
      type: "text",
      required: true,
      deletedAt: "2026-11-08T00:00:00.000Z",
    },
  ];

  it("모든 필수 항목이 올바르게 채워진 경우 검증을 통과해야 한다", () => {
    const rawData = {
      applicantName: "홍길동",
      yearsOfExperience: 5,
      targetPosition: "Frontend",
      portfolioUrl: "https://github.com/example",
    };

    const result = validateSubmissionData(mockFields, rawData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.cleanedData).toEqual({
      applicantName: "홍길동",
      yearsOfExperience: 5,
      targetPosition: "Frontend",
      portfolioUrl: "https://github.com/example",
    });
  });

  it("필수 입력 필드가 누락되거나 빈 문자열인 경우 에러를 반환해야 한다", () => {
    const rawData = {
      applicantName: "   ",
      yearsOfExperience: undefined,
      targetPosition: "",
    };

    const result = validateSubmissionData(mockFields, rawData);

    expect(result.isValid).toBe(false);
    expect(result.errors.applicantName).toContain("필수 입력");
    expect(result.errors.yearsOfExperience).toContain("필수 입력");
    expect(result.errors.targetPosition).toContain("필수 입력");
  });

  it("선택 항목(required: false)이 비어있으면 에러 없이 통과해야 한다", () => {
    const rawData = {
      applicantName: "홍길동",
      yearsOfExperience: 3,
      targetPosition: "Backend",
      portfolioUrl: "",
    };

    const result = validateSubmissionData(mockFields, rawData);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.cleanedData?.portfolioUrl).toBeUndefined();
  });

  describe("number 타입 필드 유효성 검증", () => {
    it("숫자 형태 문자열이 전달되면 number 타입으로 파싱하여 정제해야 한다", () => {
      const rawData = {
        applicantName: "홍길동",
        yearsOfExperience: "7",
        targetPosition: "Fullstack",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(true);
      expect(result.cleanedData?.yearsOfExperience).toBe(7);
      expect(typeof result.cleanedData?.yearsOfExperience).toBe("number");
    });

    it("유효하지 않은 숫자 문자열이 입력되면 에러를 반환해야 한다", () => {
      const rawData = {
        applicantName: "홍길동",
        yearsOfExperience: "invalid_number",
        targetPosition: "Backend",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(false);
      expect(result.errors.yearsOfExperience).toContain("유효한 숫자");
    });
  });

  describe("select 타입 필드 유효성 검증", () => {
    it("정의된 options에 포함되지 않은 값이 입력되면 에러를 반환해야 한다", () => {
      const rawData = {
        applicantName: "홍길동",
        yearsOfExperience: 2,
        targetPosition: "DevOps",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(false);
      expect(result.errors.targetPosition).toContain("제공된 선택지 중 하나");
    });
  });

  describe("식별자(id vs name) 매핑 호환성", () => {
    it("field.id로 값이 전달되어도 field.name으로 정규화하여 cleanedData에 수납해야 한다", () => {
      const rawData = {
        f1: "이순신",
        f2: 10,
        f3: "Frontend",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(true);
      expect(result.cleanedData?.applicantName).toBe("이순신");
      expect(result.cleanedData?.yearsOfExperience).toBe(10);
      expect(result.cleanedData?.targetPosition).toBe("Frontend");
    });
  });

  describe("소프트 삭제된 필드 처리", () => {
    it("deletedAt이 존재하는 필드는 신규 검증 및 cleanedData에서 제외되어야 한다", () => {
      const rawData = {
        applicantName: "강감찬",
        yearsOfExperience: 4,
        targetPosition: "Backend",
        deletedField: "이 값은 무시되어야 함",
      };

      const result = validateSubmissionData(mockFields, rawData);

      expect(result.isValid).toBe(true);
      expect(result.cleanedData?.deletedField).toBeUndefined();
    });
  });

  describe("buildDynamicFormSchema (React Hook Form resolver 연동용 Zod 스키마 빌더)", () => {
    it("필드 메타데이터로부터 React Hook Form에 호환되는 Zod Object 스키마를 동적으로 빌드해야 한다", () => {
      const schema = buildDynamicFormSchema(mockFields);

      expect(schema).toBeDefined();

      const parseSuccess = schema.safeParse({
        applicantName: "을지문덕",
        yearsOfExperience: 20,
        targetPosition: "Fullstack",
      });
      expect(parseSuccess.success).toBe(true);

      const parseFailure = schema.safeParse({
        applicantName: "",
        yearsOfExperience: "not-a-number",
        targetPosition: "Unknown",
      });
      expect(parseFailure.success).toBe(false);
    });
  });
});
