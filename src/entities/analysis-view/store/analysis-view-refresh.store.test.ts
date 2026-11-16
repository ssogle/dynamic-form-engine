import { describe, expect, it } from "vitest";
import {
  buildAnalysisViewRefreshPrompt,
  useAnalysisViewRefreshStore,
} from "./analysis-view-refresh.store";

describe("analysis-view-refresh.store (entities/analysis-view/store)", () => {
  it("buildAnalysisViewRefreshPrompt는 대상 뷰 제목/ID와 SET_ALL_BLOCKS 일괄 갱신 지침을 포함해야 한다", () => {
    const prompt = buildAnalysisViewRefreshPrompt({
      id: "view-123",
      title: "프로젝트 A 비용 리포트",
    });

    expect(prompt).toContain("프로젝트 A 비용 리포트");
    expect(prompt).toContain("view-123");
    expect(prompt).toContain("aggregateFormSubmissions");
    expect(prompt).toContain("SET_ALL_BLOCKS");
  });

  it("requestAiRefresh, clearPendingRefresh, setIsRefreshingByAi가 스토어 상태를 정상 전환해야 한다", () => {
    useAnalysisViewRefreshStore.setState({ pendingRefresh: null, isRefreshingByAi: false });

    const req = {
      viewId: "view-1",
      viewTitle: "테스트 뷰",
      prompt: "최신화 요청",
      requestedAt: 1000,
    };
    useAnalysisViewRefreshStore.getState().requestAiRefresh(req);
    expect(useAnalysisViewRefreshStore.getState().pendingRefresh).toEqual(req);

    useAnalysisViewRefreshStore.getState().setIsRefreshingByAi(true);
    expect(useAnalysisViewRefreshStore.getState().isRefreshingByAi).toBe(true);

    useAnalysisViewRefreshStore.getState().clearPendingRefresh();
    expect(useAnalysisViewRefreshStore.getState().pendingRefresh).toBeNull();
  });
});
