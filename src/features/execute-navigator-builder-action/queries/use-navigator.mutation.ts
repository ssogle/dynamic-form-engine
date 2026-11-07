import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formKeys } from "@/entities/form";
import { httpClient } from "@/shared/lib/http";
import type {
  ExecuteNavigatorActionPayload,
  NavigatorExecutionResponse,
} from "../types/action.types";

/**
 * AI Navigator 액션 추론 및 실행 API 호출 순수 함수
 *
 * @param payload 사용자 프롬프트 및 현재 화면 컨텍스트
 * @returns 액션 추론 결과 및 갱신된 폼 정보
 */
export async function executeNavigatorAction(
  payload: ExecuteNavigatorActionPayload
): Promise<NavigatorExecutionResponse> {
  const response = await httpClient.post<NavigatorExecutionResponse>("/api/v1/navigator", payload);

  return response;
}

/**
 * AI Navigator 액션 실행 React Query 뮤테이션 훅
 *
 * 액션 실행 성공 시:
 * 1. 응답에 updatedForm이 있는 경우 즉시 해당 슬러그의 상세 캐시를 동기화하여
 *    프리뷰 캔버스가 리렌더링되도록 합니다.
 * 2. 폼 목록 쿼리 캐시를 무효화하여 최신 상태를 유지합니다.
 */
export function useNavigatorActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executeNavigatorAction,
    onSuccess: (data) => {
      // 1. 갱신/생성된 폼 캐시 즉각 주입
      if (data.updatedForm?.slug) {
        queryClient.setQueryData(formKeys.detail(data.updatedForm.slug), data.updatedForm);
      }

      // 2. 폼 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: formKeys.all });
    },
  });
}
