import { z } from "zod";
import type { FormSubmission } from "./form-submission.schema";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 폼 응답 목록 페이징, 멀티 정렬, 컬럼 필터, 배치 ID 조회 요청 쿼리 Zod 스키마
 */
export const submissionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional().default("createdAt:desc"),
  filters: z.string().optional(),
  ids: z.string().optional(),
});

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

  const uniqueIds = new Set<string>();
  for (const part of idsStr.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length > 0 && UUID_PATTERN.test(trimmed)) {
      uniqueIds.add(trimmed);
    }
  }
  return Array.from(uniqueIds);
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
