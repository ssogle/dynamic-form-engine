import { z } from "zod";
import { normalizeStringIds } from "@/shared/lib/normalize";
import { calendarDateStringSchema, refineDateRangeOrder } from "./date-range.schema";
import type { FormSubmission } from "./form-submission.schema";

/**
 * URL 쿼리스트링의 빈 문자열(`""`)을 `undefined`로 정규화해 선택적 파라미터로 처리합니다.
 */
const optionalNonEmptyString = (schema: z.ZodType<string>) =>
  z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    schema.optional()
  );

/**
 * RFC 4122/9562 표준 UUID 검증용 내부 Zod 스키마
 */
const uuidSchema = z.uuid();

/**
 * 폼 응답 목록 페이징, 멀티 정렬, 컬럼 필터, 배치 ID 및 기간 범위 조회 요청 쿼리 Zod 스키마
 */
export const submissionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional().default("createdAt:desc"),
    filters: z.string().optional(),
    ids: z.string().optional(),
    dateFieldId: optionalNonEmptyString(z.string().min(1)),
    startDate: optionalNonEmptyString(calendarDateStringSchema),
    endDate: optionalNonEmptyString(calendarDateStringSchema),
    timezone: optionalNonEmptyString(z.string().min(1)),
  })
  .superRefine(refineDateRangeOrder);

export type SubmissionQueryParams = z.infer<typeof submissionQuerySchema>;

/**
 * 단일 정렬 항목 인터페이스
 */
export interface SortItem {
  id: string;
  desc: boolean;
}

/**
 * "field1:desc,field2:asc" 형태의 정렬 쿼리 문자열을 SortItem[] 배열로 정규화 파싱합니다.
 *
 * @param sortStr 정렬 쿼리 문자열
 * @returns 정규화된 SortItem[] 배열 (파싱 불가 시 기본 최신순 [{ id: 'createdAt', desc: true }])
 */
export function parseSortParam(sortStr?: string): SortItem[] {
  if (!sortStr || typeof sortStr !== "string") {
    return [{ id: "createdAt", desc: true }];
  }

  const items = sortStr
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): SortItem | null => {
      const [id, order] = part.split(":");
      if (!id) return null;
      const isDesc = order?.toLowerCase() === "desc" || (!order && id === "createdAt");
      return {
        id: id.trim(),
        desc: isDesc,
      };
    })
    .filter((item): item is SortItem => Boolean(item));

  if (items.length === 0) {
    return [{ id: "createdAt", desc: true }];
  }

  return items;
}

/**
 * JSON 문자열 형태의 컬럼별 필터 쿼리를 Record<string, string> 객체로 안전하게 파싱합니다.
 *
 * @param filtersStr JSON 문자열 (예: '{"f_name":"홍길동","f_role":"엔지니어"}')
 * @returns 필드 ID -> 검색어 키워드 매핑 객체 (파싱 실패 시 빈 객체 {})
 */
export function parseFiltersParam(filtersStr?: string): Record<string, string> {
  if (!filtersStr || typeof filtersStr !== "string") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(filtersStr);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "string" && val.trim().length > 0) {
        result[key] = val.trim();
      } else if (typeof val === "number" || typeof val === "boolean") {
        result[key] = String(val);
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * 단일 문자열 또는 문자열 배열 입력을 정규화한 뒤 RFC 4122/9562 표준 UUID만 추출합니다.
 *
 * 공백·빈 문자열·중복을 먼저 제거한 뒤 Zod 내장 UUID 검증기(`z.uuid()`)로 비표준 토큰을 걸러냅니다.
 *
 * @param rawVal 단일 UUID 문자열, UUID 배열 또는 알 수 없는 원시 값
 * @returns 검증 및 중복 제거된 UUID 문자열 배열
 */
export function normalizeUuidIds(rawVal: unknown): string[] {
  return normalizeStringIds(rawVal).filter((id) => uuidSchema.safeParse(id).success);
}

/**
 * 쉼표(,)로 구분된 응답 ID 쿼리 문자열을 공백 제거·UUID 검증·중복 제거하여 배열로 파싱합니다.
 *
 * 관계형 필드(relation)가 선택한 타깃 레코드가 1페이지 밖에 존재하더라도
 * UUID 목록을 직접 배치 조회(WHERE id IN (...))할 수 있도록 안전한 UUID 배열로 정규화합니다.
 *
 * @param idsStr 쉼표로 구분된 UUID 목록 문자열
 * @returns 검증 및 중복 제거된 UUID 문자열 배열
 */
export function parseIdsParam(idsStr?: string): string[] {
  if (!idsStr || typeof idsStr !== "string") {
    return [];
  }

  return normalizeUuidIds(idsStr.split(","));
}

/**
 * 표준 페이지네이션 응답 계약 인터페이스
 */
export interface PaginatedSubmissionsResponse<T = FormSubmission> {
  items: T[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * 역참조 관계 조회(`GET /api/v1/relations`) 쿼리 파라미터 검증 Zod 스키마
 *
 * - 타깃 응답 레코드 ID(`targetId`)가 유효한 UUID 포맷인지 API 경계에서 검증합니다.
 * - 엔티티 스키마 레이어에 위치시켜 API 라우터와 도메인이 동일한 검증 계약을 공유합니다.
 */
export const relationsQuerySchema = z.object({
  targetId: z.uuid("올바른 targetId(UUID) 쿼리 파라미터가 필요합니다."),
});

/**
 * 역참조 관계 조회 쿼리 파라미터 TypeScript 정적 타입
 */
export type RelationsQueryParams = z.infer<typeof relationsQuerySchema>;
