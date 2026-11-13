import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import type { FormSubmission } from "../schema/form-submission.schema";
import type { PaginatedSubmissionsResponse } from "../schema/submission-query.schema";
import { formSubmissionsKeys } from "./form-submissions.keys";

/**
 * 페이징 조회 요청 파라미터 타입 (exactOptionalPropertyTypes 준수)
 */
export interface GetPaginatedSubmissionsParams {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  filters?: string | undefined;
  ids?: string | undefined;
}

/**
 * 폼 응답 목록을 페이지네이션, 멀티 정렬, 컬럼 필터, 배치 ID 조건과 함께 조회하는 순수 비동기 함수
 *
 * @param formId 조회할 폼의 UUID 식별자
 * @param params 페이징 및 정렬, 필터, 배치 ID 쿼리 파라미터
 * @returns PaginatedSubmissionsResponse 객체 반환
 */
export async function getPaginatedFormSubmissions(
  formId: string,
  params: GetPaginatedSubmissionsParams = {}
): Promise<PaginatedSubmissionsResponse> {
  return await httpClient.get<PaginatedSubmissionsResponse>(`/api/v1/forms/${formId}/submissions`, {
    params: {
      page: params.page,
      limit: params.limit,
      sort: params.sort || undefined,
      filters: params.filters || undefined,
      ids: params.ids || undefined,
    },
  });
}

/**
 * 특정 폼의 응답 목록을 단일 배열로 조회하는 하위 호환용 비동기 함수 (최대 100건)
 *
 * @param formId 조회할 폼의 UUID 식별자
 * @returns FormSubmission[] 응답 목록 배열
 */
export async function getFormSubmissions(formId: string): Promise<FormSubmission[]> {
  const response = await httpClient.get<PaginatedSubmissionsResponse | FormSubmission[]>(
    `/api/v1/forms/${formId}/submissions`
  );
  if (Array.isArray(response)) {
    return response;
  }
  return response.items ?? [];
}

/**
 * 특정 폼의 응답 목록을 단순 조회하는 TanStack Query 훅 (기존 컴포넌트 호환용)
 *
 * @param formId 조회할 폼의 UUID 식별자
 */
export function useFormSubmissionsQuery(formId: string) {
  return useQuery({
    queryKey: formSubmissionsKeys.byForm(formId),
    queryFn: () => getFormSubmissions(formId),
    enabled: Boolean(formId),
  });
}

/**
 * 무한 스크롤 쿼리 옵션 인터페이스
 */
export interface UseInfiniteFormSubmissionsQueryOptions {
  sort?: string | undefined;
  filters?: string | undefined;
  limit?: number | undefined;
}

/**
 * 특정 폼의 응답 목록을 무한 스크롤(가상화 그리드 연동)로 조회하는 TanStack Query 커스텀 훅
 *
 * 정렬(sort)이나 필터(filters)가 변경되면 쿼리 키가 자동으로 변경되어
 * 기존 데이터가 1페이지부터 새롭게 자동 리셋 페칭됩니다.
 *
 * @param formId 조회 대상 폼 고유 식별자 (UUID)
 * @param options 멀티 정렬, 컬럼 필터, 페이지당 건수 옵션
 */
export function useInfiniteFormSubmissionsQuery(
  formId: string,
  options: UseInfiniteFormSubmissionsQueryOptions = {}
) {
  const { sort, filters, limit = 20 } = options;

  return useInfiniteQuery({
    queryKey: formSubmissionsKeys.infinite(formId, { sort, filters, limit }),
    queryFn: ({ pageParam }) =>
      getPaginatedFormSubmissions(formId, {
        page: pageParam,
        limit,
        sort,
        filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: Boolean(formId),
  });
}

/**
 * 특정 폼의 단건 응답 상세 데이터를 조회하는 순수 비동기 함수
 *
 * @param formId 조회할 폼의 UUID 식별자
 * @param submissionId 조회할 응답 식별자
 * @returns FormSubmission 단건 응답 객체
 */
export async function getFormSubmissionDetail(
  formId: string,
  submissionId: string
): Promise<FormSubmission> {
  const response = await httpClient.get<FormSubmission>(
    `/api/v1/forms/${formId}/submissions/${submissionId}`
  );
  return response;
}

/**
 * 특정 폼의 단건 응답 상세 데이터를 조회하는 TanStack Query 커스텀 훅
 *
 * @param formId 조회할 폼의 UUID 식별자
 * @param submissionId 조회할 응답 식별자
 */
export function useFormSubmissionDetailQuery(formId: string, submissionId: string) {
  return useQuery({
    queryKey: formSubmissionsKeys.detail(submissionId),
    queryFn: () => getFormSubmissionDetail(formId, submissionId),
    enabled: Boolean(formId && submissionId),
  });
}

/**
 * 특정 폼에 속한 지정 ID 목록의 응답 레코드를 배치 조회(ids 필터)하는 순수 비동기 함수
 *
 * 관계형(relation) 필드에서 이미 선택되어 저장된 타깃 레코드 UUID들이
 * 1페이지 밖에 존재하더라도 전체 행(Row) 데이터를 즉시 복원할 때 사용합니다.
 *
 * @param formId 조회 대상 타깃 폼 UUID
 * @param ids 조회할 응답 레코드 ID 배열
 * @returns 조회된 FormSubmission 배열
 */
export async function getFormSubmissionsByIds(
  formId: string,
  ids: string[]
): Promise<FormSubmission[]> {
  const normalizedIds = Array.from(new Set(ids.filter(Boolean))).sort();
  if (!formId || normalizedIds.length === 0) {
    return [];
  }

  const response = await getPaginatedFormSubmissions(formId, {
    ids: normalizedIds.join(","),
    limit: Math.min(100, Math.max(20, normalizedIds.length)),
  });
  return response.items ?? [];
}

/**
 * 특정 폼에 속한 지정 ID 목록의 응답 레코드를 배치 조회하는 TanStack Query 커스텀 훅
 *
 * @param formId 조회 대상 타깃 폼 UUID
 * @param ids 조회할 응답 레코드 ID 배열 (비어있으면 네트워크 요청을 비활성화함)
 */
export function useFormSubmissionsByIdsQuery(formId: string, ids: string[]) {
  const normalizedIds = Array.from(new Set(ids.filter(Boolean))).sort();

  return useQuery({
    queryKey: formSubmissionsKeys.byIds(formId, normalizedIds),
    queryFn: () => getFormSubmissionsByIds(formId, normalizedIds),
    enabled: Boolean(formId && normalizedIds.length > 0),
  });
}
