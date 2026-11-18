import "server-only";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/db/server";
import {
  isSystemFieldId,
  normalizeFieldFilterCondition,
  resolveFieldQueryCapability,
  validateFiltersAgainstFields,
  type FieldFilterCondition,
  type FilterableFieldDescriptor,
  type NormalizedFieldFilterCondition,
} from "@/shared/schema";
import { forms, type FormSchemaDefinition } from "@/shared/tables";
import { resolveFieldOptionLabelMap, type AnalyticsFieldMeta } from "../lib/analytics-calculator";
import { isValidTimezone } from "../schema/date-range.schema";
import { formSubmissions } from "../schema/form-submission.schema";
import { buildValidFieldDateSql } from "./date-filter-sql.server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 공용 필터 SQL 조건 생성 옵션
 */
export interface BuildFieldFilterSqlOptions {
  filters?: ReadonlyArray<FieldFilterCondition> | undefined;
  schemaDefinition?: FormSchemaDefinition | null | undefined;
  timezone?: string | undefined;
  /** 시스템 컬럼(id, createdAt, updatedAt) 필터링 허용 여부 (기본값: true) */
  allowSystemFields?: boolean | undefined;
  /** schemaDefinition이 전달되지 않은 직접 호출 시 폴백 허용 여부 (기본값: false) */
  fallbackWithoutSchema?: boolean | undefined;
}

/**
 * JSONB 문자열 값을 안전하게 숫자(double precision)로 변환하는 SQL 표현식을 생성합니다.
 * 빈 문자열, 비수치 텍스트, 콤마 포함 숫자를 안전하게 정제합니다.
 */
export function buildSafeNumericSql(targetFieldId: string): SQL<number | null> {
  const cleanedText = sql`NULLIF(REGEXP_REPLACE(TRIM(COALESCE(${formSubmissions.data}->>${targetFieldId}, '')), ',', '', 'g'), '')`;
  return sql<
    number | null
  >`CASE WHEN ${cleanedText} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${cleanedText})::double precision ELSE NULL END`;
}

/**
 * FormSchemaDefinition에서 활성 필터 대상 필드 메타데이터 배열을 추출합니다.
 */
export function extractFilterableFields(
  schemaDefinition?: FormSchemaDefinition | null
): FilterableFieldDescriptor[] {
  if (!schemaDefinition || !Array.isArray(schemaDefinition.fields)) {
    return [];
  }

  const descriptors: FilterableFieldDescriptor[] = [];
  for (const rawField of schemaDefinition.fields) {
    if (!rawField || typeof rawField !== "object") continue;
    const id = typeof rawField.id === "string" ? rawField.id : "";
    const type = typeof rawField.type === "string" ? rawField.type : "";
    if (!id || !type) continue;

    descriptors.push({
      id,
      type,
      label: typeof rawField.label === "string" ? rawField.label : id,
      options: Array.isArray(rawField.options) ? rawField.options : undefined,
      deletedAt: typeof rawField.deletedAt === "string" ? rawField.deletedAt : null,
    });
  }

  return descriptors;
}

/**
 * 관계형(relation) 필드 필터 값이 레코드 UUID 대신 대상 폼 대표명(또는 부분 검색어)으로 전달된 경우,
 * 대상 폼의 대표 필드 일치 레코드 UUID 목록을 조회해 정밀한 필터링 조건으로 정규화합니다.
 */
export async function resolveRelationFilterCandidateIds(
  targetFormId: string | undefined,
  queryText: string,
  mode: "exact" | "contains" = "exact"
): Promise<string[]> {
  if (!targetFormId) {
    return [];
  }

  const [targetForm] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, targetFormId), isNull(forms.deletedAt)))
    .limit(1);

  if (!targetForm) {
    return [];
  }

  const fields = Array.isArray(targetForm.schemaDefinition?.fields)
    ? targetForm.schemaDefinition.fields
    : [];
  const primaryFieldId =
    targetForm.schemaDefinition?.primaryFieldId ||
    fields.find((f) => !f.deletedAt && typeof f.id === "string" && f.type === "text")?.id;

  if (typeof primaryFieldId !== "string" || !primaryFieldId) {
    return [];
  }

  const normalized = queryText.trim();
  if (!normalized) {
    return [];
  }

  const matchExpr =
    mode === "contains"
      ? sql`COALESCE(${formSubmissions.data}->>${primaryFieldId}, '') ILIKE ${`%${normalized}%`}`
      : sql`TRIM(COALESCE(${formSubmissions.data}->>${primaryFieldId}, '')) = ${normalized}`;

  const matchedRows = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(eq(formSubmissions.formId, targetFormId), isNull(formSubmissions.deletedAt), matchExpr)
    )
    .limit(mode === "contains" ? 100 : 50);

  return matchedRows.map((r) => r.id);
}

/**
 * JSONB 필드의 빈 값(키 미존재, null, 공백 문자열, 빈 배열) 판별 SQL 표현식을 반환합니다.
 */
function buildIsEmptyJsonbSql(fieldId: string): SQL {
  return sql`(
    ${formSubmissions.data}->${fieldId} IS NULL
    OR jsonb_typeof(${formSubmissions.data}->${fieldId}) = 'null'
    OR (
      jsonb_typeof(${formSubmissions.data}->${fieldId}) = 'array'
      AND jsonb_array_length(${formSubmissions.data}->${fieldId}) = 0
    )
    OR (
      jsonb_typeof(${formSubmissions.data}->${fieldId}) <> 'array'
      AND TRIM(COALESCE(${formSubmissions.data}->>${fieldId}, '')) = ''
    )
  )`;
}

/**
 * 단일 스칼라 값 또는 JSONB 배열 요소 포함 여부를 매칭하는 SQL 표현식을 생성합니다.
 */
function buildJsonbCandidateMatchSql(fieldId: string, candidate: string): SQL {
  return sql`(
    ${formSubmissions.data}->>${fieldId} = ${candidate}
    OR (
      jsonb_typeof(${formSubmissions.data}->${fieldId}) = 'array'
      AND ${formSubmissions.data}->${fieldId} @> ${JSON.stringify([candidate])}::jsonb
    )
  )`;
}

/**
 * 옵션 코드 또는 라벨 문자열 목록을 실제 저장 코드값(value) 배열로 정규화합니다.
 */
function resolveOptionCandidateCodes(
  rawValues: string[],
  optionsMap?: Map<string, string>
): string[] {
  const candidates = new Set<string>();
  for (const rawValue of rawValues) {
    const trimmed = rawValue.trim();
    if (!trimmed) continue;

    if (optionsMap && optionsMap.has(trimmed)) {
      candidates.add(trimmed);
      continue;
    }

    let matchedCode: string | undefined;
    if (optionsMap) {
      for (const [code, label] of optionsMap.entries()) {
        if (label === trimmed) {
          matchedCode = code;
          break;
        }
      }
    }
    candidates.add(matchedCode ?? trimmed);
  }
  return Array.from(candidates);
}

/**
 * 시스템 컬럼(id, createdAt, updatedAt) 단일 필터 조건을 SQL 표현식으로 변환합니다.
 */
function buildSystemFieldConditionSql(
  condition: NormalizedFieldFilterCondition,
  timezone: string
): SQL | null {
  if (condition.fieldId === "id") {
    const keyword = String(condition.value ?? "").trim();
    if (!keyword) return null;
    if (condition.op === "eq") {
      return sql`${formSubmissions.id}::text = ${keyword}`;
    }
    return sql`${formSubmissions.id}::text ILIKE ${`%${keyword}%`}`;
  }

  const col =
    condition.fieldId === "createdAt" ? formSubmissions.createdAt : formSubmissions.updatedAt;

  if (condition.op === "between") {
    const parts: SQL[] = [];
    if (condition.min !== undefined) {
      const startStr = String(condition.min).trim();
      parts.push(sql`${col} >= ((${startStr} || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`);
    }
    if (condition.max !== undefined) {
      const endStr = String(condition.max).trim();
      parts.push(
        sql`${col} < ((((${endStr})::date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`
      );
    }
    return parts.length === 0 ? null : parts.length === 1 ? parts[0]! : (and(...parts) ?? null);
  }

  const dateStr = String(condition.value ?? "").trim();
  if (!dateStr) return null;

  if (condition.op === "gte") {
    return sql`${col} >= ((${dateStr} || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`;
  }
  if (condition.op === "lte") {
    return sql`${col} < ((((${dateStr})::date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`;
  }
  // eq: 해당 날짜 00:00:00 ~ 다음날 00:00:00 미만
  return (
    and(
      sql`${col} >= ((${dateStr} || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`,
      sql`${col} < ((((${dateStr})::date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`
    ) ?? null
  );
}

/**
 * 숫자 문자열 또는 숫자를 유한한 JS number로 파싱합니다.
 */
function parseNumericOperand(raw: string | number | boolean | undefined): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().replaceAll(",", "");
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * 단일 도메인 필드 필터 조건을 PostgreSQL SQL 표현식으로 변환합니다.
 */
async function buildDomainFieldConditionSql(
  condition: NormalizedFieldFilterCondition,
  fieldMeta?: AnalyticsFieldMeta
): Promise<SQL | null> {
  const { fieldId, op } = condition;

  if (op === "isEmpty") {
    return buildIsEmptyJsonbSql(fieldId);
  }
  if (op === "isNotEmpty") {
    return sql`NOT ${buildIsEmptyJsonbSql(fieldId)}`;
  }

  const fieldType = fieldMeta?.type ?? "text";
  const capability = fieldMeta
    ? resolveFieldQueryCapability({
        type: fieldMeta.type,
        options:
          fieldMeta.optionsMap.size > 0 ? Array.from(fieldMeta.optionsMap.keys()) : undefined,
      })
    : null;

  // 1. 숫자형(number) 조건 처리
  if (fieldType === "number") {
    const numExpr = buildSafeNumericSql(fieldId);
    if (op === "between") {
      const minNum = parseNumericOperand(condition.min);
      const maxNum = parseNumericOperand(condition.max);
      if (minNum !== null && maxNum !== null) {
        return sql`${numExpr} BETWEEN ${minNum}::double precision AND ${maxNum}::double precision`;
      }
      if (minNum !== null) {
        return sql`${numExpr} >= ${minNum}::double precision`;
      }
      if (maxNum !== null) {
        return sql`${numExpr} <= ${maxNum}::double precision`;
      }
      return null;
    }

    const targetNum = parseNumericOperand(condition.value);
    if (targetNum === null) return null;

    switch (op) {
      case "eq":
        return sql`${numExpr} = ${targetNum}::double precision`;
      case "neq":
        return sql`${numExpr} IS DISTINCT FROM ${targetNum}::double precision`;
      case "gt":
        return sql`${numExpr} > ${targetNum}::double precision`;
      case "gte":
        return sql`${numExpr} >= ${targetNum}::double precision`;
      case "lt":
        return sql`${numExpr} < ${targetNum}::double precision`;
      case "lte":
        return sql`${numExpr} <= ${targetNum}::double precision`;
      default:
        return null;
    }
  }

  // 2. 날짜형(date) 조건 처리
  if (fieldType === "date") {
    const dateExpr = buildValidFieldDateSql(fieldId);
    if (op === "between") {
      const minStr = condition.min !== undefined ? String(condition.min).trim() : undefined;
      const maxStr = condition.max !== undefined ? String(condition.max).trim() : undefined;
      if (minStr && maxStr) {
        return sql`${dateExpr} BETWEEN (${minStr})::date AND (${maxStr})::date`;
      }
      if (minStr) {
        return sql`${dateExpr} >= (${minStr})::date`;
      }
      if (maxStr) {
        return sql`${dateExpr} <= (${maxStr})::date`;
      }
      return null;
    }

    const dateStr = String(condition.value ?? "").trim();
    if (!dateStr) return null;

    switch (op) {
      case "eq":
        return sql`${dateExpr} = (${dateStr})::date`;
      case "gte":
        return sql`${dateExpr} >= (${dateStr})::date`;
      case "lte":
        return sql`${dateExpr} <= (${dateStr})::date`;
      default:
        return null;
    }
  }

  // 3. 불리언(switch 및 옵션 없는 checkbox) 조건 처리
  if (capability?.filterWidget === "boolean") {
    const rawBool = condition.value;
    const isTrue = rawBool === true || rawBool === "true" || rawBool === "예";
    const expectedText = isTrue ? "true" : "false";
    return sql`LOWER(TRIM(COALESCE(${formSubmissions.data}->>${fieldId}, ''))) = ${expectedText}`;
  }

  // 4. 선택형(select, radio, 옵션 보유 checkbox) 조건 처리
  if (fieldType === "select" || fieldType === "radio" || fieldType === "checkbox") {
    const rawList =
      condition.values && condition.values.length > 0
        ? condition.values
        : condition.value !== undefined
          ? [String(condition.value)]
          : [];
    const candidates = resolveOptionCandidateCodes(rawList, fieldMeta?.optionsMap);
    if (candidates.length === 0) {
      return op === "notIn" ? null : sql`FALSE`;
    }

    const predicates = candidates.map((candidate) =>
      buildJsonbCandidateMatchSql(fieldId, candidate)
    );

    if (op === "hasAll") {
      return predicates.length === 1 ? predicates[0]! : (and(...predicates) ?? null);
    }

    const anyMatch = predicates.length === 1 ? predicates[0]! : or(...predicates);
    if (!anyMatch) return null;

    if (op === "notIn") {
      return sql`(
        ${formSubmissions.data}->${fieldId} IS NULL
        OR jsonb_typeof(${formSubmissions.data}->${fieldId}) = 'null'
        OR NOT (${anyMatch})
      )`;
    }

    return anyMatch;
  }

  // 5. 관계형(relation) 조건 처리 (UUID 및 자연어 대표명 해석)
  if (fieldType === "relation") {
    if (op === "contains") {
      const keyword = String(condition.value ?? "").trim();
      if (!keyword) return null;
      const resolvedIds = await resolveRelationFilterCandidateIds(
        fieldMeta?.relationTargetFormId,
        keyword,
        "contains"
      );
      if (resolvedIds.length === 0) {
        return sql`FALSE`;
      }
      const predicates = resolvedIds.map((id) => buildJsonbCandidateMatchSql(fieldId, id));
      return predicates.length === 1 ? predicates[0]! : (or(...predicates) ?? null);
    }

    const rawList =
      condition.values && condition.values.length > 0
        ? condition.values
        : condition.value !== undefined
          ? [String(condition.value)]
          : [];
    const candidateIds = new Set<string>();

    for (const item of rawList) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (UUID_REGEX.test(trimmed)) {
        candidateIds.add(trimmed);
      } else {
        const resolved = await resolveRelationFilterCandidateIds(
          fieldMeta?.relationTargetFormId,
          trimmed,
          "exact"
        );
        for (const id of resolved) {
          candidateIds.add(id);
        }
      }
    }

    if (candidateIds.size === 0) {
      return sql`FALSE`;
    }

    const predicates = Array.from(candidateIds).map((id) =>
      buildJsonbCandidateMatchSql(fieldId, id)
    );
    return predicates.length === 1 ? predicates[0]! : (or(...predicates) ?? null);
  }

  // 6. 텍스트(text, textarea) 및 폴백 조건 처리
  const rawStr = String(condition.value ?? "").trim();
  if (!rawStr) return null;

  if (op === "contains") {
    return sql`COALESCE(${formSubmissions.data}->>${fieldId}, '') ILIKE ${`%${rawStr}%`}`;
  }
  if (op === "neq") {
    return sql`${formSubmissions.data}->>${fieldId} IS DISTINCT FROM ${rawStr}`;
  }
  if (op === "in" || op === "hasAny") {
    const values = condition.values ?? [rawStr];
    const predicates = values.map((val) => buildJsonbCandidateMatchSql(fieldId, val));
    return predicates.length === 1 ? predicates[0]! : (or(...predicates) ?? null);
  }
  if (op === "notIn") {
    const values = condition.values ?? [rawStr];
    const predicates = values.map((val) => buildJsonbCandidateMatchSql(fieldId, val));
    const anyMatch = predicates.length === 1 ? predicates[0]! : or(...predicates);
    if (!anyMatch) return null;
    return sql`(
      ${formSubmissions.data}->${fieldId} IS NULL
      OR jsonb_typeof(${formSubmissions.data}->${fieldId}) = 'null'
      OR NOT (${anyMatch})
    )`;
  }

  return buildJsonbCandidateMatchSql(fieldId, rawStr);
}

/**
 * 동일 필드 내 동등/포함 계열(`eq`, `in`, `hasAny`, `contains`) 연산자 여부를 판별합니다.
 * 동일 fieldId로 복수 조건이 전달될 때 이 그룹은 `OR` 결합하고,
 * 범위/부정/기타 연산자는 `AND` 결합합니다.
 */
function isOrGroupableOperator(op: NormalizedFieldFilterCondition["op"]): boolean {
  return op === "eq" || op === "in" || op === "hasAny" || op === "contains";
}

/**
 * 공용 필터 조건 목록을 PostgreSQL Drizzle WHERE 조건 배열로 변환합니다.
 *
 * - 스키마가 주어지면 `validateFiltersAgainstFields`로 필드 존재 여부 및 허용 연산자를 먼저 검증합니다.
 * - 서로 다른 필드 간에는 `AND`, 동일 필드 내 동등/포함 조건들은 `OR`, 범위·부정 조건은 `AND`로 결합합니다.
 */
export async function buildFieldFilterSqlConditions(
  options: BuildFieldFilterSqlOptions
): Promise<{ conditions: SQL[]; error: null } | { conditions: null; error: string }> {
  const {
    filters,
    schemaDefinition,
    timezone = "Asia/Seoul",
    allowSystemFields = true,
    fallbackWithoutSchema = false,
  } = options;

  if (!filters || filters.length === 0) {
    return { conditions: [], error: null };
  }

  const resolvedTimezone = isValidTimezone(timezone) ? timezone : "Asia/Seoul";
  const fieldMetaMap = resolveFieldOptionLabelMap(schemaDefinition);

  let normalizedList: NormalizedFieldFilterCondition[];
  if (schemaDefinition || !fallbackWithoutSchema) {
    const descriptors = extractFilterableFields(schemaDefinition);
    const validation = validateFiltersAgainstFields(filters, descriptors, {
      allowSystemFields,
    });
    if (validation.error !== null) {
      return { conditions: null, error: validation.error };
    }
    normalizedList = validation.data;
  } else {
    normalizedList = filters.map((item) => normalizeFieldFilterCondition(item));
  }

  // 필드별로 그룹화하여 동일 필드 내 복수 eq/in/hasAny/contains는 OR 결합
  const grouped = new Map<string, NormalizedFieldFilterCondition[]>();
  for (const cond of normalizedList) {
    const bucket = grouped.get(cond.fieldId) ?? [];
    bucket.push(cond);
    grouped.set(cond.fieldId, bucket);
  }

  const conditions: SQL[] = [];

  for (const [fieldId, fieldConditions] of grouped.entries()) {
    const orSqlList: SQL[] = [];
    const andSqlList: SQL[] = [];
    const fieldMeta = fieldMetaMap.get(fieldId);

    for (const cond of fieldConditions) {
      const expr = isSystemFieldId(fieldId)
        ? buildSystemFieldConditionSql(cond, resolvedTimezone)
        : await buildDomainFieldConditionSql(cond, fieldMeta);

      if (!expr) continue;

      if (isOrGroupableOperator(cond.op)) {
        orSqlList.push(expr);
      } else {
        andSqlList.push(expr);
      }
    }

    if (orSqlList.length === 1) {
      conditions.push(orSqlList[0]!);
    } else if (orSqlList.length > 1) {
      const combinedOr = or(...orSqlList);
      if (combinedOr) {
        conditions.push(combinedOr);
      }
    }

    for (const andExpr of andSqlList) {
      conditions.push(andExpr);
    }
  }

  return { conditions, error: null };
}
