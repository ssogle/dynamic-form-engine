import { describe, it, expect } from "vitest";
import {
  normalizeSelectOption,
  filterSingleSelectOptions,
  filterMultiSelectOptions,
} from "./filter-select-options";
import type { SelectOption } from "@/entities/form";

describe("filter-select-options (features/render-dynamic-form/lib)", () => {
  describe("normalizeSelectOption", () => {
    it("문자열 옵션이 입력되면 label과 value가 동일하고 disabled가 false인 객체로 변환해야 한다", () => {
      const result = normalizeSelectOption("디자인");
      expect(result).toEqual({
        label: "디자인",
        value: "디자인",
        disabled: false,
      });
    });

    it("이미 SelectOption 객체인 경우 disabled 불리언 값을 정확히 정규화하여 반환해야 한다", () => {
      const opt: SelectOption = { label: "개발", value: "dev", disabled: true };
      const result = normalizeSelectOption(opt);
      expect(result).toEqual({
        label: "개발",
        value: "dev",
        disabled: true,
      });
    });
  });

  describe("filterSingleSelectOptions (단일 선택 비활성 옵션 보존 공식)", () => {
    const mockOptions: SelectOption[] = [
      { label: "활성 옵션 1", value: "opt_1", disabled: false },
      { label: "활성 옵션 2", value: "opt_2", disabled: false },
      { label: "비활성 과거 옵션 A", value: "opt_legacy_a", disabled: true },
      { label: "비활성 과거 옵션 B", value: "opt_legacy_b", disabled: true },
    ];

    it("현재 선택된 값이 없거나 활성 옵션인 경우, 비활성화된 옵션들은 모두 제외되어야 한다", () => {
      const resultWhenEmpty = filterSingleSelectOptions(mockOptions, "");
      expect(resultWhenEmpty).toEqual([
        { label: "활성 옵션 1", value: "opt_1", disabled: false },
        { label: "활성 옵션 2", value: "opt_2", disabled: false },
      ]);

      const resultWhenActiveSelected = filterSingleSelectOptions(mockOptions, "opt_1");
      expect(resultWhenActiveSelected).toEqual([
        { label: "활성 옵션 1", value: "opt_1", disabled: false },
        { label: "활성 옵션 2", value: "opt_2", disabled: false },
      ]);
    });

    it("수정 폼에서 비활성 옵션(opt_legacy_a)이 기선택된 값이면 해당 옵션만 선택지에 예외 보존되어야 한다", () => {
      const result = filterSingleSelectOptions(mockOptions, "opt_legacy_a");

      // opt_legacy_a는 보존되고, 선택되지 않은 opt_legacy_b는 제외되어야 함
      expect(result).toEqual([
        { label: "활성 옵션 1", value: "opt_1", disabled: false },
        { label: "활성 옵션 2", value: "opt_2", disabled: false },
        { label: "비활성 과거 옵션 A", value: "opt_legacy_a", disabled: true },
      ]);
    });

    it("원시 옵션 목록이 비어있거나 undefined인 경우 빈 배열을 안전하게 반환해야 한다", () => {
      expect(filterSingleSelectOptions(null, "opt_1")).toEqual([]);
      expect(filterSingleSelectOptions(undefined, "opt_1")).toEqual([]);
      expect(filterSingleSelectOptions([], "opt_1")).toEqual([]);
    });
  });

  describe("filterMultiSelectOptions (다중 선택 비활성 옵션 보존 공식)", () => {
    const mockOptions: SelectOption[] = [
      { label: "사과", value: "apple", disabled: false },
      { label: "바나나", value: "banana", disabled: false },
      { label: "포도(단종)", value: "grape_legacy", disabled: true },
      { label: "수박(단종)", value: "watermelon_legacy", disabled: true },
    ];

    it("다중 선택된 배열에 포함된 비활성 옵션만 선택지에 예외 보존되어야 한다", () => {
      // grape_legacy만 기선택된 상태
      const result = filterMultiSelectOptions(mockOptions, ["apple", "grape_legacy"]);

      expect(result).toEqual([
        { label: "사과", value: "apple", disabled: false },
        { label: "바나나", value: "banana", disabled: false },
        { label: "포도(단종)", value: "grape_legacy", disabled: true },
      ]);
      // 선택되지 않은 watermelon_legacy는 노출되지 않아야 함
      expect(result.some((o) => o.value === "watermelon_legacy")).toBe(false);
    });

    it("선택된 값이 배열이 아니거나 비어있는 경우 비활성 옵션은 모두 제외되어야 한다", () => {
      expect(filterMultiSelectOptions(mockOptions, [])).toEqual([
        { label: "사과", value: "apple", disabled: false },
        { label: "바나나", value: "banana", disabled: false },
      ]);
      expect(filterMultiSelectOptions(mockOptions, null)).toEqual([
        { label: "사과", value: "apple", disabled: false },
        { label: "바나나", value: "banana", disabled: false },
      ]);
    });
  });
});
