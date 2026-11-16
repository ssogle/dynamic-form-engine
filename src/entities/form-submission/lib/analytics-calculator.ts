import type { FormSchemaDefinition } from "@/shared/tables";
import type {
  AnalyticsTimeBucket,
  ComputeSeriesMetricInput,
  SeriesMetricPoint,
} from "../schema/analytics-query.schema";

/**
 * 폼 스키마 내 개별 필드의 집계용 메타데이터
 */
export interface AnalyticsFieldMeta {
  id: string;
  label: string;
  type: string;
  optionsMap: Map<string, string>;
}

/**
 * 시리즈 산술 연산 결과 단일 행
 */
export interface ComputedSeriesMetricRow {
  key: string;
  baseValue: number;
  targetValue: number;
  [resultKey: string]: string | number | null;
}

/**
 * 시리즈 산술 연산 결과 객체
 */
export interface ComputeSeriesMetricResult {
  operation: ComputeSeriesMetricInput["operation"];
  resultKey: string;
  rows: ComputedSeriesMetricRow[];
}

/**
 * IEEE 754 부동소수점 오차(예: 0.1 + 0.2 = 0.30000000000000004)를 보정합니다.
 */
export function roundFloatingPoint(value: number, precision = 6): number {
  const factor = 10 ** precision;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * 동적 JSONB 필드 값을 집계 가능한 유한한 숫자로 안전하게 파싱합니다.
 * 빈 문자열, null, undefined, 불리언, 비수치 문자열, NaN/Infinity는 null을 반환합니다.
 */
export function parseNumericValue(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().replaceAll(",", "");
  if (normalized.length === 0) {
    return null;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 폼의 schemaDefinition에서 소프트 삭제되지 않은 활성 필드의 라벨 및 선택 옵션(value -> label) 맵을 추출합니다.
 * 과거 응답 데이터의 가독성을 보존하기 위해 disabled: true로 비활성화된 옵션도 라벨 매핑에 포함합니다.
 */
export function resolveFieldOptionLabelMap(
  schemaDefinition?: FormSchemaDefinition | null
): Map<string, AnalyticsFieldMeta> {
  const result = new Map<string, AnalyticsFieldMeta>();
  if (!schemaDefinition || !Array.isArray(schemaDefinition.fields)) {
    return result;
  }

  for (const rawField of schemaDefinition.fields) {
    if (!rawField || typeof rawField !== "object") continue;
    if (rawField.deletedAt) continue;

    const id = typeof rawField.id === "string" ? rawField.id : "";
    if (!id) continue;

    const label = typeof rawField.label === "string" && rawField.label ? rawField.label : id;
    const type = typeof rawField.type === "string" ? rawField.type : "text";
    const optionsMap = new Map<string, string>();

    if (Array.isArray(rawField.options)) {
      for (const opt of rawField.options) {
        if (!opt || typeof opt !== "object") continue;
        const optRecord = opt as Record<string, unknown>;
        const value = typeof optRecord.value === "string" ? optRecord.value : "";
        const optLabel = typeof optRecord.label === "string" ? optRecord.label : value;
        if (value) {
          optionsMap.set(value, optLabel || value);
        }
      }
    }

    result.set(id, { id, label, type, optionsMap });
  }

  return result;
}

/**
 * groupBy 대상 필드 값을 차트/테이블 표시용 문자열 키로 변환합니다.
 * select/radio/checkbox의 저장 코드값(value)은 옵션 표시명(label)으로 치환합니다.
 */
export function formatFieldDisplayKey(rawValue: unknown, optionsMap?: Map<string, string>): string {
  if (rawValue === null || rawValue === undefined) {
    return "미응답";
  }

  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0) return "미응답";
    const mapped = rawValue
      .map((item) => {
        const key = String(item);
        return optionsMap?.get(key) ?? key;
      })
      .filter((item) => item.trim().length > 0);
    return mapped.length > 0 ? mapped.join(", ") : "미응답";
  }

  if (typeof rawValue === "boolean") {
    return rawValue ? "예" : "아니오";
  }

  const strValue = String(rawValue).trim();
  if (strValue.length === 0) {
    return "미응답";
  }

  return optionsMap?.get(strValue) ?? strValue;
}

/**
 * 지정된 IANA 시간대 기준 연/월/일 구성 요소를 추출합니다.
 */
function getZonedDateParts(
  dateInput: Date | string,
  timezone: string
): { year: number; month: number; day: number } {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  return { year, month, day };
}

/**
 * UTC 타임스탬프를 대상 시간대(timezone)로 보정한 뒤 정규화된 시계열 버킷 키로 변환합니다.
 *
 * - day: YYYY-MM-DD
 * - week: YYYY-MM-DD (해당 주 월요일)
 * - month: YYYY-MM
 * - quarter: YYYY-Q1 ~ YYYY-Q4
 */
export function formatTimeBucketKey(
  dateInput: Date | string,
  timeBucket: AnalyticsTimeBucket,
  timezone = "Asia/Seoul"
): string {
  const { year, month, day } = getZonedDateParts(dateInput, timezone);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  switch (timeBucket) {
    case "day":
      return `${year}-${mm}-${dd}`;
    case "month":
      return `${year}-${mm}`;
    case "quarter": {
      const quarter = Math.ceil(month / 3);
      return `${year}-Q${quarter}`;
    }
    case "week": {
      const utcDate = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = utcDate.getUTCDay(); // 일=0, 월=1, ... 토=6
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
      const wy = utcDate.getUTCFullYear();
      const wm = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
      const wd = String(utcDate.getUTCDate()).padStart(2, "0");
      return `${wy}-${wm}-${wd}`;
    }
  }
}

/**
 * 복수 폼의 집계 시리즈를 공통 축 키 합집합(Union)으로 병합하고 누락된 항목을 0으로 채웁니다(Zero-fill).
 */
export function mergeSeriesWithZeroFill(
  seriesInputs: Array<{ seriesKey: string; points: SeriesMetricPoint[] }>,
  sortMode: "key_asc" | "total_desc" = "key_asc"
): Array<Record<string, string | number>> {
  const allKeys = new Set<string>();
  const seriesMaps = seriesInputs.map(({ seriesKey, points }) => {
    const map = new Map<string, number>();
    for (const point of points) {
      allKeys.add(point.key);
      map.set(point.key, roundFloatingPoint((map.get(point.key) ?? 0) + point.value));
    }
    return { seriesKey, map };
  });

  const rows = Array.from(allKeys).map((key) => {
    const row: Record<string, string | number> = { key };
    for (const { seriesKey, map } of seriesMaps) {
      row[seriesKey] = map.get(key) ?? 0;
    }
    return row;
  });

  if (sortMode === "total_desc") {
    return rows.sort((a, b) => {
      const totalA = seriesMaps.reduce((sum, s) => sum + Number(a[s.seriesKey] ?? 0), 0);
      const totalB = seriesMaps.reduce((sum, s) => sum + Number(b[s.seriesKey] ?? 0), 0);
      if (totalB !== totalA) return totalB - totalA;
      return String(a.key).localeCompare(String(b.key), "ko");
    });
  }

  return rows.sort((a, b) => String(a.key).localeCompare(String(b.key), "ko"));
}

/**
 * 두 집계 시리즈(baseSeries, targetSeries) 간의 차액(subtract), 합산(add), 백분율 비율(ratio)을
 * 합집합(Union) 기준 Zero-fill 및 결정론적 산술 연산으로 계산합니다.
 *
 * - 계산식 방향: 항상 baseSeries(좌항/분자) [op] targetSeries(우항/분모)
 * - ratio 분모가 0인 경우 0으로 나누기를 방어하여 null을 반환하며, 소수점 둘째 자리까지 반올림합니다.
 */
export function computeSeriesMetric(input: ComputeSeriesMetricInput): ComputeSeriesMetricResult {
  const { operation, baseSeries, targetSeries, resultKey } = input;

  const baseMap = new Map<string, number>();
  const targetMap = new Map<string, number>();
  const unionKeys = new Set<string>();

  for (const point of baseSeries) {
    unionKeys.add(point.key);
    baseMap.set(point.key, roundFloatingPoint((baseMap.get(point.key) ?? 0) + point.value));
  }

  for (const point of targetSeries) {
    unionKeys.add(point.key);
    targetMap.set(point.key, roundFloatingPoint((targetMap.get(point.key) ?? 0) + point.value));
  }

  const sortedKeys = Array.from(unionKeys).sort((a, b) => a.localeCompare(b, "ko"));

  const rows: ComputedSeriesMetricRow[] = sortedKeys.map((key) => {
    const baseValue = baseMap.get(key) ?? 0;
    const targetValue = targetMap.get(key) ?? 0;

    let computed: number | null;
    if (operation === "add") {
      computed = roundFloatingPoint(baseValue + targetValue);
    } else if (operation === "subtract") {
      computed = roundFloatingPoint(baseValue - targetValue);
    } else {
      if (targetValue === 0) {
        computed = null;
      } else {
        const rawRatio = (baseValue / targetValue) * 100;
        computed = Math.round((rawRatio + Number.EPSILON) * 100) / 100;
      }
    }

    return {
      key,
      baseValue,
      targetValue,
      [resultKey]: computed,
    };
  });

  return {
    operation,
    resultKey,
    rows,
  };
}
