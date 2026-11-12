import { describe, it, expect } from "vitest";
import { buildDefaultValues } from "./build-default-values";
import type { CoreFormField } from "@/entities/form";

describe("buildDefaultValues (features/render-dynamic-form/lib)", () => {
  it("코어 8종 입력 및 1종 레이아웃 필드에 대해 타입별 올바른 기본값을 생성해야 한다", () => {
    const fields: CoreFormField[] = [
      { id: "f_text", label: "단문", type: "text", required: false },
      { id: "f_textarea", label: "장문", type: "textarea", required: false },
      { id: "f_number", label: "숫자", type: "number", required: false },
      {
        id: "f_select",
        label: "선택",
        type: "select",
        required: false,
        options: [
          { label: "A", value: "A", disabled: false },
          { label: "B", value: "B", disabled: false },
        ],
      },
      {
        id: "f_radio",
        label: "라디오",
        type: "radio",
        required: false,
        options: [
          { label: "O", value: "O", disabled: false },
          { label: "X", value: "X", disabled: false },
        ],
      },
      {
        id: "f_check_multi",
        label: "체크 다중",
        type: "checkbox",
        required: false,
        options: [
          { label: "1", value: "1", disabled: false },
          { label: "2", value: "2", disabled: false },
        ],
      },
      { id: "f_check_single", label: "체크 단일", type: "checkbox", required: false },
      { id: "f_date", label: "날짜", type: "date", required: false },
      { id: "f_switch", label: "스위치", type: "switch", required: false },
      {
        id: "f_rel_single",
        label: "관계 단일",
        type: "relation",
        required: false,
        relationConfig: {
          targetFormId: "550e8400-e29b-41d4-a716-446655440000",
          displayField: "title",
          multiple: false,
        },
      },
      {
        id: "f_rel_multi",
        label: "관계 다중",
        type: "relation",
        required: false,
        relationConfig: {
          targetFormId: "550e8400-e29b-41d4-a716-446655440000",
          displayField: "title",
          multiple: true,
        },
      },
      { id: "f_section", label: "구획선", type: "section", required: false },
    ];

    const result = buildDefaultValues(fields);

    // 1. 문자열 기반 필드는 빈 문자열("")
    expect(result.f_text).toBe("");
    expect(result.f_textarea).toBe("");
    expect(result.f_select).toBe("");
    expect(result.f_radio).toBe("");

    // 2. 숫자 및 날짜 필드는 undefined
    expect(result.f_number).toBeUndefined();
    expect(result.f_date).toBeUndefined();

    // 3. 스위치 및 단일 체크박스는 false
    expect(result.f_switch).toBe(false);
    expect(result.f_check_single).toBe(false);

    // 4. 옵션이 있는 다중 체크박스는 빈 배열([])
    expect(result.f_check_multi).toEqual([]);

    // 5. 관계형 필드는 multiple 여부에 따라 undefined 또는 []
    expect(result.f_rel_single).toBeUndefined();
    expect(result.f_rel_multi).toEqual([]);

    // 6. 구획선(section) 필드는 결과 키에서 완전히 제외되어야 함
    expect("f_section" in result).toBe(false);
  });

  it("빈 필드 목록이 전달되면 빈 객체를 반환해야 한다", () => {
    expect(buildDefaultValues([])).toEqual({});
  });
});
