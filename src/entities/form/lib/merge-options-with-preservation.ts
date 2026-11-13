import type { SelectOption } from "../schema/form-field.schema";
import { normalizeSelectOptions } from "./select-options";

/**
 * 발행 이후(또는 기제출 응답이 존재하는) 폼의 옵션 변경 시 기존 옵션을 보존 병합합니다.
 *
 * 새 옵션 목록(nextOptions)에 포함되지 않고 누락된 기존 옵션(existingOptions)이 있더라도
 * 물리적으로 삭제하지 않고 `disabled: true` 소프트 비활성화 상태로 보존하여
 * 과거 제출 데이터의 코드값-라벨 매핑 무결성을 영구적으로 유지합니다.
 *
 * @param existingOptions 기존 필드에 저장되어 있던 SelectOption 배열
 * @param nextOptions 새롭게 요청된 SelectOption 배열
 * @returns 누락된 기존 옵션이 disabled: true로 보존 병합된 SelectOption[] 배열
 */
export function mergeOptionsWithPreservation(
  existingOptions?: SelectOption[] | null,
  nextOptions?: SelectOption[] | null
): SelectOption[] {
  const existingList = normalizeSelectOptions(existingOptions);
  const nextList = normalizeSelectOptions(nextOptions);

  const nextValueSet = new Set(nextList.map((opt) => opt.value));

  // 새 목록에 누락된 기존 옵션들은 물리 삭제 대신 disabled: true 상태로 보존합니다.
  const preservedDisabledOptions: SelectOption[] = existingList
    .filter((oldOpt) => !nextValueSet.has(oldOpt.value))
    .map((oldOpt) => ({
      ...oldOpt,
      disabled: true,
    }));

  return [...nextList, ...preservedDisabledOptions];
}
