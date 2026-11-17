/**
 * 분석 뷰 엔티티 TanStack Query 캐시 키 팩토리
 */
export const analysisViewKeys = {
  all: ["analysisViews"] as const,
  lists: () => [...analysisViewKeys.all, "list"] as const,
  publishedLists: () => [...analysisViewKeys.all, "list", "published"] as const,
  detail: (id: string, publishedOnly = false) =>
    [...analysisViewKeys.all, "detail", id, publishedOnly ? "published" : "all"] as const,
};
