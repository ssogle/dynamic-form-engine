import type { SelectOption } from "@/entities/form";

/**
 * SelectOption 객체를 표준 불리언 disabled 상태 및 필수 설명(description) 포함 형태로 정규화하는 내부 헬퍼입니다.
 */
function normalizeSelectOption(opt: SelectOption): SelectOption {
  return {
    label: opt.label,
    value: opt.value,
    description: opt.description,
    disabled: Boolean(opt.disabled),
  };
}

/**
 * 단일 선택(select, radio) 컴포넌트를 위한 옵션 필터링 순수 함수
 *
 * [수정 폼 비활성 옵션 보존 공식]
 * - 비활성화되지 않은 정상 옵션(!opt.disabled)은 무조건 노출합니다.
 * - 비활성화된 옵션(opt.disabled === true)이라도 현재 레코드에 기선택된 값(opt.value === currentValue)이면
 *   과거 데이터의 라벨이 빈칸으로 깨지는 버그를 방지하기 위해 선택지에 예외적으로 보존 노출합니다.
 *
 * @param rawOptions 필드에 정의된 SelectOption 목록
 * @param currentValue 현재 필드에 선택된 값
 * @returns 화면에 노출되어야 할 필터링된 SelectOption 배열
 */
export function filterSingleSelectOptions(
  rawOptions?: SelectOption[] | null,
  currentValue?: string | null
): SelectOption[] {
  if (!rawOptions || rawOptions.length === 0) {
    return [];
  }

  const targetValue =
    currentValue !== undefined && currentValue !== null ? String(currentValue) : "";

  return rawOptions
    .map(normalizeSelectOption)
    .filter((opt) => !opt.disabled || (targetValue !== "" && opt.value === targetValue));
}

/**
 * 다중 선택(checkbox) 컴포넌트를 위한 옵션 필터링 순수 함수
 *
 * [수정 폼 비활성 옵션 보존 공식]
 * - 비활성화되지 않은 정상 옵션(!opt.disabled)은 무조건 노출합니다.
 * - 비활성화된 옵션이라도 현재 레코드에서 이미 선택된 값 배열(currentValues.includes(opt.value))에 포함되어 있으면
 *   선택지에 예외적으로 보존 노출합니다.
 *
 * @param rawOptions 필드에 정의된 SelectOption 목록
 * @param currentValues 현재 필드에 선택된 값들의 배열
 * @returns 화면에 노출되어야 할 필터링된 SelectOption 배열
 */
export function filterMultiSelectOptions(
  rawOptions?: SelectOption[] | null,
  currentValues?: string[] | unknown
): SelectOption[] {
  if (!rawOptions || rawOptions.length === 0) {
    return [];
  }

  const selectedList = Array.isArray(currentValues) ? currentValues.map(String) : [];

  return rawOptions
    .map(normalizeSelectOption)
    .filter((opt) => !opt.disabled || selectedList.includes(opt.value));
}
