import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/db/server";
import { forms } from "@/shared/tables";
import { formSubmissions } from "../schema/form-submission.schema";
import type {
  AnalyticsAggregationQuery,
  AnalyticsMetric,
  AnalyticsTimeBucket,
  QuerySubmissionsForAnalysisInput,
} from "../schema/analytics-query.schema";
import {
  formatFieldDisplayKey,
  resolveFieldOptionLabelMap,
  roundFloatingPoint,
} from "../lib/analytics-calculator";

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
  timezone: string;
  totalCount: number;
  summaryValue: number;
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
  totalReturned: number;
  records: AnalysisSubmissionRecord[];
}

/**
 * 표준 Result 반환 타입
 */
export type AnalyticsResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * IANA 시간대 문자열 유효성을 검증합니다.
 */
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * PostgreSQL DATE_TRUNC + AT TIME ZONE 기반의 시계열 버킷 포맷 SQL 표현식을 생성합니다.
 */
function buildTimeBucketSql(timeBucket: AnalyticsTimeBucket, timezone: string) {
  switch (timeBucket) {
    case "day":
      return sql<string>`TO_CHAR(DATE_TRUNC('day', ${formSubmissions.createdAt} AT TIME ZONE ${timezone}), 'YYYY-MM-DD')`;
    case "week":
      return sql<string>`TO_CHAR(DATE_TRUNC('week', ${formSubmissions.createdAt} AT TIME ZONE ${timezone}), 'YYYY-MM-DD')`;
    case "month":
      return sql<string>`TO_CHAR(DATE_TRUNC('month', ${formSubmissions.createdAt} AT TIME ZONE ${timezone}), 'YYYY-MM')`;
    case "quarter":
      return sql<string>`TO_CHAR(DATE_TRUNC('quarter', ${formSubmissions.createdAt} AT TIME ZONE ${timezone}), 'YYYY-"Q"Q')`;
  }
}

/**
 * JSONB 문자열 값을 안전하게 숫자(double precision)로 변환하는 SQL 표현식을 생성합니다.
 * 빈 문자열, 비수치 텍스트, 콤마 포함 숫자를 안전하게 정제합니다.
 */
function buildSafeNumericSql(targetFieldId: string) {
  const cleanedText = sql`NULLIF(REGEXP_REPLACE(TRIM(COALESCE(${formSubmissions.data}->>${targetFieldId}, '')), ',', '', 'g'), '')`;
  return sql`CASE WHEN ${cleanedText} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${cleanedText})::double precision ELSE NULL END`;
}

/**
 * 메트릭(count | sum | avg | min | max)에 대응하는 PostgreSQL 집계 SQL 표현식을 생성합니다.
 */
function buildMetricAggregateSql(metric: AnalyticsMetric, targetFieldId?: string) {
  if (metric === "count" || !targetFieldId) {
    return sql<number>`COUNT(*)::double precision`;
  }

  const numericExpr = buildSafeNumericSql(targetFieldId);
  switch (metric) {
    case "sum":
      return sql<number>`COALESCE(SUM(${numericExpr}), 0)::double precision`;
    case "avg":
      return sql<number>`AVG(${numericExpr})::double precision`;
    case "min":
      return sql<number>`MIN(${numericExpr})::double precision`;
    case "max":
      return sql<number>`MAX(${numericExpr})::double precision`;
  }
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
 * 특정 폼에 제출된 응답 데이터를 PostgreSQL 중앙 시계 및 JSONB 안전 캐스팅으로 결정론적 집계합니다.
 *
 * @param query 집계 요청 파라미터 (formId, metric, targetFieldId, groupByFieldId, timeBucket, timezone, limit)
 * @returns Result 패턴 기반 집계 결과 또는 검증 오류
 */
export async function aggregateFormSubmissions(
  query: AnalyticsAggregationQuery
): Promise<AnalyticsResult<AnalyticsAggregationResult>> {
  const { formId, metric, targetFieldId, groupByFieldId, timeBucket, timezone, limit } = query;

  // 1. 대상 폼 존재 확인
  const [targetForm] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  if (!targetForm) {
    return { data: null, error: `대상 폼('${formId}')을 찾을 수 없습니다.` };
  }

  // 2. 시간대 유효성 확인
  if (!isValidTimezone(timezone)) {
    return { data: null, error: `유효하지 않은 시간대(timezone)입니다: '${timezone}'` };
  }

  // 3. 스키마 필드 메타 검증
  const fieldMetaMap = resolveFieldOptionLabelMap(targetForm.schemaDefinition);
  const targetMeta = targetFieldId ? fieldMetaMap.get(targetFieldId) : undefined;
  const groupMeta = groupByFieldId ? fieldMetaMap.get(groupByFieldId) : undefined;

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

  const metricSql = buildMetricAggregateSql(metric, targetFieldId);
  const countSql = sql<number>`COUNT(*)::integer`;
  const activeCondition = and(
    eq(formSubmissions.formId, formId),
    isNull(formSubmissions.deletedAt)
  );

  // 4-A. 시계열 + 그룹 교차 집계
  if (timeBucket && groupByFieldId) {
    const timeSql = buildTimeBucketSql(timeBucket, timezone);
    const groupSql = sql<string | null>`(${formSubmissions.data}->${groupByFieldId})::text`;

    const rows = await db
      .select({
        timeKey: timeSql,
        groupKey: groupSql,
        metricValue: metricSql,
        totalCount: countSql,
      })
      .from(formSubmissions)
      .where(activeCondition)
      .groupBy(timeSql, groupSql)
      .orderBy(asc(timeSql), desc(metricSql))
      .limit(limit);

    const points: AnalyticsPoint[] = rows.map((row) => {
      const parsedGroup = parseJsonTextValue(row.groupKey);
      const displayGroup = formatFieldDisplayKey(parsedGroup, groupMeta?.optionsMap);
      const value = roundFloatingPoint(Number(row.metricValue ?? 0));
      const count = Number(row.totalCount ?? 0);
      return {
        key: `${row.timeKey} · ${displayGroup}`,
        timeKey: row.timeKey,
        groupKey: displayGroup,
        value,
        count,
      };
    });

    const totalCount = points.reduce((sum, p) => sum + p.count, 0);
    const summaryValue = roundFloatingPoint(
      metric === "avg" && totalCount > 0
        ? points.reduce((sum, p) => sum + p.value * p.count, 0) / totalCount
        : points.reduce((sum, p) => sum + p.value, 0)
    );

    return {
      data: {
        formId,
        formTitle: targetForm.title,
        metric,
        targetFieldLabel: targetMeta?.label,
        groupByFieldLabel: groupMeta?.label,
        timeBucket,
        timezone,
        totalCount,
        summaryValue,
        points,
      },
      error: null,
    };
  }

  // 4-B. 시계열 버킷 단일 집계
  if (timeBucket) {
    const timeSql = buildTimeBucketSql(timeBucket, timezone);
    const rows = await db
      .select({
        timeKey: timeSql,
        metricValue: metricSql,
        totalCount: countSql,
      })
      .from(formSubmissions)
      .where(activeCondition)
      .groupBy(timeSql)
      .orderBy(asc(timeSql))
      .limit(limit);

    const points: AnalyticsPoint[] = rows.map((row) => ({
      key: row.timeKey,
      timeKey: row.timeKey,
      value: roundFloatingPoint(Number(row.metricValue ?? 0)),
      count: Number(row.totalCount ?? 0),
    }));

    const totalCount = points.reduce((sum, p) => sum + p.count, 0);
    const summaryValue = roundFloatingPoint(
      metric === "avg" && totalCount > 0
        ? points.reduce((sum, p) => sum + p.value * p.count, 0) / totalCount
        : metric === "min" && points.length > 0
          ? Math.min(...points.map((p) => p.value))
          : metric === "max" && points.length > 0
            ? Math.max(...points.map((p) => p.value))
            : points.reduce((sum, p) => sum + p.value, 0)
    );

    return {
      data: {
        formId,
        formTitle: targetForm.title,
        metric,
        targetFieldLabel: targetMeta?.label,
        timeBucket,
        timezone,
        totalCount,
        summaryValue,
        points,
      },
      error: null,
    };
  }

  // 4-C. 범주/선택형 필드 그룹별 집계
  if (groupByFieldId) {
    const groupSql = sql<string | null>`(${formSubmissions.data}->${groupByFieldId})::text`;
    const rows = await db
      .select({
        groupKey: groupSql,
        metricValue: metricSql,
        totalCount: countSql,
      })
      .from(formSubmissions)
      .where(activeCondition)
      .groupBy(groupSql)
      .orderBy(desc(metricSql))
      .limit(limit);

    const points: AnalyticsPoint[] = rows.map((row) => {
      const parsedGroup = parseJsonTextValue(row.groupKey);
      const displayGroup = formatFieldDisplayKey(parsedGroup, groupMeta?.optionsMap);
      return {
        key: displayGroup,
        groupKey: displayGroup,
        value: roundFloatingPoint(Number(row.metricValue ?? 0)),
        count: Number(row.totalCount ?? 0),
      };
    });

    const totalCount = points.reduce((sum, p) => sum + p.count, 0);
    const summaryValue = roundFloatingPoint(
      metric === "avg" && totalCount > 0
        ? points.reduce((sum, p) => sum + p.value * p.count, 0) / totalCount
        : metric === "min" && points.length > 0
          ? Math.min(...points.map((p) => p.value))
          : metric === "max" && points.length > 0
            ? Math.max(...points.map((p) => p.value))
            : points.reduce((sum, p) => sum + p.value, 0)
    );

    return {
      data: {
        formId,
        formTitle: targetForm.title,
        metric,
        targetFieldLabel: targetMeta?.label,
        groupByFieldLabel: groupMeta?.label,
        timezone,
        totalCount,
        summaryValue,
        points,
      },
      error: null,
    };
  }

  // 4-D. 폼 전체 단일 요약 집계
  const rows = await db
    .select({
      metricValue: metricSql,
      totalCount: countSql,
    })
    .from(formSubmissions)
    .where(activeCondition);

  const first = rows[0];
  const totalCount = Number(first?.totalCount ?? 0);
  const summaryValue = roundFloatingPoint(Number(first?.metricValue ?? 0));

  return {
    data: {
      formId,
      formTitle: targetForm.title,
      metric,
      targetFieldLabel: targetMeta?.label,
      timezone,
      totalCount,
      summaryValue,
      points: [{ key: "전체", value: summaryValue, count: totalCount }],
    },
    error: null,
  };
}

/**
 * 분석 뷰의 테이블/글 블록에 근거 레코드 목록을 인용하기 위해 폼의 최신/과거 응답 N건을 조회하고,
 * 필드 ID와 선택형 옵션 코드를 사람 친화적 라벨로 매핑하여 반환합니다.
 */
export async function queryFormSubmissionsForAnalysis(
  input: QuerySubmissionsForAnalysisInput
): Promise<AnalyticsResult<AnalysisRecordsResult>> {
  const { formId, sortOrder, limit } = input;

  const [targetForm] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), isNull(forms.deletedAt)))
    .limit(1);

  if (!targetForm) {
    return { data: null, error: `대상 폼('${formId}')을 찾을 수 없습니다.` };
  }

  const fieldMetaMap = resolveFieldOptionLabelMap(targetForm.schemaDefinition);
  const orderExpr =
    sortOrder === "asc" ? asc(formSubmissions.createdAt) : desc(formSubmissions.createdAt);

  const rows = await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.formId, formId), isNull(formSubmissions.deletedAt)))
    .orderBy(orderExpr)
    .limit(limit);

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
      totalReturned: records.length,
      records,
    },
    error: null,
  };
}
