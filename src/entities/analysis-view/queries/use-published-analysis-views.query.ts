import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisView } from "../schema/analysis-view.schema";
import { analysisViewKeys } from "./analysis-view.keys";

/**
 * 공식 발행된 분석 뷰 목록 조회 API 호출 순수 함수
 *
 * @returns 발행 완료된 AnalysisView[] 목록 프로미스
 */
export const getPublishedAnalysisViews = (): Promise<AnalysisView[]> =>
  httpClient.get<AnalysisView[]>("/api/v1/analysis-views", {
    params: { published: true },
  });

/**
 * 컨슈머 포털(`/consumer/views`)용 발행 완료 분석 뷰 목록 조회 TanStack Query 훅
 */
export const usePublishedAnalysisViewsQuery = () =>
  useQuery<AnalysisView[], HttpErrorData>({
    queryKey: analysisViewKeys.publishedLists(),
    queryFn: getPublishedAnalysisViews,
  });
