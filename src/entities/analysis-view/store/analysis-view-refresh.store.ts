import { create } from "zustand";

/**
 * 분석 뷰 캔버스([최신 데이터로 갱신] 버튼)에서 좌측 Analyst AI Navigator로 전달하는
 * 최신 재집계 요청 페이로드
 */
export interface PendingAnalysisRefreshRequest {
  viewId: string;
  viewTitle: string;
  prompt: string;
  requestedAt: number;
}

export interface AnalysisViewRefreshState {
  pendingRefresh: PendingAnalysisRefreshRequest | null;
  isRefreshingByAi: boolean;
  requestAiRefresh: (request: PendingAnalysisRefreshRequest) => void;
  clearPendingRefresh: () => void;
  setIsRefreshingByAi: (isRefreshing: boolean) => void;
}

/**
 * Analyst AI에게 현재 열린 분석 뷰를 최신 DB 데이터 기준으로 재집계하도록 요청하는 표준 프롬프트 생성기
 */
export function buildAnalysisViewRefreshPrompt(view: { id: string; title: string }): string {
  return [
    `현재 열려 있는 분석 뷰('${view.title}', ID: ${view.id})를 최신 DB 데이터로 갱신해 주세요.`,
    "기존 문서의 분석 대상 폼, 조회 기간, 필터 조건, 블록 구성을 유지한 채 'aggregateFormSubmissions'로 최신 수치를 다시 집계하고,",
    "'SET_ALL_BLOCKS' 한 번으로 요약 글(text), 표(table), 차트(chart), 출처 링크(sourceLinks) 전체를 최신 값으로 일괄 업데이트해 주세요.",
  ].join(" ");
}

/**
 * 분석 뷰 상단 제어 바(features/manage-analysis-views)와 좌측 AI 패널(widgets/navigator-shell) 간
 * FSD 경계를 위반하지 않고 AI 기반 재집계 트리거 및 진행 상태를 동기화하는 경량 Zustand 스토어
 */
export const useAnalysisViewRefreshStore = create<AnalysisViewRefreshState>()((set) => ({
  pendingRefresh: null,
  isRefreshingByAi: false,

  requestAiRefresh: (request) => set({ pendingRefresh: request }),

  clearPendingRefresh: () => set({ pendingRefresh: null }),

  setIsRefreshingByAi: (isRefreshingByAi) => set({ isRefreshingByAi }),
}));
