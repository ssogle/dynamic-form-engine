import { z } from "zod";
import { parseYmdToDate } from "@/shared/lib/date";
import {
  fieldFilterOperatorSchema,
  isSystemFieldId,
  resolveFieldQueryCapability,
  resolveSystemFieldCapability,
  SYSTEM_FIELD_LABELS,
  type FieldCapabilityTarget,
  type FieldFilterOperator,
} from "./field-capability.schema";

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 폼 필드 메타데이터 최소 입력 규격 (엔티티 간 순환 참조 방지를 위한 순수 구조 타입)
 */
export interface FilterableFieldDescriptor extends FieldCapabilityTarget {
  id: string;
  label?: string | undefined;
  deletedAt?: string | null | undefined;
}

/**
 * 필터 조건 평가 시 피연산자가 비어있는지 검사합니다.
 */
function hasNonEmptyScalar(val: unknown): val is string | number | boolean {
  if (val === undefined || val === null) {
    return false;
  }
  if (typeof val === "string") {
    return val.trim().length > 0;
  }
  if (typeof val === "number") {
    return Number.isFinite(val);
  }
  return typeof val === "boolean";
}

/**
 * 문자열 또는 숫자를 유한한 숫자로 파싱합니다 (실패 시 null).
 */
function toFiniteNumber(val: string | number): number | null {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  const normalized = val.trim().replaceAll(",", "");
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * 복수 선택 연산자 여부를 판별합니다.
 */
function isMultiValueOperator(op: FieldFilterOperator): boolean {
  return op === "in" || op === "notIn" || op === "hasAny" || op === "hasAll";
}

/**
 * 피연산자가 필요 없는 단항 연산자 여부를 판별합니다.
 */
function isUnaryOperator(op: FieldFilterOperator): boolean {
  return op === "isEmpty" || op === "isNotEmpty";
}

/**
 * 통합 필드 필터 조건 Zod 스키마 (API, URL 쿼리, AI Navigator 도구 공용)
 *
 * - Gemini Structured Outputs / Vercel AI SDK 도구 스키마 호환을 위해
 *   중첩 discriminatedUnion 대신 평탄화된 객체 + superRefine 검증 구조를 사용합니다.
 * - 기존 `{ fieldId, value }` 형태와의 하위 호환을 위해 `op` 생략 시 `"eq"`로 간주합니다.
 */
export const fieldFilterConditionSchema = z
  .object({
    fieldId: z.string().trim().min(1, "필터 대상 필드 ID는 필수입니다."),
    op: fieldFilterOperatorSchema.optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    values: z.array(z.string().min(1)).optional(),
    min: z.union([z.string(), z.number()]).optional(),
    max: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine((val, ctx) => {
    const op: FieldFilterOperator = val.op ?? "eq";

    if (isUnaryOperator(op)) {
      return;
    }

    if (op === "between") {
      const hasMin = hasNonEmptyScalar(val.min);
      const hasMax = hasNonEmptyScalar(val.max);
      if (!hasMin && !hasMax) {
        ctx.addIssue({
          code: "custom",
          path: ["min"],
          message: "between 연산자에는 최소값(min) 또는 최대값(max) 중 하나 이상이 필요합니다.",
        });
        return;
      }

      if (hasMin && hasMax) {
        const minStr = String(val.min).trim();
        const maxStr = String(val.max).trim();

        if (YMD_PATTERN.test(minStr) && YMD_PATTERN.test(maxStr)) {
          if (!parseYmdToDate(minStr) || !parseYmdToDate(maxStr)) {
            ctx.addIssue({
              code: "custom",
              path: ["min"],
              message: "유효한 YYYY-MM-DD 달력 날짜가 아닙니다.",
            });
            return;
          }
          if (minStr > maxStr) {
            ctx.addIssue({
              code: "custom",
              path: ["max"],
              message: "범위 최대값(max)은 최소값(min)보다 같거나 이후여야 합니다.",
            });
          }
          return;
        }

        const minNum = toFiniteNumber(val.min!);
        const maxNum = toFiniteNumber(val.max!);
        if (minNum !== null && maxNum !== null && minNum > maxNum) {
          ctx.addIssue({
            code: "custom",
            path: ["max"],
            message: "범위 최대값(max)은 최소값(min)보다 크거나 같아야 합니다.",
          });
        }
      }
      return;
    }

    if (isMultiValueOperator(op)) {
      const normalizedValues = (val.values ?? []).map((item) => item.trim()).filter(Boolean);
      const hasSingleFallback = hasNonEmptyScalar(val.value);
      if (normalizedValues.length === 0 && !hasSingleFallback) {
        ctx.addIssue({
          code: "custom",
          path: ["values"],
          message: `${op} 연산자에는 하나 이상의 비교 값(values)이 필요합니다.`,
        });
      }
      return;
    }

    if (!hasNonEmptyScalar(val.value)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `${op} 연산자에는 비교 값(value)이 필수입니다.`,
      });
    }
  });

export type FieldFilterCondition = z.infer<typeof fieldFilterConditionSchema>;

/**
 * 정규화가 완료된 필터 조건 구조 (`op` 보장, 복수 값 배열 통일)
 */
export interface NormalizedFieldFilterCondition {
  fieldId: string;
  op: FieldFilterOperator;
  value?: string | number | boolean | undefined;
  values?: string[] | undefined;
  min?: string | number | undefined;
  max?: string | number | undefined;
}

/**
 * 필터 조건 객체를 정규화합니다.
 * - `op` 생략 시 `"eq"`를 기본 적용합니다.
 * - `in`/`notIn`/`hasAny`/`hasAll`에서 `value`만 전달된 경우 `values: [String(value)]`로 승격합니다.
 * - 문자열 공백을 정리하고 불필요한 빈 피연산자를 제거합니다.
 */
export function normalizeFieldFilterCondition(
  raw: FieldFilterCondition
): NormalizedFieldFilterCondition {
  const fieldId = raw.fieldId.trim();
  const op: FieldFilterOperator = raw.op ?? "eq";

  if (isUnaryOperator(op)) {
    return { fieldId, op };
  }

  if (op === "between") {
    const normalizedMin = hasNonEmptyScalar(raw.min)
      ? typeof raw.min === "string"
        ? raw.min.trim()
        : raw.min
      : undefined;
    const normalizedMax = hasNonEmptyScalar(raw.max)
      ? typeof raw.max === "string"
        ? raw.max.trim()
        : raw.max
      : undefined;

    return {
      fieldId,
      op,
      ...(normalizedMin !== undefined ? { min: normalizedMin } : {}),
      ...(normalizedMax !== undefined ? { max: normalizedMax } : {}),
    };
  }

  if (isMultiValueOperator(op)) {
    const rawList =
      raw.values && raw.values.length > 0
        ? raw.values
        : hasNonEmptyScalar(raw.value)
          ? [String(raw.value)]
          : [];
    const dedupedValues = Array.from(new Set(rawList.map((item) => item.trim()).filter(Boolean)));
    return {
      fieldId,
      op,
      values: dedupedValues,
    };
  }

  const normalizedValue =
    typeof raw.value === "string"
      ? raw.value.trim()
      : (raw.value as string | number | boolean | undefined);

  return {
    fieldId,
    op,
    ...(normalizedValue !== undefined ? { value: normalizedValue } : {}),
  };
}

/**
 * 레거시 `Record<string, unknown>` 필터 맵을 표준 `NormalizedFieldFilterCondition[]` 배열로 승격합니다.
 */
function convertLegacyFilterMap(record: Record<string, unknown>): NormalizedFieldFilterCondition[] {
  const result: NormalizedFieldFilterCondition[] = [];

  for (const [key, val] of Object.entries(record)) {
    const fieldId = key.trim();
    if (!fieldId) continue;

    if (typeof val === "string" && val.trim().length > 0) {
      result.push({
        fieldId,
        op: "contains",
        value: val.trim(),
      });
    } else if (typeof val === "number" && Number.isFinite(val)) {
      result.push({
        fieldId,
        op: "contains",
        value: String(val),
      });
    } else if (typeof val === "boolean") {
      result.push({
        fieldId,
        op: "eq",
        value: val,
      });
    }
  }

  return result;
}

/**
 * JSON 문자열, 필터 배열 또는 레거시 Key-Value 맵을 엄격히 검증·파싱합니다.
 * API 경계에서 잘못된 JSON이나 유효하지 않은 필터 조건에 대해 `400 Bad Request`를 반환할 때 사용합니다.
 */
export function parseFieldFiltersStrict(
  rawInput: unknown
): { data: NormalizedFieldFilterCondition[]; error: null } | { data: null; error: string } {
  if (rawInput === undefined || rawInput === null) {
    return { data: [], error: null };
  }

  let parsedValue: unknown = rawInput;
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (trimmed.length === 0) {
      return { data: [], error: null };
    }
    try {
      parsedValue = JSON.parse(trimmed);
    } catch {
      return { data: null, error: "filters 파라미터는 유효한 JSON 형식이어야 합니다." };
    }
  }

  if (Array.isArray(parsedValue)) {
    const normalizedList: NormalizedFieldFilterCondition[] = [];
    for (let i = 0; i < parsedValue.length; i += 1) {
      const check = fieldFilterConditionSchema.safeParse(parsedValue[i]);
      if (!check.success) {
        const firstIssue = check.error.issues[0]?.message ?? "유효하지 않은 필터 조건입니다.";
        return { data: null, error: `filters[${i}]: ${firstIssue}` };
      }
      normalizedList.push(normalizeFieldFilterCondition(check.data));
    }
    return { data: normalizedList, error: null };
  }

  if (parsedValue && typeof parsedValue === "object") {
    return {
      data: convertLegacyFilterMap(parsedValue as Record<string, unknown>),
      error: null,
    };
  }

  return { data: null, error: "filters 파라미터는 배열 또는 객체 형식이어야 합니다." };
}

/**
 * URL 쿼리스트링이나 비신뢰 입력에서 필터 목록을 안전하게 추출합니다.
 * 파싱 실패나 잘못된 항목은 예외를 던지지 않고 무시하며, 레거시 맵 입력을 자동 승격합니다.
 */
export function parseFieldFiltersParam(rawInput: unknown): NormalizedFieldFilterCondition[] {
  if (rawInput === undefined || rawInput === null) {
    return [];
  }

  let parsedValue: unknown = rawInput;
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (trimmed.length === 0) {
      return [];
    }
    try {
      parsedValue = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsedValue)) {
    const validConditions: NormalizedFieldFilterCondition[] = [];
    for (const item of parsedValue) {
      const check = fieldFilterConditionSchema.safeParse(item);
      if (check.success) {
        validConditions.push(normalizeFieldFilterCondition(check.data));
      }
    }
    return validConditions;
  }

  if (parsedValue && typeof parsedValue === "object") {
    return convertLegacyFilterMap(parsedValue as Record<string, unknown>);
  }

  return [];
}

/**
 * 필터 조건 배열을 결정론적 순서의 JSON 문자열로 직렬화합니다.
 * 비어있으면 `undefined`를 반환하며, 출처 링크 중복 제거 키 및 URL 쿼리 생성에 사용됩니다.
 */
export function serializeFieldFiltersParam(
  filters?: ReadonlyArray<FieldFilterCondition> | null
): string | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }

  const normalized: NormalizedFieldFilterCondition[] = [];
  for (const raw of filters) {
    const check = fieldFilterConditionSchema.safeParse(raw);
    if (check.success) {
      normalized.push(normalizeFieldFilterCondition(check.data));
    }
  }

  if (normalized.length === 0) {
    return undefined;
  }

  const sorted = [...normalized].sort((a, b) => {
    const byField = a.fieldId.localeCompare(b.fieldId);
    if (byField !== 0) return byField;
    const byOp = a.op.localeCompare(b.op);
    if (byOp !== 0) return byOp;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });

  return JSON.stringify(sorted);
}

/**
 * 개별 필터 피연산자가 대상 필드 타입(number / date / system_date / boolean)에 적합한 값인지 검증합니다.
 */
function validateOperandTypes(
  condition: NormalizedFieldFilterCondition,
  fieldType: string,
  fieldLabel: string
): string | null {
  if (isUnaryOperator(condition.op)) {
    return null;
  }

  if (fieldType === "number") {
    if (condition.op === "between") {
      if (condition.min !== undefined && toFiniteNumber(condition.min) === null) {
        return `숫자 필드 '${fieldLabel}'의 최소값('${String(condition.min)}')이 올바른 숫자가 아닙니다.`;
      }
      if (condition.max !== undefined && toFiniteNumber(condition.max) === null) {
        return `숫자 필드 '${fieldLabel}'의 최대값('${String(condition.max)}')이 올바른 숫자가 아닙니다.`;
      }
      return null;
    }

    if (
      condition.value !== undefined &&
      typeof condition.value !== "boolean" &&
      toFiniteNumber(condition.value) === null
    ) {
      return `숫자 필드 '${fieldLabel}'의 비교 값('${String(condition.value)}')이 올바른 숫자가 아닙니다.`;
    }
    if (typeof condition.value === "boolean") {
      return `숫자 필드 '${fieldLabel}'에는 불리언 값을 비교할 수 없습니다.`;
    }
    return null;
  }

  if (fieldType === "date" || fieldType === "system_date") {
    if (condition.op === "between") {
      if (condition.min !== undefined && !parseYmdToDate(String(condition.min))) {
        return `날짜 필드 '${fieldLabel}'의 시작일('${String(condition.min)}')은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.`;
      }
      if (condition.max !== undefined && !parseYmdToDate(String(condition.max))) {
        return `날짜 필드 '${fieldLabel}'의 종료일('${String(condition.max)}')은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.`;
      }
      return null;
    }

    if (condition.value !== undefined && !parseYmdToDate(String(condition.value))) {
      return `날짜 필드 '${fieldLabel}'의 비교 값('${String(condition.value)}')은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.`;
    }
    return null;
  }

  return null;
}

/**
 * 필터 조건 목록을 대상 폼의 필드 정의 및 Capability Matrix에 대조하여 검증합니다.
 * Result 패턴(`{ data, error }`)으로 정규화된 필터 목록 또는 한국어 오류 메시지를 반환합니다.
 */
export function validateFiltersAgainstFields(
  filters: ReadonlyArray<FieldFilterCondition>,
  fields: ReadonlyArray<FilterableFieldDescriptor>,
  options: { allowSystemFields?: boolean } = {}
): { data: NormalizedFieldFilterCondition[]; error: null } | { data: null; error: string } {
  const { allowSystemFields = true } = options;

  if (filters.length === 0) {
    return { data: [], error: null };
  }

  const activeFieldMap = new Map<string, FilterableFieldDescriptor>();
  for (const field of fields) {
    if (!field || !field.id || field.deletedAt) continue;
    activeFieldMap.set(field.id, field);
  }

  const normalizedList: NormalizedFieldFilterCondition[] = [];

  for (const rawCondition of filters) {
    const parsed = fieldFilterConditionSchema.safeParse(rawCondition);
    if (!parsed.success) {
      return {
        data: null,
        error: parsed.error.issues[0]?.message ?? "유효하지 않은 필터 조건입니다.",
      };
    }

    const condition = normalizeFieldFilterCondition(parsed.data);

    if (isSystemFieldId(condition.fieldId)) {
      if (!allowSystemFields) {
        return {
          data: null,
          error: `필터 기준 필드('${condition.fieldId}')가 폼 활성 스키마에 존재하지 않습니다.`,
        };
      }
      const sysCap = resolveSystemFieldCapability(condition.fieldId);
      const sysLabel = SYSTEM_FIELD_LABELS[condition.fieldId];
      if (!sysCap || !sysCap.filterOperators.includes(condition.op)) {
        return {
          data: null,
          error: `시스템 컬럼 '${sysLabel}'에서는 '${condition.op}' 필터 연산자를 사용할 수 없습니다.`,
        };
      }

      const sysType = condition.fieldId === "id" ? "text" : "system_date";
      const operandError = validateOperandTypes(condition, sysType, sysLabel);
      if (operandError) {
        return { data: null, error: operandError };
      }

      normalizedList.push(condition);
      continue;
    }

    const field = activeFieldMap.get(condition.fieldId);
    if (!field) {
      return {
        data: null,
        error: `필터 기준 필드('${condition.fieldId}')가 폼 활성 스키마에 존재하지 않습니다.`,
      };
    }

    const capability = resolveFieldQueryCapability(field);
    const fieldLabel = field.label || field.id;
    const fieldType = field.type ?? "unknown";

    if (!capability) {
      return {
        data: null,
        error: `필드 '${fieldLabel}'(타입: ${fieldType})의 조회 능력을 해석할 수 없습니다.`,
      };
    }

    if (!capability.filterOperators.includes(condition.op)) {
      return {
        data: null,
        error: `필드 '${fieldLabel}'(타입: ${fieldType})에서는 '${condition.op}' 필터 연산자를 사용할 수 없습니다.`,
      };
    }

    const operandError = validateOperandTypes(condition, fieldType, fieldLabel);
    if (operandError) {
      return { data: null, error: operandError };
    }

    normalizedList.push(condition);
  }

  return { data: normalizedList, error: null };
}
