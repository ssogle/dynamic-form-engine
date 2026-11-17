import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { AnalyticsTimeBucket } from "../schema/analytics-query.schema";
import { formSubmissions } from "../schema/form-submission.schema";

/**
 * 날짜 범위 및 기준 축 SQL 조건 생성 파라미터
 */
export interface BuildDateFilterOptions {
  dateFieldId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  timezone?: string | undefined;
  /**
   * 기간 필터(startDate/endDate)가 없더라도 dateFieldId 기준 축 사용 시
   * 빈 값/잘못된 날짜 문자열 행을 제외해야 할 때 true로 설정합니다(예: 시계열 버킷 집계).
   */
  requireValidDateField?: boolean | undefined;
}

/**
 * JSONB 내 순수 달력 날짜(YYYY-MM-DD) 필드를 PostgreSQL 캐스팅 에러 없이
 * 안전하게 `date` 타입으로 파싱하는 SQL 표현식을 생성합니다.
 *
 * 중첩 CASE를 통해 정규식(`YYYY-MM-DD`)과 월별 일수/윤년 검증을 먼저 통과한 행만
 * `::date` 캐스팅을 실행하므로 `"2026-02-31"`이나 `""` 같은 비정상 데이터에서도 쿼리가 실패하지 않습니다.
 */
export function buildValidFieldDateSql(dateFieldId: string): SQL<string | null> {
  const cleaned = sql`TRIM(COALESCE(${formSubmissions.data}->>${dateFieldId}, ''))`;

  return sql<string | null>`(
    CASE
      WHEN ${cleaned} ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
        CASE
          WHEN SUBSTRING(${cleaned} FROM 6 FOR 2)::int IN (4, 6, 9, 11)
            AND SUBSTRING(${cleaned} FROM 9 FOR 2)::int > 30 THEN NULL
          WHEN SUBSTRING(${cleaned} FROM 6 FOR 2)::int = 2
            AND (
              SUBSTRING(${cleaned} FROM 9 FOR 2)::int > 29
              OR (
                SUBSTRING(${cleaned} FROM 9 FOR 2)::int = 29
                AND NOT (
                  (SUBSTRING(${cleaned} FROM 1 FOR 4)::int % 4 = 0 AND SUBSTRING(${cleaned} FROM 1 FOR 4)::int % 100 <> 0)
                  OR SUBSTRING(${cleaned} FROM 1 FOR 4)::int % 400 = 0
                )
              )
            ) THEN NULL
          ELSE (${cleaned})::date
        END
      ELSE NULL
    END
  )`;
}

/**
 * 날짜 기준 축(`dateFieldId` 우선, 미지정 시 `formSubmissions.createdAt` 폴백)에 따른
 * PostgreSQL WHERE 조건 목록을 생성합니다.
 *
 * - `dateFieldId` 지정 시: 타임존 오프셋 변환 없이 순수 달력 날짜로 비교하며, 무효/누락 행은 제외합니다.
 * - `dateFieldId` 생략 시: `timezone` 기준 일 경계(`>= start 00:00:00`, `< nextDay 00:00:00`)로 변환해
 *   `form_submissions.created_at` B-tree 인덱스를 활용할 수 있는 범위 조건을 생성합니다.
 */
export function buildDateRangeConditions(options: BuildDateFilterOptions): SQL[] {
  const {
    dateFieldId,
    startDate,
    endDate,
    timezone = "Asia/Seoul",
    requireValidDateField = false,
  } = options;

  const conditions: SQL[] = [];

  if (dateFieldId) {
    const fieldDateExpr = buildValidFieldDateSql(dateFieldId);
    // BETWEEN 및 >=, <= 비교 자체가 NULL 행을 제외하므로 IS NOT NULL 중복 절을 생략해 SQL 크기와 파라미터 수를 최소화합니다.
    if (startDate && endDate) {
      conditions.push(sql`${fieldDateExpr} BETWEEN (${startDate})::date AND (${endDate})::date`);
    } else if (startDate) {
      conditions.push(sql`${fieldDateExpr} >= (${startDate})::date`);
    } else if (endDate) {
      conditions.push(sql`${fieldDateExpr} <= (${endDate})::date`);
    } else if (requireValidDateField) {
      conditions.push(sql`${fieldDateExpr} IS NOT NULL`);
    }
    return conditions;
  }

  if (startDate) {
    conditions.push(
      sql`${formSubmissions.createdAt} >= ((${startDate} || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`
    );
  }
  if (endDate) {
    conditions.push(
      sql`${formSubmissions.createdAt} < ((((${endDate})::date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE ${timezone})`
    );
  }

  return conditions;
}

/**
 * 시계열 버킷(`day` | `week` | `month` | `quarter`) 정규화 키 생성용 SQL 표현식을 반환합니다.
 * `dateFieldId`가 주어지면 타임존 변환 없이 달력 날짜 컬럼에서 직접 버킷을 절삭하고,
 * 생략 시에만 `created_at AT TIME ZONE` 변환을 적용합니다.
 */
export function buildTimeBucketSql(
  timeBucket: AnalyticsTimeBucket,
  timezone: string,
  dateFieldId?: string
): SQL<string> {
  if (dateFieldId) {
    const fieldDateExpr = buildValidFieldDateSql(dateFieldId);
    switch (timeBucket) {
      case "day":
        return sql<string>`TO_CHAR(${fieldDateExpr}, 'YYYY-MM-DD')`;
      case "week":
        return sql<string>`TO_CHAR(DATE_TRUNC('week', (${fieldDateExpr})::timestamp), 'YYYY-MM-DD')`;
      case "month":
        return sql<string>`TO_CHAR(${fieldDateExpr}, 'YYYY-MM')`;
      case "quarter":
        return sql<string>`TO_CHAR(DATE_TRUNC('quarter', (${fieldDateExpr})::timestamp), 'YYYY-"Q"Q')`;
    }
  }

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
