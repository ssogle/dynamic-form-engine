import { describe, it, expect } from "vitest";
import { buildDefaultValues } from "./build-default-values";
import type { CoreFormField } from "@/entities/form";

describe("buildDefaultValues (features/render-dynamic-form/lib)", () => {
  it("코어 9종 도메인 필드에 대해 타입별 올바른 기본값을 생성해야 한다", () => {
    const fields: CoreFormField[] = [
      {
        id: "f_text",
        label: "단문",
        type: "text",
        required: false,
        description: "단문 텍스트를 입력합니다.",
      },
      {
        id: "f_textarea",
        label: "장문",
        type: "textarea",
        required: false,
        description: "장문 텍스트를 입력합니다.",
      },
      {
        id: "f_number",
        label: "숫자",
        type: "number",
        required: false,
        description: "숫자 값을 입력합니다.",
      },
      {
        id: "f_select",
        label: "선택",
        type: "select",
        required: false,
        description: "옵션 중 하나를 선택합니다.",
        options: [
          { label: "A", value: "A", description: "A 유형 선택", disabled: false },
          { label: "B", value: "B", description: "B 유형 선택", disabled: false },
        ],
      },
      {
        id: "f_radio",
        label: "라디오",
        type: "radio",
        required: false,
        description: "라디오 버튼에서 선택합니다.",
        options: [
          { label: "O", value: "O", description: "동의 또는 해당함", disabled: false },
          { label: "X", value: "X", description: "비동의 또는 해당 없음", disabled: false },
        ],
      },
      {
        id: "f_check_multi",
        label: "체크 다중",
        type: "checkbox",
        required: false,
        description: "다중 항목을 선택합니다.",
        options: [
          { label: "1", value: "1", description: "1번 항목", disabled: false },
          { label: "2", value: "2", description: "2번 항목", disabled: false },
        ],
      },
      {
        id: "f_check_single",
        label: "체크 단일",
        type: "checkbox",
        required: false,
        description: "동의 여부를 체크합니다.",
      },
      {
        id: "f_date",
        label: "날짜",
        type: "date",
        required: false,
        description: "날짜를 선택합니다.",
      },
      {
        id: "f_switch",
        label: "스위치",
        type: "switch",
        required: false,
        description: "활성화 여부를 전환합니다.",
      },
      {
        id: "f_rel_single",
        label: "관계 단일",
        type: "relation",
        required: false,
        description: "참조할 단일 대상을 연결합니다.",
        relationConfig: {
          targetFormId: "550e8400-e29b-41d4-a716-446655440000",
          multiple: false,
        },
      },
      {
        id: "f_rel_multi",
        label: "관계 다중",
        type: "relation",
        required: false,
        description: "참조할 다중 대상을 연결합니다.",
        relationConfig: {
          targetFormId: "550e8400-e29b-41d4-a716-446655440000",
          multiple: true,
        },
      },
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
  });

  it("빈 필드 목록이 전달되면 빈 객체를 반환해야 한다", () => {
    expect(buildDefaultValues([])).toEqual({});
  });
});
