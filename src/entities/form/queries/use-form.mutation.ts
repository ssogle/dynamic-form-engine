import type { Form, InsertForm, UpdateForm } from "../schema/form.schema";
import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formKeys } from "./form.keys";

/**
 * 신규 폼 등록 API 호출 순수 함수
 *
 * @param input 폼 생성 요청 데이터 (slug, title, description 등)
 * @returns 생성된 Form 엔티티 프로미스
 */
export const createForm = (input: InsertForm): Promise<Form> =>
  httpClient.post<Form>("/api/v1/forms", input);

/**
 * 폼 정보 및 스키마 부분 수정 API 호출 순수 함수
 *
 * @param id 수정 대상 폼 고유 식별자(UUID)
 * @param input 수정할 폼 메타데이터
 * @returns 수정된 Form 엔티티 프로미스
 */
export const updateForm = (id: string, input: UpdateForm): Promise<Form> =>
  httpClient.patch<Form>(`/api/v1/forms/${id}`, input);

/**
 * 폼 공식 발행 및 초안 회수 API 호출 순수 함수
 *
 * 발행 시 서버의 PostgreSQL 중앙 시계 sql`now()`로 발행일시를 기록하며,
 * 회수 시에는 null로 초기화합니다.
 *
 * @param id 대상 폼 고유 식별자(UUID)
 * @param isPublished true: 공개 발행, false: 미발행 초안 회수
 * @returns 갱신된 Form 엔티티 프로미스
 */
export const publishForm = (id: string, isPublished = true): Promise<Form> =>
  httpClient.post<Form>(`/api/v1/forms/${id}/publish`, { isPublished });

/**
 * 폼 소프트 삭제 API 호출 순수 함수
 *
 * @param id 삭제 대상 폼 고유 식별자(UUID)
 * @returns 삭제 처리된 Form 엔티티 프로미스
 */
export const deleteForm = (id: string): Promise<Form> =>
  httpClient.delete<Form>(`/api/v1/forms/${id}`);

/**
 * 신규 폼 등록을 위한 엔티티 공용 TanStack Mutation 훅
 * 생성 성공 시 캐시된 모든 폼 쿼리를 무효화하여 최신 상태로 동기화합니다.
 */
export const useCreateFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Form, HttpErrorData, InsertForm>({
    mutationFn: createForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.all });
    },
  });
};

/**
 * 폼 정보 및 스키마 수정을 위한 엔티티 공용 TanStack Mutation 훅
 * 수정 성공 시 캐시된 모든 폼 쿼리를 무효화하여 프리뷰어와 목록을 동기화합니다.
 */
export const useUpdateFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Form, HttpErrorData, { id: string; data: UpdateForm }>({
    mutationFn: ({ id, data }) => updateForm(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.all });
    },
  });
};

/**
 * 폼 소프트 삭제를 위한 엔티티 공용 TanStack Mutation 훅
 * 삭제 성공 시 캐시된 모든 폼 쿼리를 무효화합니다.
 */
export const useDeleteFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Form, HttpErrorData, string>({
    mutationFn: (id: string) => deleteForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.all });
    },
  });
};

/**
 * 폼 발행 상태 토글을 위한 엔티티 공용 TanStack Mutation 훅
 * 성공 시 캐시된 모든 폼 쿼리를 무효화하여 빌더 및 컨슈머 화면을 즉시 동기화합니다.
 */
export const usePublishFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Form, HttpErrorData, { id: string; isPublished?: boolean }>({
    mutationFn: ({ id, isPublished = true }) => publishForm(id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.all });
    },
  });
};
