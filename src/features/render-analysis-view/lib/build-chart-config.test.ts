import { describe, expect, it } from "vitest";
import {
  buildChartConfig,
  buildPieChartSegments,
  DEFAULT_CHART_COLORS,
  formatTableCellValue,
} from "./build-chart-config";

describe("build-chart-config (render-analysis-view/lib)", () => {
  it("시리즈 정의를 shadcn ChartConfig로 변환하고 시맨틱 컬러를 순환 배정한다", () => {
    const config = buildChartConfig({
      series: [
        { key: "revenue", label: "매출" },
        { key: "cost", label: "비용" },
      ],
    });

    expect(config.revenue).toEqual({
      label: "매출",
      color: DEFAULT_CHART_COLORS[0],
    });
    expect(config.cost).toEqual({
      label: "비용",
      color: DEFAULT_CHART_COLORS[1],
    });
  });

  it("buildPieChartSegments는 null이나 0 이하 값을 제외하고 시맨틱 색상을 할당한다", () => {
    const segments = buildPieChartSegments({
      xAxisKey: "dept",
      series: [{ key: "ratio", label: "비중" }],
      data: [
        { dept: "개발팀", ratio: 60 },
        { dept: "운영팀", ratio: null },
        { dept: "디자인팀", ratio: 0 },
        { dept: "기획팀", ratio: 40 },
      ],
    });

    expect(segments).toEqual([
      { name: "개발팀", value: 60, fill: DEFAULT_CHART_COLORS[0] },
      { name: "기획팀", value: 40, fill: DEFAULT_CHART_COLORS[1] },
    ]);
  });

  it("formatTableCellValue는 null/undefined를 '-'로, 숫자를 천 단위 콤마 포맷으로 반환한다", () => {
    expect(formatTableCellValue(null)).toBe("-");
    expect(formatTableCellValue(undefined)).toBe("-");
    expect(formatTableCellValue(123456.78)).toBe("123,456.78");
    expect(formatTableCellValue("2026-02")).toBe("2026-02");
  });
});
