import type { SelectOption } from "../schema/form-field.schema";

/**
 * 단일 SelectOption 객체를 표준 불리언 `disabled` 상태 포함 형태로 정규화합니다.
 *
 * @param opt 정규화할 선택 옵션 객체
 * @returns 정규화된 SelectOption 객체
 */
export function normalizeSelectOption(opt: SelectOption): SelectOption {
  return {
    label: opt.label,
    value: opt.value,
    description: opt.description,
    disabled: Boolean(opt.disabled),
  };
}

/**
 * SelectOption 배열을 일괄 정규화합니다. null/undefined 입력 시 빈 배열을 반환합니다.
 *
 * @param options 원본 SelectOption 배열
 * @returns 정규화된 SelectOption[] 배열
 */
export function normalizeSelectOptions(options?: SelectOption[] | null): SelectOption[] {
  if (!options || options.length === 0) {
    return [];
  }
  return options.map(normalizeSelectOption);
}
