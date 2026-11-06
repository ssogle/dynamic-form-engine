import type { Form, InsertForm, UpdateForm } from "@/entities/form";
import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formKeys } from "./form.keys";

/**
 * 폼 전체 목록 조회 API 호출 함수
 */
export const getForms = (): Promise<Form[]> => httpClient.get<Form[]>("/api/v1/forms");

/**
 * 신규 폼 등록 API 호출 함수
 */
export const createForm = (input: InsertForm): Promise<Form> =>
  httpClient.post<Form>("/api/v1/forms", input);

/**
 * 폼 정보 부분 수정 API 호출 함수
 */
export const updateForm = (id: string, input: UpdateForm): Promise<Form> =>
  httpClient.patch<Form>(`/api/v1/forms/${id}`, input);

/**
 * 폼 소프트 삭제 API 호출 함수
 */
export const deleteForm = (id: string): Promise<Form> =>
  httpClient.delete<Form>(`/api/v1/forms/${id}`);

/**
 * 폼 목록 조회를 위한 TanStack Query 훅
 */
export const useFormsQuery = () =>
  useQuery<Form[], HttpErrorData>({
    queryKey: formKeys.lists(),
    queryFn: getForms,
  });

/**
 * 신규 폼 생성을 위한 TanStack Mutation 훅
 * 생성 성공 시 캐시된 폼 목록 쿼리를 자동으로 무효화하여 최신 상태를 동기화합니다.
 */
export const useCreateSampleFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Form, HttpErrorData, InsertForm>({
    mutationFn: createForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.all });
    },
  });
};

/**
 * 폼 정보 수정을 위한 TanStack Mutation 훅
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
 * 폼 소프트 삭제를 위한 TanStack Mutation 훅
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
