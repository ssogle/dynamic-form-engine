import { describe, it, expect } from "vitest";
import type { CoreFormField } from "@/entities/form";
import { buildDynamicFormSchema, validateSubmissionData } from "./dynamic-form.schema";

describe("Dynamic Form Schema & Validator (entities/form/schema)", () => {
  const mockFields: CoreFormField[] = [
    {
      id: "f1",
      label: "지원자 이름",
      type: "text",
      description: "지원자의 실명",
      required: true,
    },
    {
      id: "f2",
      label: "경력 연수",
      type: "number",
      description: "총 경력 연수(년)",
      required: true,
    },
    {
      id: "f3",
      label: "지원 직무",
      type: "select",
      description: "지원 희망 직무 분류",
      required: true,
      options: [
        {
          label: "Frontend",
          value: "Frontend",
          description: "웹/앱 프론트엔드 개발",
          disabled: false,
        },
        {
          label: "Backend",
          value: "Backend",
          description: "서버/API/DB 백엔드 개발",
          disabled: false,
        },
        {
          label: "Fullstack",
          value: "Fullstack",
          description: "프론트엔드 및 백엔드 통합 개발",
          disabled: false,
        },
      ],
    },
    {
      id: "f4",
      label: "포트폴리오 링크",
      type: "text",
      description: "GitHub 또는 개인 포트폴리오 URL",
      required: false,
    },
    {
      id: "f5",
      label: "삭제된 필드",
      type: "text",
      description: "과거에 사용되었던 비활성 필드",
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

    it("표준 필드 외의 비표준 필드 타입에 대해 기본 fallback 스키마를 생성하고 필수 여부를 올바르게 검증해야 한다", () => {
      const customFields: CoreFormField[] = [
        {
          id: "custom_1",
          label: "커스텀 색상",
          type: "color" as unknown as CoreFormField["type"],
          description: "커스텀 색상 코드",
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

    it("신규 필드(radio, checkbox, date, switch, relation)에 대한 스키마 빌드 및 유효성 검증이 정확히 동작해야 한다", () => {
      const newFields: CoreFormField[] = [
        {
          id: "f_radio",
          label: "우선순위",
          type: "radio",
          description: "작업 처리 우선순위",
          required: true,
          options: [
            { label: "상", value: "high", description: "최우선 처리 대상", disabled: false },
            { label: "하", value: "low", description: "일반 후순위 처리 대상", disabled: false },
          ],
        },
        {
          id: "f_checkbox",
          label: "관심 기술",
          type: "checkbox",
          description: "보유 또는 관심 있는 기술 스택 다중 선택",
          required: true,
          options: [
            {
              label: "React",
              value: "React",
              description: "React 생태계 프레임워크",
              disabled: false,
            },
            {
              label: "Node.js",
              value: "Node.js",
              description: "Node.js 서버 런타임",
              disabled: false,
            },
          ],
        },
        {
          id: "f_date",
          label: "시작일자",
          type: "date",
          description: "프로젝트 시작 기준 일자",
          required: true,
        },
        {
          id: "f_switch",
          label: "알림 수신",
          type: "switch",
          description: "알림 수신 동의 여부",
          required: false,
        },
        {
          id: "f_rel",
          label: "연결 프로젝트",
          type: "relation",
          description: "관련 상위 프로젝트 레코드 연결",
          required: true,
          relationConfig: {
            targetFormId: "123e4567-e89b-12d3-a456-426614174000",
            multiple: false,
          },
        },
      ];

      const schema = buildDynamicFormSchema(newFields);

      // 정상 데이터 검증 통과
      const validData = {
        f_radio: "high",
        f_checkbox: ["React"],
        f_date: "2026-11-10",
        f_switch: true,
        f_rel: "123e4567-e89b-12d3-a456-426614174000",
      };
      const validResult = schema.safeParse(validData);
      expect(validResult.success).toBe(true);

      // 날짜 포맷 및 달력 유효성(윤년/월말 초과) 오류 검증
      const invalidDateResult = schema.safeParse({
        ...validData,
        f_date: "invalid-date",
      });
      expect(invalidDateResult.success).toBe(false);

      expect(schema.safeParse({ ...validData, f_date: "2026-02-30" }).success).toBe(false);
      expect(schema.safeParse({ ...validData, f_date: "2026-02-29" }).success).toBe(false);
      expect(schema.safeParse({ ...validData, f_date: "2026-13-01" }).success).toBe(false);
      expect(schema.safeParse({ ...validData, f_date: "2024-02-29" }).success).toBe(true);

      // 체크박스 미선택 필수 오류 검증
      const invalidCheckboxResult = schema.safeParse({
        ...validData,
        f_checkbox: [],
      });
      expect(invalidCheckboxResult.success).toBe(false);

      // 릴레이션 UUID 오류 검증
      const invalidRelationResult = schema.safeParse({
        ...validData,
        f_rel: "not-a-uuid",
      });
      expect(invalidRelationResult.success).toBe(false);
    });

    it("모든 필드가 선택(required: false)일 때 빈 객체나 누락된 키로 제출해도 정상 통과해야 한다", () => {
      const allOptionalFields: CoreFormField[] = [
        {
          id: "project_name",
          type: "text",
          label: "프로젝트명",
          description: "프로젝트 공식 명칭",
          required: false,
        },
        {
          id: "project_desc",
          type: "textarea",
          label: "프로젝트 개요",
          description: "프로젝트 상세 설명",
          required: false,
        },
        {
          id: "status",
          type: "select",
          label: "진행 상태",
          description: "현재 프로젝트 진행 단계",
          options: [
            {
              label: "계획 중",
              value: "planning",
              description: "기획 및 예산 수립 단계",
              disabled: false,
            },
          ],
          required: false,
        },
        {
          id: "budget",
          type: "number",
          label: "예산",
          description: "프로젝트 배정 총 예산(원)",
          required: false,
        },
        {
          id: "start_date",
          type: "date",
          label: "시작일",
          description: "프로젝트 착수 일자",
          required: false,
        },
        {
          id: "is_urgent",
          type: "switch",
          label: "긴급 여부",
          description: "긴급 처리 대상 여부",
          required: false,
        },
        {
          id: "agree",
          type: "checkbox",
          label: "단일 동의",
          description: "약관 동의 여부",
          required: false,
        },
      ];

      // 1. 빈 객체 제출 시 통과
      const resultEmpty = validateSubmissionData(allOptionalFields, {});
      expect(resultEmpty.isValid).toBe(true);
      expect(resultEmpty.errors).toEqual({});
      expect(resultEmpty.cleanedData).toEqual({
        is_urgent: false,
        agree: false,
      });

      // 2. 빈 문자열("") 및 undefined 혼합 제출 시에도 통과
      const resultBlank = validateSubmissionData(allOptionalFields, {
        project_name: "",
        project_desc: "",
        status: "",
        budget: undefined,
        start_date: undefined,
        is_urgent: false,
        agree: false,
      });
      expect(resultBlank.isValid).toBe(true);
      expect(resultBlank.errors).toEqual({});
    });
  });
});
