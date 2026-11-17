import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisView } from "../schema/analysis-view.schema";
import { analysisViewKeys } from "./analysis-view.keys";

/**
 * 분석 뷰 단건 상세 조회 API 호출 순수 함수
 *
 * @param viewId 분석 뷰 고유 식별자(UUID)
 * @param options publishedOnly가 true일 경우 발행된 문서만 허용
 * @returns AnalysisView 엔티티 프로미스
 */
export const getAnalysisViewDetail = (
  viewId: string,
  options?: { publishedOnly?: boolean }
): Promise<AnalysisView> =>
  httpClient.get<AnalysisView>(
    `/api/v1/analysis-views/${viewId}`,
    options?.publishedOnly ? { params: { published: true } } : undefined
  );

/**
 * 분석 뷰 단건 상세 조회 TanStack Query 훅
 *
 * @param viewId 분석 뷰 고유 식별자(UUID)
 * @param options enabled 또는 publishedOnly 옵션
 */
export const useAnalysisViewDetailQuery = (
  viewId: string,
  options?: { enabled?: boolean; publishedOnly?: boolean }
) => {
  const publishedOnly = options?.publishedOnly ?? false;
  return useQuery<AnalysisView, HttpErrorData>({
    queryKey: analysisViewKeys.detail(viewId, publishedOnly),
    queryFn: () => getAnalysisViewDetail(viewId, { publishedOnly }),
    enabled: options?.enabled ?? Boolean(viewId),
  });
};
