import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import type { FormSubmission } from "../schema/form-submission.schema";
import type { PaginatedSubmissionsResponse } from "../schema/submission-query.schema";
import { formSubmissionsKeys } from "./form-submissions.keys";

/**
 * 폼 신규 응답 제출 순수 API 호출 함수
 *
 * @param formId 대상 폼의 고유 UUID 식별자
 * @param data 제출할 필드별 입력 데이터 맵
 */
export async function submitFormResponse(
  formId: string,
  data: Record<string, unknown>
): Promise<FormSubmission> {
  return await httpClient.post<FormSubmission>(`/api/v1/forms/${formId}/submissions`, {
    data,
  });
}

/**
 * 폼 응답 수정 순수 API 호출 함수
 *
 * @param formId 대상 폼의 고유 UUID 식별자
 * @param submissionId 수정할 응답의 고유 UUID 식별자
 * @param data 수정할 필드별 입력 데이터 맵
 */
export async function updateFormSubmission(
  formId: string,
  submissionId: string,
  data: Record<string, unknown>
): Promise<FormSubmission> {
  return await httpClient.patch<FormSubmission>(
    `/api/v1/forms/${formId}/submissions/${submissionId}`,
    { data }
  );
}

/**
 * 폼 응답 소프트 삭제 순수 API 호출 함수
 *
 * @param formId 대상 폼의 고유 UUID 식별자
 * @param submissionId 삭제할 응답의 고유 UUID 식별자
 */
export async function deleteFormSubmission(
  formId: string,
  submissionId: string
): Promise<FormSubmission> {
  return await httpClient.delete<FormSubmission>(
    `/api/v1/forms/${formId}/submissions/${submissionId}`
  );
}

/**
 * 폼 신규 응답 제출 React Query 뮤테이션 훅
 *
 * 제출 성공 시 단순 목록 및 무한 스크롤 목록 캐시를 무효화하여
 * 최신 제출 레코드가 목록 상단에 반영되도록 합니다.
 *
 * @param formId 대상 폼의 고유 UUID 식별자
 */
export function useSubmitFormMutation(formId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => submitFormResponse(formId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formSubmissionsKeys.byForm(formId) });
      queryClient.invalidateQueries({ queryKey: formSubmissionsKeys.infiniteRoot(formId) });
    },
  });
}

/**
 * 폼 응답 수정 React Query 뮤테이션 훅
 *
 * 수정 성공 시 단건 상세 캐시와 무한 스크롤 목록 캐시 내 해당 항목을 즉시 갱신(Direct Cache Update)하여,
 * 스크롤 위치나 로드된 페이지 구조를 유지하면서 수정 사항이 즉각 렌더링되도록 합니다.
 *
 * @param formId 대상 폼의 고유 UUID 식별자
 */
export function useUpdateSubmissionMutation(formId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, data }: { submissionId: string; data: Record<string, unknown> }) =>
      updateFormSubmission(formId, submissionId, data),
    onSuccess: (updatedSubmission, { submissionId }) => {
      // 1. 단건 상세 캐시 즉시 업데이트
      queryClient.setQueryData(formSubmissionsKeys.detail(submissionId), updatedSubmission);

      // 2. 무한 스크롤(Infinite Query) 캐시 내 해당 항목 정밀 교체
      queryClient.setQueriesData<InfiniteData<PaginatedSubmissionsResponse>>(
        { queryKey: formSubmissionsKeys.infiniteRoot(formId) },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === submissionId ? updatedSubmission : item
              ),
            })),
          };
        }
      );

      // 3. 단순 목록 캐시(호환용)도 함께 업데이트
      queryClient.setQueriesData<FormSubmission[]>(
        { queryKey: formSubmissionsKeys.byForm(formId) },
        (oldData) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((item) => (item.id === submissionId ? updatedSubmission : item));
        }
      );

      // 4. 백그라운드 캐시 무효화 (화면 깜빡임 방지: refetchType: 'none')
      queryClient.invalidateQueries({
        queryKey: formSubmissionsKeys.byForm(formId),
      });
      queryClient.invalidateQueries({
        queryKey: formSubmissionsKeys.infiniteRoot(formId),
        refetchType: "none",
      });
    },
  });
}

/**
 * 폼 응답 소프트 삭제 React Query 뮤테이션 훅
 *
 * [무한 스크롤 정밀 캐시 정돈 (Direct Cache Pruning)]
 * 삭제 성공 시 단건 캐시는 메모리에서 즉시 파기하고,
 * 무한 스크롤 캐시(`infiniteRoot`)의 누적 페이지 전체에서 삭제 대상 레코드만 정밀하게 필터링(`filter`)합니다.
 *
 * 이를 통해:
 * 1) 사용자가 3페이지 이상 스크롤한 중간 항목을 삭제하더라도 스크롤 위치와 로드된 페이지 구조가 그대로 보존됩니다.
 * 2) 상세 페이지에서 삭제 후 목록으로 복귀(`router.push`)하더라도 캐시가 이미 정돈되어 있어 깜빡임 없이 즉시 삭제가 반영됩니다.
 * 3) 백그라운드 무효화(`refetchType: 'none'`)를 통해 강제 리셋을 방지하면서 서버와의 최종 일관성을 보장합니다.
 *
 * @param formId 대상 폼의 고유 UUID 식별자
 */
export function useDeleteSubmissionMutation(formId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (submissionId: string) => deleteFormSubmission(formId, submissionId),
    onSuccess: (_data, submissionId) => {
      // 1. 단건 상세 캐시 즉시 메모리 제거
      queryClient.removeQueries({
        queryKey: formSubmissionsKeys.detail(submissionId),
      });

      // 2. 무한 스크롤(Infinite Query) 캐시에서 삭제된 항목만 정밀 제거 (Direct Pruning)
      queryClient.setQueriesData<InfiniteData<PaginatedSubmissionsResponse>>(
        { queryKey: formSubmissionsKeys.infiniteRoot(formId) },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== submissionId),
              totalCount: Math.max(0, page.totalCount - 1),
            })),
          };
        }
      );

      // 3. 단순 목록 캐시(호환용)도 함께 정리
      queryClient.setQueriesData<FormSubmission[]>(
        { queryKey: formSubmissionsKeys.byForm(formId) },
        (oldData) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.filter((item) => item.id !== submissionId);
        }
      );

      // 4. 백그라운드 캐시 무효화 (화면 깜빡임 방지 및 일관성 확보)
      queryClient.invalidateQueries({
        queryKey: formSubmissionsKeys.byForm(formId),
      });
      queryClient.invalidateQueries({
        queryKey: formSubmissionsKeys.infiniteRoot(formId),
        refetchType: "none",
      });
    },
  });
}
