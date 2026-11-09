import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import { formKeys } from "@/entities/form";
import type {
  ExecuteNavigatorPayload,
  NavigatorExecutionResponse,
} from "../types/navigator-action.types";

/**
 * 네비게이터 서버 액션 실행 API 호출 순수 함수
 *
 * @param payload 실행 요청 페이로드 (mode, prompt, messages, currentContext)
 * @returns AI 답변 및 브라우저 제어 액션
 */
export async function executeNavigatorAction(
  payload: ExecuteNavigatorPayload
): Promise<NavigatorExecutionResponse> {
  return httpClient.post<NavigatorExecutionResponse>("/api/v1/navigator", payload);
}

/**
 * AI Navigator 액션 실행 전용 TanStack Mutation 훅
 *
 * 스키마 조작이나 폼 생성, 발행 등의 액션이 서버에서 수행되면
 * 관련 TanStack Query 캐시(forms 목록, 상세)를 자동으로 무효화합니다.
 */
export function useNavigatorMutation() {
  const queryClient = useQueryClient();

  return useMutation<NavigatorExecutionResponse, Error, ExecuteNavigatorPayload>({
    mutationFn: executeNavigatorAction,
    onSuccess: (data) => {
      if (data.action) {
        switch (data.action.type) {
          case "CREATE_FORM":
          case "DELETE_FORMS":
          case "PUBLISH_FORM":
            // 폼 목록 쿼리 캐시 무효화
            queryClient.invalidateQueries({ queryKey: formKeys.all });
            break;

          case "UPDATE_SCHEMA":
            // 폼 목록 및 해당 폼 상세 캐시 무효화
            queryClient.invalidateQueries({ queryKey: formKeys.all });
            if (data.action.slug) {
              queryClient.invalidateQueries({
                queryKey: formKeys.detail(data.action.slug),
              });
            }
            break;

          default:
            break;
        }
      }
    },
  });
}
