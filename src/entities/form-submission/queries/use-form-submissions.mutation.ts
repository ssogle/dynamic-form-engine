import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import type { FormSubmission } from "../schema/form-submission.schema";
import { formSubmissionsKeys } from "./form-submissions.keys";

/**
 * 폼 신규 응답 제출 순수 API 호출 함수
 */
export async function submitFormResponse(
  formIdOrSlug: string,
  data: Record<string, unknown>
): Promise<FormSubmission> {
  return await httpClient.post<FormSubmission>(`/api/v1/forms/${formIdOrSlug}/submissions`, {
    data,
  });
}

/**
 * 폼 응답 수정 순수 API 호출 함수
 */
export async function updateFormSubmission(
  formIdOrSlug: string,
  submissionId: string,
  data: Record<string, unknown>
): Promise<FormSubmission> {
  return await httpClient.patch<FormSubmission>(
    `/api/v1/forms/${formIdOrSlug}/submissions/${submissionId}`,
    { data }
  );
}

/**
 * 폼 응답 소프트 삭제 순수 API 호출 함수
 */
export async function deleteFormSubmission(
  formIdOrSlug: string,
  submissionId: string
): Promise<FormSubmission> {
  return await httpClient.delete<FormSubmission>(
    `/api/v1/forms/${formIdOrSlug}/submissions/${submissionId}`
  );
}

/**
 * 폼 신규 응답 제출 React Query 뮤테이션 훅
 * 성공 시 해당 폼의 응답 목록 캐시를 자동으로 무효화합니다.
 */
export function useSubmitFormMutation(formIdOrSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => submitFormResponse(formIdOrSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formSubmissionsKeys.byForm(formIdOrSlug) });
    },
  });
}

/**
 * 폼 응답 수정 React Query 뮤테이션 훅
 * 성공 시 해당 폼의 응답 목록 캐시를 자동으로 무효화합니다.
 */
export function useUpdateSubmissionMutation(formIdOrSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, data }: { submissionId: string; data: Record<string, unknown> }) =>
      updateFormSubmission(formIdOrSlug, submissionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formSubmissionsKeys.byForm(formIdOrSlug) });
    },
  });
}

/**
 * 폼 응답 소프트 삭제 React Query 뮤테이션 훅
 * 성공 시 해당 폼의 응답 목록 캐시를 자동으로 무효화합니다.
 */
export function useDeleteSubmissionMutation(formIdOrSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (submissionId: string) => deleteFormSubmission(formIdOrSlug, submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formSubmissionsKeys.byForm(formIdOrSlug) });
    },
  });
}
