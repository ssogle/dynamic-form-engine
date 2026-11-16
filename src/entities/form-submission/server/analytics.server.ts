import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { db } from "@/shared/db/server";
import { forms } from "@/shared/tables";
import { formSubmissions } from "../schema/form-submission.schema";
import type {
  AnalyticsAggregationQuery,
  AnalyticsDateAxis,
  AnalyticsMetric,
  AnalyticsTimeBucket,
  QuerySubmissionsForAnalysisInput,
} from "../schema/analytics-query.schema";
import {
  buildContinuousTimeBucketKeys,
  formatFieldDisplayKey,
  resolveFieldOptionLabelMap,
  roundFloatingPoint,
} from "../lib/analytics-calculator";
import { isValidTimezone } from "../schema/date-range.schema";
import {
  buildDateRangeConditions,
  buildTimeBucketSql,
  buildValidFieldDateSql,
} from "./date-filter-sql.server";

/**
 * 집계 결과 단일 데이터 포인트
 */
export interface AnalyticsPoint {
  key: string;
  value: number;
  count: number;
  timeKey?: string | undefined;
  groupKey?: string | undefined;
}

/**
 * 폼 통계 집계 결과 DTO
 */
export interface AnalyticsAggregationResult {
  formId: string;
  formTitle: string;
  metric: AnalyticsMetric;
  targetFieldLabel?: string | undefined;
  groupByFieldLabel?: string | undefined;
  timeBucket?: AnalyticsTimeBucket | undefined;
  dateAxis: AnalyticsDateAxis;
  dateFieldId?: string | undefined;
  dateFieldLabel?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  timezone: string;
  totalCount: number;
  summaryValue: number;
  isTruncated: boolean;
  points: AnalyticsPoint[];
}

/**
 * 분석용 원천 레코드 요약 항목
 */
export interface AnalysisSubmissionRecord {
  id: string;
  createdAt: Date;
  values: Record<string, unknown>;
}

/**
 * 분석용 레코드 조회 결과 DTO
 */
export interface AnalysisRecordsResult {
  formId: string;
  formTitle: string;
  dateAxis: AnalyticsDateAxis;
  dateFieldId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  totalReturned: number;
  records: AnalysisSubmissionRecord[];
}

/**
 * 표준 Result 반환 타입
 */
export type AnalyticsResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * JSONB 문자열 값을 안전하게 숫자(double precision)로 변환하는 SQL 표현식을 생성합니다.
 * 빈 문자열, 비수치 텍스트, 콤마 포함 숫자를 안전하게 정제합니다.
 */
function buildSafeNumericSql(targetFieldId: string): SQL<number | null> {
  const cleanedText = sql`NULLIF(REGEXP_REPLACE(TRIM(COALESCE(${formSubmissions.data}->>${targetFieldId}, '')), ',', '', 'g'), '')`;
  return sql<
    number | null
  >`CASE WHEN ${cleanedText} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${cleanedText})::double precision ELSE NULL END`;
}

/**
 * 서브쿼리 투영 단계에서 집계 대상 수치 인자를 추출합니다.
 * 바인딩 파라미터가 포함된 JSONB 표현식을 서브쿼리로 먼저 평가해 두어야
 * 외부 GROUP BY / ORDER BY 에서 PostgreSQL 42803 오류가 발생하지 않습니다.
 */
function buildSubqueryMetricArgSql(
  metric: AnalyticsMetric,
  targetFieldId?: string
): SQL<number | null> {
  if (metric === "count" || !targetFieldId) {
    return sql<number | null>`1::double precision`;
  }
  return buildSafeNumericSql(targetFieldId);
}

/**
 * 서브쿼리 컬럼(`agg_source.metric_value_arg`)에 대해 외부 SELECT/ORDER BY 집계 SQL을 생성합니다.
 */
function buildOuterMetricAggregateSql(
  metric: AnalyticsMetric,
  metricValueCol: SQLWrapper
): SQL<number> {
  switch (metric) {
    case "count":
      return sql<number>`COUNT(*)::double precision`;
    case "sum":
      return sql<number>`COALESCE(SUM(${metricValueCol}), 0)::double precision`;
    case "avg":
      return sql<number>`AVG(${metricValueCol})::double precision`;
    case "min":
      return sql<number>`MIN(${metricValueCol})::double precision`;
    case "max":
      return sql<number>`MAX(${metricValueCol})::double precision`;
  }
}

/**
 * 메트릭(count | sum | avg | min | max)에 대응하는 단일 요약 PostgreSQL 집계 SQL 표현식을 생성합니다.
 */
function buildMetricAggregateSql(metric: AnalyticsMetric, targetFieldId?: string) {
  if (metric === "count" || !targetFieldId) {
    return sql<number>`COUNT(*)::double precision`;
  }

  const numericExpr = buildSafeNumericSql(targetFieldId);
  return buildOuterMetricAggregateSql(metric, numericExpr);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectUuidStrings(rawValue: unknown, targetSet: Set<string>): void {
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (UUID_REGEX.test(trimmed)) {
      targetSet.add(trimmed);
    }
    return;
  }
  if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (UUID_REGEX.test(trimmed)) {
          targetSet.add(trimmed);
        }
      }
    }
  }
}

/**
 * 관계형(`relation`) 필드 그룹화 또는 샘플 조회 결과에 포함된 타깃 서브미션 UUID 목록을
 * 참조 대상 폼의 대표 식별 필드(primaryFieldId) 표시명으로 일괄 치환하기 위한 매핑 테이블을 생성합니다.
 */
async function resolveRelationDisplayMap(
  targetFormId: string | undefined,
  rawParsedValues: unknown[]
): Promise<Map<string, string> | undefined> {
  if (!targetFormId) {
    return undefined;
  }

  const uuidSet = new Set<string>();
  for (const val of rawParsedValues) {
    collectUuidStrings(val, uuidSet);
  }
  if (uuidSet.size === 0) {
    return undefined;
  }

  const [targetForm] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, targetFormId), isNull(forms.deletedAt)))
    .limit(1);

  if (!targetForm) {
    return undefined;
  }

  const fields = Array.isArray(targetForm.schemaDefinition?.fields)
    ? targetForm.schemaDefinition.fields
    : [];
  const primaryFieldId =
    targetForm.schemaDefinition?.primaryFieldId ||
    fields.find((f) => !f.deletedAt && typeof f.id === "string" && f.type === "text")?.id;

  if (typeof primaryFieldId !== "string" || !primaryFieldId) {
    return undefined;
  }

  const uuidList = Array.from(uuidSet);
  const targetRows = await db
    .select({
      id: formSubmissions.id,
      data: formSubmissions.data,
    })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formId, targetFormId),
        inArray(formSubmissions.id, uuidList),
        isNull(formSubmissions.deletedAt)
      )
    )
    .limit(uuidList.length);

  const displayMap = new Map<string, string>();
  for (const row of targetRows) {
    const recordData = (row.data ?? {}) as Record<string, unknown>;
    const displayValue = recordData[primaryFieldId];
    if (displayValue !== null && displayValue !== undefined && String(displayValue).trim()) {
      displayMap.set(row.id, String(displayValue).trim());
    }
  }

  return displayMap;
}

/**
 * 관계형(`relation`) 필드 필터 값이 레코드 UUID 대신 대상 폼 대표명(예: "프로젝트 A")으로 전달된 경우,
 * 대상 폼의 대표 필드 일치 레코드 UUID 목록을 조회해 정밀한 필터링 조건으로 정규화합니다.
 */
async function resolveRelationFilterCandidateIds(
  targetFormId: string | undefined,
  displayText: string
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

  const normalized = displayText.trim();
  const matchedRows = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formId, targetFormId),
        isNull(formSubmissions.deletedAt),
        sql`TRIM(COALESCE(${formSubmissions.data}->>${primaryFieldId}, '')) = ${normalized}`
      )
    )
    .limit(50);

  return matchedRows.map((r) => r.id);
}

/**
 * 통계 집계 및 샘플 조회용 필드 값 일치 필터(`filters`)를 PostgreSQL WHERE 조건으로 변환합니다.
 * - 동일 fieldId에 복수 필터가 전달되면 OR 결합, 서로 다른 fieldId 간에는 AND 결합합니다.
 * - 단일 스칼라(`data->>fieldId`)와 다중 배열(`data->fieldId @> [...]`) 저장 형식을 모두 안전하게 매칭합니다.
 * - select/radio 옵션 라벨 또는 relation 대표명이 전달되어도 실제 저장 코드/UUID로 자동 정규화합니다.
 */
async function buildFieldFilterConditions(
  filters: AnalyticsAggregationQuery["filters"],
  fieldMetaMap: Map<
    string,
    ReturnType<typeof resolveFieldOptionLabelMap> extends Map<string, infer V> ? V : never
  >
): Promise<{ conditions: SQL[]; error: null } | { conditions: null; error: string }> {
  if (!filters || filters.length === 0) {
    return { conditions: [], error: null };
  }

  const groupedByField = new Map<string, string[]>();
  for (const filter of filters) {
    if (!fieldMetaMap.has(filter.fieldId)) {
      return {
        conditions: null,
        error: `필터 기준 필드('${filter.fieldId}')가 폼 활성 스키마에 존재하지 않습니다.`,
      };
    }
    const bucket = groupedByField.get(filter.fieldId) ?? [];
    bucket.push(filter.value.trim());
    groupedByField.set(filter.fieldId, bucket);
  }

  const conditions: SQL[] = [];

  for (const [fieldId, rawValues] of groupedByField.entries()) {
    const fieldMeta = fieldMetaMap.get(fieldId)!;
    const candidateValues = new Set<string>();

    for (const rawValue of rawValues) {
      if (
        fieldMeta.type === "select" ||
        fieldMeta.type === "radio" ||
        fieldMeta.type === "checkbox"
      ) {
        if (fieldMeta.optionsMap.has(rawValue)) {
          candidateValues.add(rawValue);
        } else {
          // 옵션 코드가 아니라 표시 라벨(예: "교통비")이 들어온 경우 코드값(TRANSPORT)으로 치환
          let matchedCode: string | undefined;
          for (const [code, label] of fieldMeta.optionsMap.entries()) {
            if (label === rawValue) {
              matchedCode = code;
              break;
            }
          }
          candidateValues.add(matchedCode ?? rawValue);
        }
        continue;
      }

      if (fieldMeta.type === "relation") {
        if (UUID_REGEX.test(rawValue)) {
          candidateValues.add(rawValue);
        } else {
          const resolvedIds = await resolveRelationFilterCandidateIds(
            fieldMeta.relationTargetFormId,
            rawValue
          );
          for (const id of resolvedIds) {
            candidateValues.add(id);
          }
        }
        continue;
      }

      candidateValues.add(rawValue);
    }

    if (candidateValues.size === 0) {
      // relation 라벨에 매칭되는 대상 레코드가 없으면 의도대로 0건이 반환되도록 FALSE 조건 추가
      conditions.push(sql`FALSE`);
      continue;
    }

    const perValuePredicates = Array.from(candidateValues).map(
      (candidate) => sql`(
        ${formSubmissions.data}->>${fieldId} = ${candidate}
        OR (
          jsonb_typeof(${formSubmissions.data}->${fieldId}) = 'array'
          AND ${formSubmissions.data}->${fieldId} @> ${JSON.stringify([candidate])}::jsonb
        )
      )`
    );

    const fieldCondition =
      perValuePredicates.length === 1 ? perValuePredicates[0]! : or(...perValuePredicates);
    if (fieldCondition) {
      conditions.push(fieldCondition);
    }
  }

  return { conditions, error: null };
}

/**
 * JSON::text 직렬화 문자열을 원래 JS 값(배열, 문자열, 숫자, 불리언 등)으로 복원합니다.
 */
function parseJsonTextValue(rawJsonText: unknown): unknown {
  if (rawJsonText === null || rawJsonText === undefined) {
    return null;
  }
  if (typeof rawJsonText !== "string") {
    return rawJsonText;
  }
  try {
    return JSON.parse(rawJsonText);
  } catch {
    return rawJsonText;
  }
}

/**
 * LIMIT 절단 이전의 전체 필터 집합에서 정확한 총 건수(totalCount)와 요약값(summaryValue)을 조회합니다.
 * 1만~10만 건 환경에서 그룹/버킷 LIMIT으로 인해 전체 지표가 축소·왜곡되는 문제를 방지합니다.
 */
async function fetchOverallSummary(
  metricSql: SQL<number>,
  countSql: SQL<number>,
  whereCondition: SQL | undefined
): Promise<{ totalCount: number; summaryValue: number }> {
  const rows = await db
    .select({
      metricValue: metricSql,
      totalCount: countSql,
    })
    .from(formSubmissions)
    .where(whereCondition)
    .limit(1);

  const first = rows[0];
  return {
    totalCount: Number(first?.totalCount ?? 0),
    summaryValue: roundFloatingPoint(Number(first?.metricValue ?? 0)),
  };
}

/**
 * 특정 폼에 제출된 응답 데이터를 PostgreSQL 중앙 시계 및 JSONB 안전 캐스팅으로 결정론적 집계합니다.
 *
 * @param query 집계 요청 파라미터 (formId, metric, targetFieldId, groupByFieldId, timeBucket, dateFieldId, startDate, endDate, timezone, limit)
 * @returns Result 패턴 기반 집계 결과 또는 검증 오류
 */
export async function aggregateFormSubmissions(
  query: AnalyticsAggregationQuery
): Promise<AnalyticsResult<AnalyticsAggregationResult>> {
  const {
    formId,
    metric,
    targetFieldId,
    groupByFieldId,
    timeBucket,
    dateFieldId,
    startDate,
    endDate,
    timezone,
    filters,
    limit,
  } = query;

  // 1. 대상 폼 존재 확인
  const [targetForm] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  if (!targetForm) {
    return { data: null, error: `대상 폼('${formId}')을 찾을 수 없습니다.` };
  }

  // 2. 시간대 및 기간 유효성 확인
  if (!isValidTimezone(timezone)) {
    return { data: null, error: `유효하지 않은 시간대(timezone)입니다: '${timezone}'` };
  }

  if (startDate && endDate && startDate > endDate) {
    return {
      data: null,
      error: "종료일(endDate)은 시작일(startDate)보다 같거나 이후여야 합니다.",
    };
  }

  // 3. 스키마 필드 메타 검증
  const fieldMetaMap = resolveFieldOptionLabelMap(targetForm.schemaDefinition);
  const targetMeta = targetFieldId ? fieldMetaMap.get(targetFieldId) : undefined;
  const groupMeta = groupByFieldId ? fieldMetaMap.get(groupByFieldId) : undefined;
  const dateMeta = dateFieldId ? fieldMetaMap.get(dateFieldId) : undefined;

  if (metric !== "count") {
    if (!targetFieldId || !targetMeta) {
      return {
        data: null,
        error: `집계 대상 필드('${targetFieldId ?? ""}')가 폼 활성 스키마에 존재하지 않습니다.`,
      };
    }
    if (targetMeta.type !== "number") {
      return {
        data: null,
        error: `'${targetMeta.label}' 필드는 숫자형(number)이 아니므로 ${metric} 집계를 수행할 수 없습니다.`,
      };
    }
  }

  if (groupByFieldId && !groupMeta) {
    return {
      data: null,
      error: `그룹 기준 필드('${groupByFieldId}')가 폼 활성 스키마에 존재하지 않습니다.`,
    };
  }

  if (dateFieldId) {
    if (!dateMeta) {
      return {
        data: null,
        error: `날짜 기준 필드('${dateFieldId}')가 폼 활성 스키마에 존재하지 않습니다.`,
      };
    }
    if (dateMeta.type !== "date") {
      return {
        data: null,
        error: `'${dateMeta.label}' 필드는 날짜형(date)이 아니므로 날짜 기준 축으로 사용할 수 없습니다.`,
      };
    }
  }

  const fieldFilterResult = await buildFieldFilterConditions(filters, fieldMetaMap);
  if (fieldFilterResult.error !== null) {
    return { data: null, error: fieldFilterResult.error };
  }

  const dateAxis: AnalyticsDateAxis = dateFieldId ? "field" : "createdAt";
  const metricSql = buildMetricAggregateSql(metric, targetFieldId);
  const countSql = sql<number>`COUNT(*)::integer`;
  const whereCondition = and(
    eq(formSubmissions.formId, formId),
    isNull(formSubmissions.deletedAt),
    ...buildDateRangeConditions({
      dateFieldId,
      startDate,
      endDate,
      timezone,
      // dateFieldId를 기준 축으로 지정한 경우 비어 있거나 잘못된 날짜 행은 createdAt 폴백 없이 제외
      requireValidDateField: Boolean(dateFieldId),
    }),
    ...fieldFilterResult.conditions
  );

  const metricArgSql = buildSubqueryMetricArgSql(metric, targetFieldId);

  // 4-A. 시계열 + 그룹 교차 집계 (서브쿼리로 파라미터 식 고정 -> 최신 버킷 우선 슬라이싱 -> 시간 오름차순 재정렬)
  if (timeBucket && groupByFieldId) {
    const timeSql = buildTimeBucketSql(timeBucket, timezone, dateFieldId);
    const groupSql = sql<string | null>`(${formSubmissions.data}->${groupByFieldId})::text`;
    const aggSource = db
      .select({
        timeKey: timeSql.as("time_key"),
        groupKey: groupSql.as("group_key"),
        metricValueArg: metricArgSql.as("metric_value_arg"),
      })
      .from(formSubmissions)
      .where(whereCondition)
      .as("agg_source");
    const outerMetricSql = buildOuterMetricAggregateSql(metric, aggSource.metricValueArg);

    const [{ totalCount, summaryValue }, rawRows] = await Promise.all([
      fetchOverallSummary(metricSql, countSql, whereCondition),
      db
        .select({
          timeKey: aggSource.timeKey,
          groupKey: aggSource.groupKey,
          metricValue: outerMetricSql,
          totalCount: countSql,
        })
        .from(aggSource)
        .groupBy(aggSource.timeKey, aggSource.groupKey)
        .orderBy(desc(aggSource.timeKey), desc(outerMetricSql))
        .limit(limit + 1),
    ]);

    const isTruncated = rawRows.length > limit;
    const rows = rawRows.slice(0, limit);
    const parsedGroups = rows.map((row) => parseJsonTextValue(row.groupKey));
    const relationDisplayMap =
      groupMeta?.type === "relation"
        ? await resolveRelationDisplayMap(groupMeta.relationTargetFormId, parsedGroups)
        : undefined;
    const displayOptionsMap = relationDisplayMap ?? groupMeta?.optionsMap;

    const points: AnalyticsPoint[] = rows
      .map((row, index) => {
        const displayGroup = formatFieldDisplayKey(parsedGroups[index], displayOptionsMap);
        const value = roundFloatingPoint(Number(row.metricValue ?? 0));
        const count = Number(row.totalCount ?? 0);
        return {
          key: `${row.timeKey} · ${displayGroup}`,
          timeKey: row.timeKey,
          groupKey: displayGroup,
          value,
          count,
        };
      })
      .sort((a, b) => (a.timeKey ?? "").localeCompare(b.timeKey ?? "") || b.value - a.value);

    return {
      data: {
        formId,
        formTitle: targetForm.title,
        metric,
        targetFieldLabel: targetMeta?.label,
        groupByFieldLabel: groupMeta?.label,
        timeBucket,
        dateAxis,
        dateFieldId,
        dateFieldLabel: dateMeta?.label,
        startDate,
        endDate,
        timezone,
        totalCount,
        summaryValue,
        isTruncated,
        points,
      },
      error: null,
    };
  }

  // 4-B. 시계열 버킷 단일 집계 (서브쿼리로 파라미터 식 고정 -> 최신 버킷부터 limit 슬라이싱 후 시간 오름차순 반환)
  if (timeBucket) {
    const timeSql = buildTimeBucketSql(timeBucket, timezone, dateFieldId);
    const aggSource = db
      .select({
        timeKey: timeSql.as("time_key"),
        metricValueArg: metricArgSql.as("metric_value_arg"),
      })
      .from(formSubmissions)
      .where(whereCondition)
      .as("agg_source");
    const outerMetricSql = buildOuterMetricAggregateSql(metric, aggSource.metricValueArg);

    const [{ totalCount, summaryValue }, rawRows] = await Promise.all([
      fetchOverallSummary(metricSql, countSql, whereCondition),
      db
        .select({
          timeKey: aggSource.timeKey,
          metricValue: outerMetricSql,
          totalCount: countSql,
        })
        .from(aggSource)
        .groupBy(aggSource.timeKey)
        .orderBy(desc(aggSource.timeKey))
        .limit(limit + 1),
    ]);

    const rows = rawRows.slice(0, limit);
    const rawPointMap = new Map<string, { value: number; count: number }>();
    for (const row of rows) {
      rawPointMap.set(row.timeKey, {
        value: roundFloatingPoint(Number(row.metricValue ?? 0)),
        count: Number(row.totalCount ?? 0),
      });
    }

    let isTruncated = rawRows.length > limit;
    let points: AnalyticsPoint[];

    if (startDate && endDate) {
      const continuous = buildContinuousTimeBucketKeys(timeBucket, startDate, endDate, limit);
      isTruncated = isTruncated || continuous.isTruncated;
      points = continuous.keys.map((bucketKey) => {
        const matched = rawPointMap.get(bucketKey);
        return {
          key: bucketKey,
          timeKey: bucketKey,
          value: matched?.value ?? 0,
          count: matched?.count ?? 0,
        };
      });
    } else {
      points = rows
        .map((row) => ({
          key: row.timeKey,
          timeKey: row.timeKey,
          value: roundFloatingPoint(Number(row.metricValue ?? 0)),
          count: Number(row.totalCount ?? 0),
        }))
        .sort((a, b) => (a.timeKey ?? "").localeCompare(b.timeKey ?? ""));
    }

    return {
      data: {
        formId,
        formTitle: targetForm.title,
        metric,
        targetFieldLabel: targetMeta?.label,
        timeBucket,
        dateAxis,
        dateFieldId,
        dateFieldLabel: dateMeta?.label,
        startDate,
        endDate,
        timezone,
        totalCount,
        summaryValue,
        isTruncated,
        points,
      },
      error: null,
    };
  }

  // 4-C. 범주/선택형/관계형 필드 그룹별 집계 (서브쿼리로 파라미터 식 고정)
  if (groupByFieldId) {
    const groupSql = sql<string | null>`(${formSubmissions.data}->${groupByFieldId})::text`;
    const aggSource = db
      .select({
        groupKey: groupSql.as("group_key"),
        metricValueArg: metricArgSql.as("metric_value_arg"),
      })
      .from(formSubmissions)
      .where(whereCondition)
      .as("agg_source");
    const outerMetricSql = buildOuterMetricAggregateSql(metric, aggSource.metricValueArg);

    const [{ totalCount, summaryValue }, rawRows] = await Promise.all([
      fetchOverallSummary(metricSql, countSql, whereCondition),
      db
        .select({
          groupKey: aggSource.groupKey,
          metricValue: outerMetricSql,
          totalCount: countSql,
        })
        .from(aggSource)
        .groupBy(aggSource.groupKey)
        .orderBy(desc(outerMetricSql))
        .limit(limit + 1),
    ]);

    const isTruncated = rawRows.length > limit;
    const rows = rawRows.slice(0, limit);
    const parsedGroups = rows.map((row) => parseJsonTextValue(row.groupKey));
    const relationDisplayMap =
      groupMeta?.type === "relation"
        ? await resolveRelationDisplayMap(groupMeta.relationTargetFormId, parsedGroups)
        : undefined;
    const displayOptionsMap = relationDisplayMap ?? groupMeta?.optionsMap;

    const points: AnalyticsPoint[] = rows.map((row, index) => {
      const displayGroup = formatFieldDisplayKey(parsedGroups[index], displayOptionsMap);
      return {
        key: displayGroup,
        groupKey: displayGroup,
        value: roundFloatingPoint(Number(row.metricValue ?? 0)),
        count: Number(row.totalCount ?? 0),
      };
    });

    return {
      data: {
        formId,
        formTitle: targetForm.title,
        metric,
        targetFieldLabel: targetMeta?.label,
        groupByFieldLabel: groupMeta?.label,
        dateAxis,
        dateFieldId,
        dateFieldLabel: dateMeta?.label,
        startDate,
        endDate,
        timezone,
        totalCount,
        summaryValue,
        isTruncated,
        points,
      },
      error: null,
    };
  }

  // 4-D. 폼 전체 단일 요약 집계
  const { totalCount, summaryValue } = await fetchOverallSummary(
    metricSql,
    countSql,
    whereCondition
  );

  return {
    data: {
      formId,
      formTitle: targetForm.title,
      metric,
      targetFieldLabel: targetMeta?.label,
      dateAxis,
      dateFieldId,
      dateFieldLabel: dateMeta?.label,
      startDate,
      endDate,
      timezone,
      totalCount,
      summaryValue,
      isTruncated: false,
      points: [{ key: "전체", value: summaryValue, count: totalCount }],
    },
    error: null,
  };
}

/**
 * 분석 뷰의 테이블/글 블록에 근거 레코드 샘플을 인용하기 위해 폼의 최신/과거 응답 N건을 조회하고,
 * 필드 ID와 선택형 옵션 코드를 사람 친화적 라벨로 매핑하여 반환합니다.
 */
export async function queryFormSubmissionsForAnalysis(
  input: QuerySubmissionsForAnalysisInput
): Promise<AnalyticsResult<AnalysisRecordsResult>> {
  const {
    formId,
    dateFieldId,
    startDate,
    endDate,
    timezone = "Asia/Seoul",
    filters,
    sortOrder,
    limit,
  } = input;

  const [targetForm] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  if (!targetForm) {
    return { data: null, error: `대상 폼('${formId}')을 찾을 수 없습니다.` };
  }

  if (!isValidTimezone(timezone)) {
    return { data: null, error: `유효하지 않은 시간대(timezone)입니다: '${timezone}'` };
  }

  if (startDate && endDate && startDate > endDate) {
    return {
      data: null,
      error: "종료일(endDate)은 시작일(startDate)보다 같거나 이후여야 합니다.",
    };
  }

  const fieldMetaMap = resolveFieldOptionLabelMap(targetForm.schemaDefinition);
  if (dateFieldId) {
    const dateMeta = fieldMetaMap.get(dateFieldId);
    if (!dateMeta || dateMeta.type !== "date") {
      return {
        data: null,
        error: `날짜 기준 필드('${dateFieldId}')가 폼의 유효한 date 필드가 아닙니다.`,
      };
    }
  }

  const fieldFilterResult = await buildFieldFilterConditions(filters, fieldMetaMap);
  if (fieldFilterResult.error !== null) {
    return { data: null, error: fieldFilterResult.error };
  }

  const whereCondition = and(
    eq(formSubmissions.formId, formId),
    isNull(formSubmissions.deletedAt),
    ...buildDateRangeConditions({
      dateFieldId,
      startDate,
      endDate,
      timezone,
      requireValidDateField: Boolean(dateFieldId),
    }),
    ...fieldFilterResult.conditions
  );

  const primaryOrderExpr = dateFieldId
    ? sortOrder === "asc"
      ? asc(buildValidFieldDateSql(dateFieldId))
      : desc(buildValidFieldDateSql(dateFieldId))
    : sortOrder === "asc"
      ? asc(formSubmissions.createdAt)
      : desc(formSubmissions.createdAt);

  const secondaryOrderExpr =
    sortOrder === "asc" ? asc(formSubmissions.createdAt) : desc(formSubmissions.createdAt);

  const rows = await db
    .select()
    .from(formSubmissions)
    .where(whereCondition)
    .orderBy(primaryOrderExpr, secondaryOrderExpr)
    .limit(limit);

  const relationFieldMaps = new Map<string, Map<string, string>>();
  for (const [fieldId, fieldMeta] of fieldMetaMap.entries()) {
    if (fieldMeta.type === "relation" && fieldMeta.relationTargetFormId && rows.length > 0) {
      const rawValues = rows.map((r) => ((r.data ?? {}) as Record<string, unknown>)[fieldId]);
      const displayMap = await resolveRelationDisplayMap(fieldMeta.relationTargetFormId, rawValues);
      if (displayMap) {
        relationFieldMaps.set(fieldId, displayMap);
      }
    }
  }

  const records: AnalysisSubmissionRecord[] = rows.map((row) => {
    const rawData = (row.data ?? {}) as Record<string, unknown>;
    const mappedValues: Record<string, unknown> = {};

    for (const [fieldId, fieldMeta] of fieldMetaMap.entries()) {
      const rawVal = rawData[fieldId];
      if (rawVal === undefined) continue;

      if (
        fieldMeta.type === "select" ||
        fieldMeta.type === "radio" ||
        fieldMeta.type === "checkbox" ||
        fieldMeta.type === "switch"
      ) {
        mappedValues[fieldMeta.label] = formatFieldDisplayKey(rawVal, fieldMeta.optionsMap);
      } else if (fieldMeta.type === "relation") {
        mappedValues[fieldMeta.label] = formatFieldDisplayKey(
          rawVal,
          relationFieldMaps.get(fieldId)
        );
      } else {
        mappedValues[fieldMeta.label] = rawVal;
      }
    }

    return {
      id: row.id,
      createdAt: row.createdAt,
      values: mappedValues,
    };
  });

  return {
    data: {
      formId,
      formTitle: targetForm.title,
      dateAxis: dateFieldId ? "field" : "createdAt",
      dateFieldId,
      startDate,
      endDate,
      totalReturned: records.length,
      records,
    },
    error: null,
  };
}
