import {
  formatFieldDisplayValue,
  orderFieldsWithPrimaryFirst,
  type ActiveForm,
  type CoreFormField,
  type Form,
} from "@/entities/form";
import { normalizeStringIds } from "@/shared/lib/normalize";
import {
  resolveFieldQueryCapability,
  serializeFieldFiltersParam,
  type FieldFilterCondition,
} from "@/shared/schema";

/**
 * 관계형 필드의 폼 값(단일 UUID 문자열 또는 다중 UUID 배열)을
 * 중복 제거된 유효 ID 문자열 배열로 정규화합니다.
 *
 * @param value React Hook Form 필드 현재 값
 * @param multiple 다중 선택 허용 여부
 * @returns 정규화된 타깃 레코드 ID 배열
 */
export function normalizeSelectedRelationIds(value: unknown, multiple: boolean): string[] {
  return normalizeStringIds(value, { maxItems: multiple ? undefined : 1 });
}

/**
 * 관계형 피커 다이얼로그에서 행을 클릭/체크했을 때의 다음 폼 값을 계산합니다.
 * 단일 선택과 다중 선택 모두 표준 string[] 배열 포맷으로 반환합니다.
 *
 * - 단일 선택(multiple=false): 선택한 [targetId] 단일 원소 배열을 반환합니다.
 * - 다중 선택(multiple=true): 이미 선택된 ID면 해제하고, 아니면 목록 끝에 추가합니다.
 */
export function toggleRelationSelection(params: {
  currentIds: string[];
  targetId: string;
  multiple: boolean;
}): string[] {
  const { currentIds, targetId, multiple } = params;

  if (!multiple) {
    return [targetId];
  }

  if (currentIds.includes(targetId)) {
    return currentIds.filter((id) => id !== targetId);
  }
  return [...currentIds, targetId];
}

/**
 * 선택된 미니 테이블에서 특정 행의 연결 해제(X 버튼) 클릭 시 다음 폼 값을 계산합니다.
 */
export function removeRelationSelection(params: {
  currentIds: string[];
  targetId: string;
  multiple: boolean;
}): string[] {
  const { currentIds, targetId, multiple } = params;
  if (!multiple) {
    return [];
  }
  return currentIds.filter((id) => id !== targetId);
}

/**
 * 타깃 폼의 활성 필드 목록을 추출하되, 대표 필드(primaryFieldId)를 가장 왼쪽(첫 번째 열)으로 배치합니다.
 *
 * 사용자가 피커 다이얼로그 및 선택 결과 미니 테이블에서 레코드의 핵심 식별값을
 * 스크롤 없이 즉시 파악할 수 있도록 보장합니다.
 *
 * @param targetForm 참조 대상 타깃 폼 메타데이터
 * @returns 대표 필드가 최우선 정렬된 CoreFormField 배열
 */
export function orderTargetColumns(targetForm?: Form | ActiveForm | null): CoreFormField[] {
  return orderFieldsWithPrimaryFirst(targetForm);
}

/**
 * 타깃 테이블 셀에 표시할 개별 필드 값을 가독성 있는 문자열로 포맷팅합니다.
 *
 * @param rawVal 서브미션 row.data[field.id] 원시 값
 * @param field 해당 컬럼의 CoreFormField 정의
 * @returns 셀에 렌더링할 포맷팅된 문자열
 */
export function formatRelationCellValue(rawVal: unknown, field: CoreFormField): string {
  return formatFieldDisplayValue(rawVal, field);
}

/**
 * 피커 다이얼로그 내 빠른 검색어(대표 필드 대상)와 컬럼 헤더별 상세 필터를 결합하여
 * GET /api/v1/forms/[id]/submissions 의 `filters` 쿼리 JSON 문자열(FieldFilterCondition[])을 생성합니다.
 */
export function buildPickerFilterString(params: {
  primaryFieldId?: string | undefined;
  primaryFieldType?: string | undefined;
  searchQuery?: string | undefined;
  columnFilters: Record<string, string>;
}): string | undefined {
  const { primaryFieldId, primaryFieldType, searchQuery, columnFilters } = params;
  const filterMap = new Map<string, FieldFilterCondition>();

  for (const [key, val] of Object.entries(columnFilters)) {
    const trimmed = val.trim();
    if (trimmed.length > 0) {
      filterMap.set(key, { fieldId: key, op: "contains", value: trimmed });
    }
  }

  const trimmedSearch = searchQuery?.trim() ?? "";
  if (trimmedSearch.length > 0 && primaryFieldId) {
    const cap = resolveFieldQueryCapability({ type: primaryFieldType ?? "text" });
    if (cap?.filterOperators.includes("contains")) {
      filterMap.set(primaryFieldId, {
        fieldId: primaryFieldId,
        op: "contains",
        value: trimmedSearch,
      });
    } else if (cap?.filterOperators.includes("eq")) {
      filterMap.set(primaryFieldId, {
        fieldId: primaryFieldId,
        op: "eq",
        value: primaryFieldType === "number" ? Number(trimmedSearch) : trimmedSearch,
      });
    }
  }

  return serializeFieldFiltersParam(Array.from(filterMap.values()));
}
