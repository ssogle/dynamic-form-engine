/**
 * 폼 엔티티 TanStack Query 캐시 키 팩토리
 *
 * 폼 목록 및 단건 상세 조회, AI 네비게이터의 실시간 캐시 갱신 시
 * 일관된 쿼리 키를 보장하기 위한 단일 진실 원천(SSOT) 팩토리입니다.
 */
export const formKeys = {
  all: ["forms"] as const,
  lists: () => [...formKeys.all, "list"] as const,
  publishedLists: () => [...formKeys.all, "list", "published"] as const,
  detail: (identifier: string) => [...formKeys.all, "detail", identifier] as const,
};
