import type { CoreFormField, SelectOption } from "@/entities/form";
import {
  FIELD_FILTER_OPERATOR_LABELS,
  isUuid,
  normalizeFieldFilterCondition,
  resolveTargetFieldCapability,
  SYSTEM_FIELD_LABELS,
  type FieldFilterCondition,
} from "@/shared/schema";

/**
 * 선택형 필드(`select`/`radio`/`checkbox`) 필터 조건의 라벨 문자열을 옵션 `value` 코드로 정규화합니다.
 *
 * AI 에이전트 또는 레거시 URL이 옵션 `value`(예: `"MEAL"`) 대신 사람이 읽는 `label`(예: `"식대"`)을
 * 전달하더라도 동일한 필터 결과와 팝오버 체크 상태를 유지하도록 보정합니다.
 */
export function normalizeConditionOptionTokens(
  condition: FieldFilterCondition,
  options?: ReadonlyArray<Pick<SelectOption, "label" | "value">> | null
): FieldFilterCondition {
  const normalized = normalizeFieldFilterCondition(condition);
  if (!options || options.length === 0) {
    return normalized;
  }

  const resolveTokenToValue = (token: string): string => {
    const trimmed = token.trim();
    if (!trimmed) return token;
    // 이미 정확한 option.value 코드와 일치하면 우선 유지합니다.
    const exactValue = options.find((opt) => opt.value === trimmed);
    if (exactValue) return exactValue.value;
    // 라벨과 일치(정확 또는 공백/대소문자 무시)하면 해당 option.value 코드로 치환합니다.
    const exactLabel = options.find((opt) => opt.label.trim() === trimmed);
    if (exactLabel) return exactLabel.value;
    const lowered = trimmed.toLowerCase();
    const ciLabel = options.find((opt) => opt.label.trim().toLowerCase() === lowered);
    return ciLabel ? ciLabel.value : trimmed;
  };

  if (normalized.values && normalized.values.length > 0) {
    return {
      ...normalized,
      values: Array.from(new Set(normalized.values.map(resolveTokenToValue))),
    };
  }

  if (typeof normalized.value === "string") {
    return {
      ...normalized,
      value: resolveTokenToValue(normalized.value),
    };
  }

  return normalized;
}

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
    const labelSet = new Set((field?.options ?? []).map((opt) => opt.label.trim()));
    const displayValues = rawValues.map((val) => {
      if (field?.type === "relation") {
        return relationLabelMap?.get(val) ?? val.slice(0, 8);
      }
      const mapped = optionMap.get(val);
      if (mapped !== undefined) return mapped;
      return labelSet.has(val.trim()) ? val.trim() : val;
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
    const option = (field.options ?? []).find(
      (opt) => opt.value === rawValue || opt.label.trim() === rawValue.trim()
    );
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
