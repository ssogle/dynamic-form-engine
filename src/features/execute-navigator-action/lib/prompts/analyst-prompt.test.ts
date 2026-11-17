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

  it("formatAnalystContextPrompt는 현재 분석 뷰 문서를 경량 요약(rows/data 제거, rowCount/dataCount 포함)하여 포함해야 한다", () => {
    const formatted = formatAnalystContextPrompt("맨 아래에 요약 문단 추가해줘", {
      currentPath: "/analyst/views/view-1",
      currentAnalysisView: {
        id: "view-1",
        title: "2월 매출 리포트",
        isPublished: false,
        blocks: [
          { id: "b1", type: "text", content: "초안 내용" },
          {
            id: "b2",
            type: "chart",
            title: "월별 추이",
            chartType: "bar",
            xAxisKey: "month",
            series: [{ key: "amount", label: "금액" }],
            data: [
              { month: "2026-01", amount: 1000 },
              { month: "2026-02", amount: 2000 },
            ],
          },
        ],
      },
      visibleAnalysisViews: [{ id: "view-1", title: "2월 매출 리포트", summary: "초안" }],
    });

    expect(formatted).toContain("현재 서버 기준 날짜(Asia/Seoul):");
    expect(formatted).toMatch(/현재 서버 기준 날짜\(Asia\/Seoul\): \d{4}-\d{2}-\d{2}/);
    expect(formatted).toContain("/analyst/views/view-1");
    expect(formatted).toContain("2월 매출 리포트");
    expect(formatted).toContain('"id":"view-1"');
    expect(formatted).toContain('"dataCount":2');
    expect(formatted).not.toContain('"amount":2000');
    expect(formatted).toContain("1. [ID: view-1] 2월 매출 리포트 (초안)");
  });

  it("시스템 프롬프트에 날짜 기준 축, filters/sourceLinks 기록 및 원천 목록 위임 가드레일이 포함되어야 한다", () => {
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("dateFieldId");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("filters");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("sourceLinks");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("/consumer/forms/[formId]");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("isTruncated");
    expect(ANALYST_NAVIGATOR_SYSTEM_PROMPT).toContain("includeKeys");
  });

  it("formatAnalystContextPrompt는 text 블록 본문을 1500자까지 보존하고 getFormDetails 확인 안내를 포함해야 한다", () => {
    const text600 = "가".repeat(600);
    const text1700 = "나".repeat(1700);

    const formatted = formatAnalystContextPrompt("최신 데이터로 갱신해줘", {
      currentPath: "/analyst/views/view-1",
      currentAnalysisView: {
        id: "view-1",
        title: "긴 요약 리포트",
        isPublished: false,
        blocks: [
          { id: "b1", type: "text", content: text600 },
          { id: "b2", type: "text", content: text1700 },
        ],
      },
    });

    expect(formatted).toContain(text600);
    expect(formatted).toContain(`${"나".repeat(1500)}...`);
    expect(formatted).not.toContain("나".repeat(1501));
    expect(formatted).toContain("getFormDetails({ formId })");
  });
});
