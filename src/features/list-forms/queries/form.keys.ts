/**
 * 폼 목록 및 세부 정보 조회를 위한 TanStack Query 키 팩토리
 */
export const formKeys = {
  all: ["forms"] as const,
  lists: () => [...formKeys.all, "list"] as const,
  detail: (id: string) => [...formKeys.all, "detail", id] as const,
};
