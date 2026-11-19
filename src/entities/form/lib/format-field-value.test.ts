import { describe, expect, it } from "vitest";
import type { CoreFormField } from "../schema/form-field.schema";
import { formatFieldDisplayValue } from "./format-field-value";

describe("formatFieldDisplayValue (entities/form/lib)", () => {
  const selectField: CoreFormField = {
    id: "f_priority",
    label: "우선순위",
    type: "select",
    required: true,
    description: "업무의 긴급도를 선택합니다.",
    options: [
      { label: "긴급", value: "HIGH", description: "즉시 대응이 필요한 건", disabled: false },
      { label: "종료됨", value: "CLOSED", description: "과거 사용된 옵션", disabled: true },
    ],
  };

  const checkboxField: CoreFormField = {
    id: "f_categories",
    label: "지출 항목",
    type: "checkbox",
    required: false,
    description: "해당하는 지출 항목을 모두 선택합니다.",
    options: [
      { label: "식대", value: "MEAL", description: "업무 관련 식사 비용", disabled: false },
      { label: "교통비", value: "TAXI", description: "이동에 소요된 교통비", disabled: false },
    ],
  };

  const switchField: CoreFormField = {
    id: "f_urgent",
    label: "긴급 승인 여부",
    type: "switch",
    required: false,
    description: "긴급 결재 대상인지 표시합니다.",
  };

  it("null, undefined, 빈 문자열, 빈 배열은 기본 fallback('-') 또는 사용자 지정 fallback을 반환해야 한다", () => {
    expect(formatFieldDisplayValue(undefined, selectField)).toBe("-");
    expect(formatFieldDisplayValue(null, selectField)).toBe("-");
    expect(formatFieldDisplayValue("", selectField)).toBe("-");
    expect(formatFieldDisplayValue([], checkboxField)).toBe("-");
    expect(formatFieldDisplayValue(undefined, selectField, "미입력")).toBe("미입력");
  });

  it("불리언 값 및 switch 타입 문자열 불리언 값은 '예'/'아니오'로 변환해야 한다", () => {
    expect(formatFieldDisplayValue(true, switchField)).toBe("예");
    expect(formatFieldDisplayValue(false, switchField)).toBe("아니오");
    expect(formatFieldDisplayValue("true", switchField)).toBe("예");
    expect(formatFieldDisplayValue("false", switchField)).toBe("아니오");
    expect(formatFieldDisplayValue(true)).toBe("예");
  });

  it("select·radio 필드는 저장된 코드값 대신 옵션의 라벨(비활성 옵션 포함)로 매핑해야 한다", () => {
    expect(formatFieldDisplayValue("HIGH", selectField)).toBe("긴급");
    expect(formatFieldDisplayValue("CLOSED", selectField)).toBe("종료됨");
    expect(formatFieldDisplayValue("UNKNOWN_CODE", selectField)).toBe("UNKNOWN_CODE");
  });

  it("checkbox 등 배열 값은 옵션 라벨이 존재하면 각 라벨로 매핑하고 없으면 원시 문자열로 결합해야 한다", () => {
    expect(formatFieldDisplayValue(["MEAL", "TAXI"], checkboxField)).toBe("식대, 교통비");
    expect(formatFieldDisplayValue(["MEAL", "OTHER"], checkboxField)).toBe("식대, OTHER");
    expect(formatFieldDisplayValue(["태그A", "태그B"])).toBe("태그A, 태그B");
  });

  it("숫자·일반 문자열·객체 값을 안전한 표시 문자열로 포맷팅해야 한다", () => {
    const numberField: CoreFormField = {
      id: "f_amount",
      label: "금액",
      type: "number",
      required: true,
      description: "집행 금액",
    };

    expect(formatFieldDisplayValue(150000)).toBe("150000");
    expect(formatFieldDisplayValue(0, numberField)).toBe("0");
    expect(formatFieldDisplayValue(150000, numberField)).toBe("150,000");
    expect(formatFieldDisplayValue("1234567.89", numberField)).toBe("1,234,567.89");
    expect(formatFieldDisplayValue("   ", numberField)).toBe("   ");
    expect(formatFieldDisplayValue("비정형 텍스트", numberField)).toBe("비정형 텍스트");
    expect(formatFieldDisplayValue("차세대 ERP 구축")).toBe("차세대 ERP 구축");
    expect(formatFieldDisplayValue({ key: "val" })).toBe('{"key":"val"}');
  });
});
