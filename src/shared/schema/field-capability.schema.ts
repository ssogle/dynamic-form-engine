import { z } from "zod";

/**
 * 코어 폼 필드 타입 (9종 순수 도메인 데이터 필드)
 *
 * 빌더, 컨슈머, 분석 엔진이 단일 진실 원천으로 공유하는 필드 유형 열거형입니다.
 * - text: 단문 텍스트 입력
 * - textarea: 장문 설명 입력
 * - number: 숫자 입력
 * - select: 단일 선택 드롭다운
 * - radio: 라디오 버튼 단일 선택 그룹
 * - checkbox: 다중 선택 체크박스 그룹(옵션 보유 시) 또는 단일 불리언 체크박스(옵션 미보유 시)
 * - date: 순수 달력 날짜 선택기 (YYYY-MM-DD)
 * - switch: 참/거짓 토글 스위치 (boolean)
 * - relation: 타겟 폼 레코드 참조 필드 (단일 UUID 또는 UUID 배열)
 */
export const coreFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "switch",
  "relation",
]);
export type CoreFieldType = z.infer<typeof coreFieldTypeSchema>;

/**
 * 폼 응답 레코드의 시스템 공통 컬럼 식별자 열거형
 */
export const systemFieldIdSchema = z.enum(["id", "createdAt", "updatedAt"]);
export type SystemFieldId = z.infer<typeof systemFieldIdSchema>;

/**
 * 필터 조건에서 사용하는 통합 조회 연산자 열거형
 *
 * - eq / neq: 동등 일치 / 불일치 (미응답 NULL 행 보존)
 * - contains: 부분 일치 문자열 검색 (relation의 경우 타깃 대표 필드 자연어 검색 포함)
 * - gt / gte / lt / lte: 대소 비교 (숫자 안전 캐스팅 또는 날짜 비교)
 * - between: 양끝 포함 범위 비교 (min ~ max, 한쪽만 전달 시 개방 구간 허용)
 * - in / notIn: 후보 집합 포함 / 제외 (단일 값 및 배열 저장 형식 모두 지원)
 * - hasAny / hasAll: 다중 선택 배열 필드의 교집합 / 부분집합 포함 여부
 * - isEmpty / isNotEmpty: 미응답·빈 문자열·빈 배열 여부 판정
 */
export const fieldFilterOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "notIn",
  "hasAny",
  "hasAll",
  "isEmpty",
  "isNotEmpty",
]);
export type FieldFilterOperator = z.infer<typeof fieldFilterOperatorSchema>;

/**
 * 컨슈머 응답 테이블 컬럼 헤더 필터에서 렌더링할 위젯 유형
 */
export const fieldFilterWidgetSchema = z.enum([
  "text",
  "number",
  "options",
  "boolean",
  "date",
  "relation",
]);
export type FieldFilterWidget = z.infer<typeof fieldFilterWidgetSchema>;

/**
 * 통계 집계 메트릭 유형
 */
export const analyticsMetricTypeSchema = z.enum(["count", "sum", "avg", "min", "max"]);
export type AnalyticsMetricType = z.infer<typeof analyticsMetricTypeSchema>;

/**
 * 개별 필드 또는 시스템 컬럼의 조회·필터·정렬·집계 가능 능력(Capability) 명세
 */
export interface FieldQueryCapability {
  /** 허용되는 필터 연산자 목록 */
  readonly filterOperators: readonly FieldFilterOperator[];
  /** UI 및 단순 질의에서 기본 선택되는 연산자 */
  readonly defaultOperator: FieldFilterOperator;
  /** 컨슈머 테이블 컬럼 필터 UI 위젯 종류 */
  readonly filterWidget: FieldFilterWidget;
  /** 서버 정렬 지원 여부 */
  readonly sortable: boolean;
  /** 분석 엔진에서 허용되는 집계 메트릭 목록 */
  readonly aggregatableMetrics: readonly AnalyticsMetricType[];
  /** 분석 엔진에서 groupByFieldId 기준 축 사용 가능 여부 */
  readonly groupable: boolean;
  /** 분석·목록 조회의 dateFieldId 날짜 기준 축 후보 여부 */
  readonly isDateAxisCandidate: boolean;
}

/**
 * 연산자별 사용자 친화적 한국어 라벨 사전 (UI 셀렉트 및 배지 표기용)
 */
export const FIELD_FILTER_OPERATOR_LABELS: Record<FieldFilterOperator, string> = {
  eq: "같음",
  neq: "같지 않음",
  contains: "포함",
  gt: "초과 (>)",
  gte: "이상 (>=)",
  lt: "미만 (<)",
  lte: "이하 (<=)",
  between: "범위",
  in: "다음 중 하나",
  notIn: "다음 항목 제외",
  hasAny: "하나 이상 포함",
  hasAll: "모두 포함",
  isEmpty: "값 없음",
  isNotEmpty: "값 있음",
};

/**
 * 시스템 컬럼 기본 한글 표시 라벨 사전
 */
export const SYSTEM_FIELD_LABELS: Record<SystemFieldId, string> = {
  id: "ID",
  createdAt: "제출 일시",
  updatedAt: "수정 일시",
};

/**
 * 9종 코어 필드 타입별 고정 조회 능력 레지스트리
 *
 * Record<CoreFieldType, FieldQueryCapability>로 선언하여 향후 새 필드 타입이 추가될 때
 * 컴파일 타임에 조회/집계 능력 정의 누락을 즉시 감지합니다.
 */
export const CORE_FIELD_CAPABILITIES: Record<CoreFieldType, FieldQueryCapability> = {
  text: {
    filterOperators: ["contains", "eq", "neq", "isEmpty", "isNotEmpty"],
    defaultOperator: "contains",
    filterWidget: "text",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: false,
  },
  textarea: {
    filterOperators: ["contains", "eq", "neq", "isEmpty", "isNotEmpty"],
    defaultOperator: "contains",
    filterWidget: "text",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: false,
    isDateAxisCandidate: false,
  },
  number: {
    filterOperators: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "isEmpty", "isNotEmpty"],
    defaultOperator: "between",
    filterWidget: "number",
    sortable: true,
    aggregatableMetrics: ["count", "sum", "avg", "min", "max"],
    groupable: true,
    isDateAxisCandidate: false,
  },
  select: {
    filterOperators: ["in", "notIn", "eq", "isEmpty", "isNotEmpty"],
    defaultOperator: "in",
    filterWidget: "options",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: false,
  },
  radio: {
    filterOperators: ["in", "notIn", "eq", "isEmpty", "isNotEmpty"],
    defaultOperator: "in",
    filterWidget: "options",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: false,
  },
  checkbox: {
    filterOperators: ["hasAny", "hasAll", "eq", "isEmpty", "isNotEmpty"],
    defaultOperator: "hasAny",
    filterWidget: "options",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: false,
  },
  date: {
    filterOperators: ["between", "eq", "gte", "lte", "isEmpty", "isNotEmpty"],
    defaultOperator: "between",
    filterWidget: "date",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: true,
  },
  switch: {
    filterOperators: ["eq", "isEmpty", "isNotEmpty"],
    defaultOperator: "eq",
    filterWidget: "boolean",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: false,
  },
  relation: {
    filterOperators: ["in", "eq", "contains", "isEmpty", "isNotEmpty"],
    defaultOperator: "in",
    filterWidget: "relation",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: true,
    isDateAxisCandidate: false,
  },
};

/**
 * 선택 옵션(options)이 없는 단일 불리언 checkbox 필드에 적용되는 조회 능력 정의
 */
export const CHECKBOX_BOOLEAN_CAPABILITY: FieldQueryCapability = {
  filterOperators: ["eq", "isEmpty", "isNotEmpty"],
  defaultOperator: "eq",
  filterWidget: "boolean",
  sortable: true,
  aggregatableMetrics: ["count"],
  groupable: true,
  isDateAxisCandidate: false,
};

/**
 * 시스템 공통 컬럼(id, createdAt, updatedAt)별 고정 조회 능력 레지스트리
 */
export const SYSTEM_FIELD_CAPABILITIES: Record<SystemFieldId, FieldQueryCapability> = {
  id: {
    filterOperators: ["eq", "contains"],
    defaultOperator: "contains",
    filterWidget: "text",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: false,
    isDateAxisCandidate: false,
  },
  createdAt: {
    filterOperators: ["between", "gte", "lte", "eq"],
    defaultOperator: "between",
    filterWidget: "date",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: false,
    isDateAxisCandidate: false,
  },
  updatedAt: {
    filterOperators: ["between", "gte", "lte", "eq"],
    defaultOperator: "between",
    filterWidget: "date",
    sortable: true,
    aggregatableMetrics: ["count"],
    groupable: false,
    isDateAxisCandidate: false,
  },
};

/**
 * Capability 해석 시 입력으로 받는 최소 필드 메타데이터 형태
 */
export interface FieldCapabilityTarget {
  type?: string | undefined;
  options?: ReadonlyArray<unknown> | null | undefined;
}

/**
 * 문자열이 시스템 공통 컬럼 식별자(id, createdAt, updatedAt)인지 판별합니다.
 */
export function isSystemFieldId(fieldId: string): fieldId is SystemFieldId {
  return systemFieldIdSchema.safeParse(fieldId).success;
}

/**
 * 시스템 컬럼 ID에 대응하는 조회 능력 명세를 반환합니다.
 */
export function resolveSystemFieldCapability(fieldId: string): FieldQueryCapability | null {
  const parsed = systemFieldIdSchema.safeParse(fieldId);
  if (!parsed.success) {
    return null;
  }
  return SYSTEM_FIELD_CAPABILITIES[parsed.data];
}

/**
 * 폼 필드의 type 및 options 유무를 바탕으로 실제 조회·필터·집계 능력 명세를 파생합니다.
 *
 * - checkbox는 options 배열이 비어있거나 없으면 단일 불리언 토글(boolean 위젯)로 해석합니다.
 * - 정의되지 않은 알 수 없는 타입은 null을 반환합니다.
 */
export function resolveFieldQueryCapability(
  field?: FieldCapabilityTarget | null
): FieldQueryCapability | null {
  if (!field || typeof field.type !== "string") {
    return null;
  }

  const parsedType = coreFieldTypeSchema.safeParse(field.type);
  if (!parsedType.success) {
    return null;
  }

  if (parsedType.data === "checkbox") {
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
    return hasOptions ? CORE_FIELD_CAPABILITIES.checkbox : CHECKBOX_BOOLEAN_CAPABILITY;
  }

  return CORE_FIELD_CAPABILITIES[parsedType.data];
}

/**
 * 필드 ID와 폼 필드 정의를 함께 받아 시스템 컬럼 또는 도메인 필드의 조회 능력을 통합 해석합니다.
 */
export function resolveTargetFieldCapability(
  fieldId: string,
  field?: FieldCapabilityTarget | null
): FieldQueryCapability | null {
  const systemCap = resolveSystemFieldCapability(fieldId);
  if (systemCap) {
    return systemCap;
  }
  return resolveFieldQueryCapability(field);
}
