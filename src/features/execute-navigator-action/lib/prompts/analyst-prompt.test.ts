import { describe, expect, it } from "vitest";
import { ANALYST_NAVIGATOR_SYSTEM_PROMPT, formatAnalystContextPrompt } from "./analyst-prompt";

describe("analyst-prompt (features/execute-navigator-action/lib/prompts)", () => {
  it("시스템 프롬프트에 서버 집계 우선, Zero-fill Union, computeSeriesMetric 분모 0 null 규칙이 포함되어야 한다", () => {
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("aggregateFormSubmissions");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("computeSeriesMetric");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("baseSeries");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("targetSeries");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("null");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("Zero-fill");
  });

  it("시스템 프롬프트에 pie 차트 카테고리 상한 안내와 부분 오퍼레이션 우선 원칙이 포함되어야 한다", () => {
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("pie");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("6개");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("ADD_BLOCK");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("UPDATE_BLOCK");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("SET_ALL_BLOCKS");
  });

  it("formatAnalystContextPrompt는 현재 분석 뷰 문서와 목록 캐시 요약을 포함해야 한다", () => {
    const formatted = formatAnalystContextPrompt("맨 아래에 요약 문단 추가해줘", {
      currentPath: "/analyst/views/view-1",
      currentAnalysisView: {
        id: "view-1",
        title: "2월 매출 리포트",
        isPublished: false,
        blocks: [{ id: "b1", type: "text", content: "초안 내용" }],
      },
      visibleAnalysisViews: [{ id: "view-1", title: "2월 매출 리포트", summary: "초안" }],
    });

    expect(formatted).toContain("/analyst/views/view-1");
    expect(formatted).toContain("2월 매출 리포트");
    expect(formatted).toContain('"id":"view-1"');
    expect(formatted).toContain("1. [ID: view-1] 2월 매출 리포트 (초안)");
  });
});
