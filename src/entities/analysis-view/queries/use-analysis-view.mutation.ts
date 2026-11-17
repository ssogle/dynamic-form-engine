import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AnalysisView } from "../schema/analysis-view.schema";
import { analysisViewKeys } from "./analysis-view.keys";

/**
 * 분석 뷰 공식 발행 및 초안 회수 API 호출 순수 함수
 *
 * @param id 대상 분석 뷰 고유 식별자(UUID)
 * @param isPublished true: 공식 발행, false: 초안 회수
 * @returns 갱신된 AnalysisView 엔티티 프로미스
 */
export const publishAnalysisView = (id: string, isPublished = true): Promise<AnalysisView> =>
  httpClient.post<AnalysisView>(`/api/v1/analysis-views/${id}/publish`, { isPublished });

/**
 * 분석 뷰 단건 소프트 삭제 API 호출 순수 함수
 *
 * @param id 삭제 대상 분석 뷰 고유 식별자(UUID)
 * @returns 삭제 처리된 AnalysisView 엔티티 프로미스
 */
export const deleteAnalysisView = (id: string): Promise<AnalysisView> =>
  httpClient.delete<AnalysisView>(`/api/v1/analysis-views/${id}`);

/**
 * 분석 뷰 발행 상태 토글을 위한 공용 TanStack Mutation 훅
 */
export const usePublishAnalysisViewMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<AnalysisView, HttpErrorData, { id: string; isPublished?: boolean }>({
    mutationFn: ({ id, isPublished = true }) => publishAnalysisView(id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analysisViewKeys.all });
    },
  });
};

/**
 * 분석 뷰 단건 소프트 삭제를 위한 공용 TanStack Mutation 훅
 */
export const useDeleteAnalysisViewMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<AnalysisView, HttpErrorData, string>({
    mutationFn: (id: string) => deleteAnalysisView(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analysisViewKeys.all });
    },
  });
};
