import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import type { FormSubmission } from "../schema/form-submission.schema";
import { formSubmissionsKeys } from "./form-submissions.keys";

/**
 * 특정 폼의 응답 목록을 조회하는 순수 비동기 함수
 *
 * @param formIdOrSlug 조회할 폼의 UUID 식별자 또는 슬러그
 * @returns FormSubmission[] 응답 목록 배열
 */
export async function getFormSubmissions(formIdOrSlug: string): Promise<FormSubmission[]> {
  const response = await httpClient.get<FormSubmission[]>(
    `/api/v1/forms/${formIdOrSlug}/submissions`
  );
  return response;
}

/**
 * 특정 폼의 응답 목록을 조회하는 TanStack Query 커스텀 훅
 *
 * @param formIdOrSlug 조회할 폼의 UUID 식별자 또는 슬러그
 */
export function useFormSubmissionsQuery(formIdOrSlug: string) {
  return useQuery({
    queryKey: formSubmissionsKeys.byForm(formIdOrSlug),
    queryFn: () => getFormSubmissions(formIdOrSlug),
    enabled: Boolean(formIdOrSlug),
  });
}

/**
 * 특정 폼의 단건 응답 상세 데이터를 조회하는 순수 비동기 함수
 *
 * @param formIdOrSlug 조회할 폼의 UUID 식별자 또는 슬러그
 * @param submissionId 조회할 응답 식별자
 * @returns FormSubmission 단건 응답 객체
 */
export async function getFormSubmissionDetail(
  formIdOrSlug: string,
  submissionId: string
): Promise<FormSubmission> {
  const response = await httpClient.get<FormSubmission>(
    `/api/v1/forms/${formIdOrSlug}/submissions/${submissionId}`
  );
  return response;
}

/**
 * 특정 폼의 단건 응답 상세 데이터를 조회하는 TanStack Query 커스텀 훅
 *
 * @param formIdOrSlug 조회할 폼의 UUID 식별자 또는 슬러그
 * @param submissionId 조회할 응답 식별자
 */
export function useFormSubmissionDetailQuery(formIdOrSlug: string, submissionId: string) {
  return useQuery({
    queryKey: formSubmissionsKeys.detail(submissionId),
    queryFn: () => getFormSubmissionDetail(formIdOrSlug, submissionId),
    enabled: Boolean(formIdOrSlug && submissionId),
  });
}
