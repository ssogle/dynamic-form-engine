import { describe, expect, it } from "vitest";
import type { SelectOption } from "../schema/form-field.schema";
import { normalizeSelectOption, normalizeSelectOptions } from "./select-options";

describe("select-options (entities/form/lib)", () => {
  it("normalizeSelectOption은 disabled 생략 시 false로 정규화하고 기존 속성을 보존해야 한다", () => {
    const rawOption = {
      label: "긴급",
      value: "HIGH",
      description: "즉시 처리가 필요한 최우선 요청입니다.",
    } as SelectOption;

    expect(normalizeSelectOption(rawOption)).toEqual({
      label: "긴급",
      value: "HIGH",
      description: "즉시 처리가 필요한 최우선 요청입니다.",
      disabled: false,
    });

    expect(
      normalizeSelectOption({
        ...rawOption,
        disabled: true,
      })
    ).toEqual({
      label: "긴급",
      value: "HIGH",
      description: "즉시 처리가 필요한 최우선 요청입니다.",
      disabled: true,
    });
  });

  it("normalizeSelectOptions는 null 또는 undefined 입력 시 빈 배열을 반환하고 배열을 일괄 정규화해야 한다", () => {
    expect(normalizeSelectOptions(null)).toEqual([]);
    expect(normalizeSelectOptions(undefined)).toEqual([]);

    const normalized = normalizeSelectOptions([
      { label: "일반", value: "NORMAL", description: "표준 일정으로 처리합니다." } as SelectOption,
      {
        label: "폐기",
        value: "LEGACY",
        description: "더 이상 사용하지 않는 옵션입니다.",
        disabled: true,
      },
    ]);

    expect(normalized).toEqual([
      {
        label: "일반",
        value: "NORMAL",
        description: "표준 일정으로 처리합니다.",
        disabled: false,
      },
      {
        label: "폐기",
        value: "LEGACY",
        description: "더 이상 사용하지 않는 옵션입니다.",
        disabled: true,
      },
    ]);
  });
});
