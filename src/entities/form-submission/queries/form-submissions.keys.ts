/**
 * 폼 응답(Form Submission) 엔티티 TanStack Query 캐시 키 팩토리
 *
 * 폼별 응답 목록 및 단건 응답 조회 캐시의 일관성을 보장하기 위한 단일 진실 원천(SSOT) 팩토리입니다.
 */
export const formSubmissionsKeys = {
  all: ["submissions"] as const,
  byForm: (formId: string) => [...formSubmissionsKeys.all, "byForm", formId] as const,
  infiniteRoot: (formId: string) => [...formSubmissionsKeys.all, "infinite", formId] as const,
  infinite: (
    formId: string,
    params?:
      | {
          sort?: string | undefined;
          filters?: string | undefined;
          limit?: number | undefined;
          startDate?: string | undefined;
          endDate?: string | undefined;
          dateFieldId?: string | undefined;
        }
      | undefined
  ) => [...formSubmissionsKeys.all, "infinite", formId, params ?? {}] as const,
  detail: (id: string) => [...formSubmissionsKeys.all, "detail", id] as const,
  byIds: (formId: string, ids: string[]) =>
    [
      ...formSubmissionsKeys.all,
      "byIds",
      formId,
      Array.from(new Set(ids.filter(Boolean))).sort(),
    ] as const,
  related: (targetId: string) => [...formSubmissionsKeys.all, "related", targetId] as const,
};
