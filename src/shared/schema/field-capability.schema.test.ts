import { describe, expect, it } from "vitest";
import {
  CHECKBOX_BOOLEAN_CAPABILITY,
  CORE_FIELD_CAPABILITIES,
  coreFieldTypeSchema,
  isSystemFieldId,
  resolveFieldQueryCapability,
  resolveSystemFieldCapability,
  resolveTargetFieldCapability,
  SYSTEM_FIELD_CAPABILITIES,
} from "./field-capability.schema";

describe("Field Capability Schema (shared/schema/field-capability.schema)", () => {
  it("9종 코어 필드 타입 모두에 대해 Capability Matrix가 빠짐없이 정의되어 있어야 한다", () => {
    for (const fieldType of coreFieldTypeSchema.options) {
      const cap = CORE_FIELD_CAPABILITIES[fieldType];
      expect(cap).toBeDefined();
      expect(cap.filterOperators.length).toBeGreaterThan(0);
      expect(cap.filterOperators).toContain(cap.defaultOperator);
    }
  });

  it("number 필드만 sum/avg/min/max 수치 집계를 허용하고 date 필드만 날짜 기준 축 후보여야 한다", () => {
    expect(resolveFieldQueryCapability({ type: "number" })?.aggregatableMetrics).toEqual([
      "count",
      "sum",
      "avg",
      "min",
      "max",
    ]);
    expect(resolveFieldQueryCapability({ type: "text" })?.aggregatableMetrics).toEqual(["count"]);
    expect(resolveFieldQueryCapability({ type: "date" })?.isDateAxisCandidate).toBe(true);
    expect(resolveFieldQueryCapability({ type: "text" })?.isDateAxisCandidate).toBe(false);
  });

  it("checkbox 필드는 options 유무에 따라 다중 선택 위젯과 불리언 위젯으로 자동 파생되어야 한다", () => {
    const multiCap = resolveFieldQueryCapability({
      type: "checkbox",
      options: [{ label: "동의", value: "AGREE" }],
    });
    expect(multiCap?.filterWidget).toBe("options");
    expect(multiCap?.defaultOperator).toBe("hasAny");
    expect(multiCap?.filterOperators).toContain("hasAll");

    const booleanCapNoOptions = resolveFieldQueryCapability({
      type: "checkbox",
    });
    expect(booleanCapNoOptions).toEqual(CHECKBOX_BOOLEAN_CAPABILITY);
    expect(booleanCapNoOptions?.filterWidget).toBe("boolean");

    const booleanCapEmptyArray = resolveFieldQueryCapability({
      type: "checkbox",
      options: [],
    });
    expect(booleanCapEmptyArray).toEqual(CHECKBOX_BOOLEAN_CAPABILITY);
  });

  it("select 필드는 multiple 여부에 따라 단일 선택과 다중 배열 연산자로 구분 파생되어야 한다", () => {
    const singleSelectCap = resolveFieldQueryCapability({
      type: "select",
      multiple: false,
      options: [{ label: "A", value: "A" }],
    });
    expect(singleSelectCap?.defaultOperator).toBe("in");
    expect(singleSelectCap?.filterOperators).not.toContain("hasAll");

    const multiSelectCap = resolveFieldQueryCapability({
      type: "select",
      multiple: true,
      options: [{ label: "A", value: "A" }],
    });
    expect(multiSelectCap?.defaultOperator).toBe("hasAny");
    expect(multiSelectCap?.filterOperators).toContain("hasAll");
  });

  it("시스템 컬럼(id, createdAt, updatedAt)의 조회 능력을 정확히 해석해야 한다", () => {
    expect(isSystemFieldId("createdAt")).toBe(true);
    expect(isSystemFieldId("f_name")).toBe(false);

    expect(resolveSystemFieldCapability("id")).toEqual(SYSTEM_FIELD_CAPABILITIES.id);
    expect(resolveSystemFieldCapability("createdAt")?.filterWidget).toBe("date");
    expect(resolveSystemFieldCapability("updatedAt")?.filterOperators).toContain("between");
    expect(resolveSystemFieldCapability("unknown")).toBeNull();

    expect(resolveTargetFieldCapability("createdAt")?.defaultOperator).toBe("between");
    expect(resolveTargetFieldCapability("f_amount", { type: "number" })?.defaultOperator).toBe(
      "between"
    );
    expect(resolveTargetFieldCapability("f_unknown", { type: "unsupported" })).toBeNull();
  });
});
