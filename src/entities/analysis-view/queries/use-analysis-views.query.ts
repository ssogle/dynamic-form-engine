import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisView } from "../schema/analysis-view.schema";
import { analysisViewKeys } from "./analysis-view.keys";

/**
 * 활성 분석 뷰 전체 목록 조회 API 호출 순수 함수
 *
 * @returns AnalysisView[] 목록 프로미스
 */
export const getAnalysisViews = (): Promise<AnalysisView[]> =>
  httpClient.get<AnalysisView[]>("/api/v1/analysis-views");

/**
 * 분석가 워크스페이스용 활성 분석 뷰 목록 조회 TanStack Query 훅
 */
export const useAnalysisViewsQuery = () =>
  useQuery<AnalysisView[], HttpErrorData>({
    queryKey: analysisViewKeys.lists(),
    queryFn: getAnalysisViews,
  });
