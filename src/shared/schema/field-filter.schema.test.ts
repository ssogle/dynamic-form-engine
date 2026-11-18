import { describe, expect, it } from "vitest";
import {
  fieldFilterConditionSchema,
  normalizeFieldFilterCondition,
  parseFieldFiltersParam,
  parseFieldFiltersStrict,
  serializeFieldFiltersParam,
  validateFiltersAgainstFields,
  type FilterableFieldDescriptor,
} from "./field-filter.schema";

describe("Field Filter Schema (shared/schema/field-filter.schema)", () => {
  const sampleFields: FilterableFieldDescriptor[] = [
    { id: "f_name", label: "이름", type: "text" },
    { id: "f_amount", label: "금액", type: "number" },
    {
      id: "f_category",
      label: "분류",
      type: "select",
      options: [{ label: "식대", value: "MEAL", disabled: false }],
    },
    {
      id: "f_tags",
      label: "태그",
      type: "checkbox",
      options: [{ label: "긴급", value: "URGENT", disabled: false }],
    },
    { id: "f_agree", label: "약관 동의", type: "checkbox" },
    { id: "f_date", label: "결제일", type: "date" },
    { id: "f_active", label: "활성 여부", type: "switch" },
    { id: "f_project", label: "프로젝트", type: "relation" },
    { id: "f_deleted", label: "삭제된 필드", type: "text", deletedAt: "2026-10-01T00:00:00Z" },
  ];

  it("op 생략 시 기본값 'eq'를 적용해 기존 { fieldId, value } 형태를 호환 검증해야 한다", () => {
    const parsed = fieldFilterConditionSchema.safeParse({
      fieldId: "f_category",
      value: "MEAL",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(normalizeFieldFilterCondition(parsed.data)).toEqual({
        fieldId: "f_category",
        op: "eq",
        value: "MEAL",
      });
    }
  });

  it("between 연산자는 min/max 중 하나 이상 필요하며 숫자 및 날짜 순서 역전을 거부해야 한다", () => {
    expect(
      fieldFilterConditionSchema.safeParse({
        fieldId: "f_amount",
        op: "between",
      }).success
    ).toBe(false);

    expect(
      fieldFilterConditionSchema.safeParse({
        fieldId: "f_amount",
        op: "between",
        min: 500,
        max: 100,
      }).success
    ).toBe(false);

    expect(
      fieldFilterConditionSchema.safeParse({
        fieldId: "f_date",
        op: "between",
        min: "2026-11-10",
        max: "2026-11-01",
      }).success
    ).toBe(false);

    expect(
      fieldFilterConditionSchema.safeParse({
        fieldId: "f_date",
        op: "between",
        min: "2026-02-31",
        max: "2026-03-01",
      }).success
    ).toBe(false);

    expect(
      fieldFilterConditionSchema.safeParse({
        fieldId: "f_amount",
        op: "between",
        min: 100,
      }).success
    ).toBe(true);
  });

  it("in/notIn/hasAny/hasAll 연산자에서 단일 value를 전달해도 values 배열로 자동 정규화해야 한다", () => {
    const parsed = fieldFilterConditionSchema.safeParse({
      fieldId: "f_category",
      op: "in",
      value: "MEAL",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(normalizeFieldFilterCondition(parsed.data)).toEqual({
        fieldId: "f_category",
        op: "in",
        values: ["MEAL"],
      });
    }
  });

  it("parseFieldFiltersParam은 레거시 Record<string, string> 객체를 contains 조건 배열로 자동 승격해야 한다", () => {
    const parsed = parseFieldFiltersParam(JSON.stringify({ f_name: "홍길동", f_empty: "   " }));
    expect(parsed).toEqual([
      {
        fieldId: "f_name",
        op: "contains",
        value: "홍길동",
      },
    ]);
  });

  it("parseFieldFiltersStrict는 잘못된 JSON이나 비정상 필터 조건에 에러를 반환해야 한다", () => {
    expect(parseFieldFiltersStrict("{bad-json").error).toBeTruthy();
    expect(
      parseFieldFiltersStrict(JSON.stringify([{ fieldId: "f_name", op: "gt" }])).error
    ).toBeTruthy();

    const valid = parseFieldFiltersStrict(
      JSON.stringify([{ fieldId: "f_amount", op: "gte", value: 1000 }])
    );
    expect(valid.error).toBeNull();
    expect(valid.data).toEqual([{ fieldId: "f_amount", op: "gte", value: 1000 }]);
  });

  it("serializeFieldFiltersParam은 필터 순서를 결정론적으로 정렬해 직렬화해야 한다", () => {
    const s1 = serializeFieldFiltersParam([
      { fieldId: "f_name", op: "contains", value: "홍길동" },
      { fieldId: "f_amount", op: "gte", value: 1000 },
    ]);
    const s2 = serializeFieldFiltersParam([
      { fieldId: "f_amount", op: "gte", value: 1000 },
      { fieldId: "f_name", op: "contains", value: "홍길동" },
    ]);
    expect(s1).toBeDefined();
    expect(s1).toBe(s2);
  });

  it("validateFiltersAgainstFields는 미존재/삭제 필드 및 타입 비허용 연산자를 차단해야 한다", () => {
    const deletedFieldRes = validateFiltersAgainstFields(
      [{ fieldId: "f_deleted", op: "contains", value: "test" }],
      sampleFields
    );
    expect(deletedFieldRes.error).toContain("존재하지 않습니다");

    const disallowedOpRes = validateFiltersAgainstFields(
      [{ fieldId: "f_name", op: "between", min: "a", max: "z" }],
      sampleFields
    );
    expect(disallowedOpRes.error).toContain("사용할 수 없습니다");

    const invalidDateRes = validateFiltersAgainstFields(
      [{ fieldId: "f_date", op: "gte", value: "2026-02-31" }],
      sampleFields
    );
    expect(invalidDateRes.error).toContain("유효한 날짜");

    const invalidNumberRes = validateFiltersAgainstFields(
      [{ fieldId: "f_amount", op: "gt", value: "not-a-number" }],
      sampleFields
    );
    expect(invalidNumberRes.error).toContain("올바른 숫자");

    const validRes = validateFiltersAgainstFields(
      [
        { fieldId: "f_amount", op: "between", min: 1000, max: 5000 },
        { fieldId: "f_project", op: "contains", value: "마케팅" },
        { fieldId: "createdAt", op: "between", min: "2026-10-01", max: "2026-10-31" },
      ],
      sampleFields
    );
    expect(validRes.error).toBeNull();
    expect(validRes.data).toHaveLength(3);
  });
});
