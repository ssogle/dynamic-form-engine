import type { AnalysisBlock, AnalysisBlockSourceLink } from "@/entities/analysis-view";
import { serializeFieldFiltersParam, type FieldFilterCondition } from "@/shared/schema";

/**
 * UI에 렌더링 가능한 형태로 정규화된 원천 폼 바로가기 링크 정보
 */
export interface ResolvedSourceLink {
  /** React key 및 중복 제거를 위한 안정적 식별자 */
  key: string;
  formId: string;
  label: string;
  href: string;
  startDate?: string;
  endDate?: string;
  dateFieldId?: string;
  filters?: FieldFilterCondition[];
}

/**
 * 폼 ID와 선택적 기간 필터(startDate, endDate, dateFieldId) 및 필드 필터(filters)를 결합하여
 * 컨슈머 원천 데이터 뷰(`/consumer/forms/[id]`) URL을 생성합니다.
 */
export function buildRawDataHref(params: {
  formId: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  dateFieldId?: string | undefined;
  filters?: ReadonlyArray<FieldFilterCondition> | undefined;
}): string {
  const basePath = `/consumer/forms/${encodeURIComponent(params.formId)}`;
  const searchParams = new URLSearchParams();

  if (params.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endDate", params.endDate);
  }
  if (params.dateFieldId) {
    searchParams.set("dateFieldId", params.dateFieldId);
  }

  const serializedFilters = serializeFieldFiltersParam(params.filters);
  if (serializedFilters) {
    searchParams.set("filters", serializedFilters);
  }

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function makeDedupeKey(link: {
  formId: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  dateFieldId?: string | undefined;
  filters?: ReadonlyArray<FieldFilterCondition> | undefined;
}): string {
  return [
    link.formId,
    link.startDate ?? "",
    link.endDate ?? "",
    link.dateFieldId ?? "",
    serializeFieldFiltersParam(link.filters) ?? "",
  ].join("|");
}

function toResolvedLink(
  source: Pick<
    AnalysisBlockSourceLink,
    "formId" | "label" | "startDate" | "endDate" | "dateFieldId" | "filters"
  >
): ResolvedSourceLink {
  return {
    key: makeDedupeKey(source),
    formId: source.formId,
    label: source.label,
    href: buildRawDataHref(source),
    ...(source.startDate ? { startDate: source.startDate } : {}),
    ...(source.endDate ? { endDate: source.endDate } : {}),
    ...(source.dateFieldId ? { dateFieldId: source.dateFieldId } : {}),
    ...(source.filters && source.filters.length > 0 ? { filters: source.filters } : {}),
  };
}

/**
 * 블록의 `sourceLinks`에서 원천 폼 데이터 목록(`/consumer/forms/[id]`) 바로가기 링크 목록을 추출합니다.
 * 동일 폼/동일 기간 조건은 중복 제거하여 반환합니다.
 *
 * @param block 분석 블록 객체
 * @returns 중복이 제거된 원천 데이터 뷰 링크 목록
 */
export function buildBlockSourceLinks(block: AnalysisBlock): ResolvedSourceLink[] {
  const seenKeys = new Set<string>();
  const resolved: ResolvedSourceLink[] = [];

  if (Array.isArray(block.sourceLinks)) {
    for (const link of block.sourceLinks) {
      const normalized = toResolvedLink(link);
      if (!seenKeys.has(normalized.key)) {
        seenKeys.add(normalized.key);
        resolved.push(normalized);
      }
    }
  }

  return resolved;
}
