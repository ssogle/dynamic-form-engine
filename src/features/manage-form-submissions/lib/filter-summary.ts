import type { CoreFormField } from "@/entities/form";
import {
  FIELD_FILTER_OPERATOR_LABELS,
  isUuid,
  normalizeFieldFilterCondition,
  resolveTargetFieldCapability,
  SYSTEM_FIELD_LABELS,
  type FieldFilterCondition,
} from "@/shared/schema";

/**
 * 숫자 필터 피연산자를 천 단위 콤마가 포함된 가독성 문자열로 변환합니다.
 */
function formatFilterScalarValue(
  raw: string | number | boolean | undefined,
  fieldType?: string
): string {
  if (raw === undefined) {
    return "";
  }
  const str = String(raw);
  if (fieldType !== "number") {
    return str;
  }
  const cleaned = str.trim().replaceAll(",", "");
  if (!cleaned) {
    return "";
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num.toLocaleString("ko-KR") : str;
}

/**
 * 활성 필터 조건을 툴팁 및 상단 요약 배지에 표시할 가독성 있는 문자열로 포맷팅합니다.
 *
 * @param condition 필터 조건 객체
 * @param field 도메인 필드 정의 (시스템 컬럼인 경우 생략)
 * @param relationLabelMap 관계형 레코드 UUID -> 대표 표시명 매핑 사전
 */
export function formatFilterConditionSummary(
  condition: FieldFilterCondition,
  field?: Pick<CoreFormField, "id" | "label" | "type" | "options"> | null,
  relationLabelMap?: Map<string, string>
): string {
  const normalized = normalizeFieldFilterCondition(condition);
  const capability = resolveTargetFieldCapability(normalized.fieldId, field);
  const opLabel = FIELD_FILTER_OPERATOR_LABELS[normalized.op];

  if (normalized.op === "isEmpty" || normalized.op === "isNotEmpty") {
    return opLabel;
  }

  if (normalized.op === "between") {
    const minStr = formatFilterScalarValue(normalized.min, field?.type);
    const maxStr = formatFilterScalarValue(normalized.max, field?.type);
    return `${minStr} ~ ${maxStr}`.trim();
  }

  if (capability?.filterWidget === "boolean") {
    const isTrue =
      normalized.value === true || normalized.value === "true" || normalized.value === "예";
    return isTrue ? "예" : "아니오";
  }

  if (
    normalized.op === "in" ||
    normalized.op === "notIn" ||
    normalized.op === "hasAny" ||
    normalized.op === "hasAll"
  ) {
    const rawValues = normalized.values ?? [];
    const optionMap = new Map((field?.options ?? []).map((opt) => [opt.value, opt.label]));
    const displayValues = rawValues.map((val) => {
      if (field?.type === "relation") {
        return relationLabelMap?.get(val) ?? val.slice(0, 8);
      }
      return optionMap.get(val) ?? val;
    });
    const joined =
      displayValues.length <= 2
        ? displayValues.join(", ")
        : `${displayValues.slice(0, 2).join(", ")} 외 ${displayValues.length - 2}건`;

    if (normalized.op === "notIn") {
      return `제외: ${joined}`;
    }
    if (normalized.op === "hasAll") {
      return `모두: ${joined}`;
    }
    return joined;
  }

  const rawValue = normalized.value !== undefined ? String(normalized.value) : "";
  if (field?.type === "select" || field?.type === "radio") {
    const option = (field.options ?? []).find((opt) => opt.value === rawValue);
    const display = option?.label ?? rawValue;
    return normalized.op === "eq" ? display : `${opLabel}: ${display}`;
  }

  if (field?.type === "relation" && normalized.op === "eq") {
    const resolved = relationLabelMap?.get(rawValue);
    if (resolved) {
      return resolved;
    }
    return isUuid(rawValue) ? rawValue.slice(0, 8) : rawValue;
  }

  const displayScalar = formatFilterScalarValue(normalized.value, field?.type);

  if (normalized.op === "contains" || normalized.op === "eq") {
    return displayScalar;
  }

  return `${opLabel} ${displayScalar}`.trim();
}

/**
 * 필터 조건의 필드 ID에 대응하는 화면 표시 라벨을 반환합니다.
 */
export function resolveFilterFieldLabel(
  fieldId: string,
  activeFields: ReadonlyArray<Pick<CoreFormField, "id" | "label">>
): string {
  if (fieldId in SYSTEM_FIELD_LABELS) {
    return SYSTEM_FIELD_LABELS[fieldId as keyof typeof SYSTEM_FIELD_LABELS];
  }
  return activeFields.find((f) => f.id === fieldId)?.label ?? fieldId;
}
