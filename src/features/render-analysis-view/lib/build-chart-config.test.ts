import { describe, expect, it } from "vitest";
import {
  buildChartConfig,
  buildPieChartSegments,
  DEFAULT_CHART_COLORS,
  formatTableCellValue,
  resolveChartColor,
} from "./build-chart-config";

describe("build-chart-config (render-analysis-view/lib)", () => {
  it("시리즈 정의를 shadcn ChartConfig로 변환하고 시맨틱 컬러를 배정한다", () => {
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

  it("8개 시맨틱 토큰을 초과하는 시리즈/항목에는 반복 대신 황금각 동적 oklch 색상을 생성한다", () => {
    const colors = Array.from({ length: 16 }, (_, index) => resolveChartColor(index));

    expect(DEFAULT_CHART_COLORS).toHaveLength(8);
    expect(colors.slice(0, 8)).toEqual([...DEFAULT_CHART_COLORS]);
    colors.slice(8).forEach((color) => {
      expect(color).toMatch(/^oklch\(/);
    });
    expect(new Set(colors).size).toBe(16);

    const manySeriesConfig = buildChartConfig({
      series: Array.from({ length: 12 }, (_, index) => ({
        key: `series_${index}`,
        label: `항목 ${index}`,
      })),
    });
    const assignedColors = Object.values(manySeriesConfig).map((entry) => entry.color);
    expect(new Set(assignedColors).size).toBe(12);
    expect(assignedColors[8]).not.toBe(assignedColors[0]);
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
