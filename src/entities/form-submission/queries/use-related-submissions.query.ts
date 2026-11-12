import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import type { FormSubmission } from "../schema/form-submission.schema";
import { formSubmissionsKeys } from "./form-submissions.keys";

/**
 * 역참조 그룹 응답 클라이언트 타입
 */
export interface RelatedSubmissionsGroup {
  sourceForm: {
    id: string;
    title: string;
    schemaDefinition?: unknown;
  };
  submissions: FormSubmission[];
}

/**
 * 특정 대상 레코드(targetId)를 참조하고 있는 역방향 관계 서브미션 목록을 조회하는 순수 비동기 함수
 *
 * @param targetId 참조 대상 레코드(서브미션)의 고유 식별자(UUID)
 * @returns RelatedSubmissionsGroup[] 소스 폼별 그룹화된 역참조 서브미션 배열
 */
export async function getRelatedSubmissions(targetId: string): Promise<RelatedSubmissionsGroup[]> {
  if (!targetId) {
    return [];
  }
  const response = await httpClient.get<RelatedSubmissionsGroup[]>(
    `/api/v1/relations?targetId=${encodeURIComponent(targetId)}`
  );
  return response;
}

/**
 * 특정 레코드에 연결된 역참조 서브미션 목록을 캐싱 및 자동 갱신하는 TanStack Query 훅
 *
 * @param targetId 참조 대상 레코드의 UUID 식별자
 * @param options TanStack Query 옵션
 */
export function useRelatedSubmissionsQuery(
  targetId: string,
  options?: { enabled?: boolean | undefined }
) {
  return useQuery({
    queryKey: formSubmissionsKeys.related(targetId),
    queryFn: () => getRelatedSubmissions(targetId),
    enabled: Boolean(targetId) && (options?.enabled ?? true),
  });
}
