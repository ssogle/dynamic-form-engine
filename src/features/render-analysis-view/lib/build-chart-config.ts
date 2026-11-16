import type { ChartAnalysisBlock } from "@/entities/analysis-view";
import type { ChartConfig } from "@/shared/ui/chart";

/**
 * Tailwind/shadcn 기본 차트 시맨틱 CSS 변수 팔레트 (8색 유채색 토큰)
 */
export const DEFAULT_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/**
 * 8개 시맨틱 팔레트를 초과하는 다중 시리즈/파이 조각에서 색상이 중복되지 않도록
 * 황금각(Golden Angle, 137.508deg) 기반으로 회전하는 결정론적 oklch 색상을 생성합니다.
 */
const GOLDEN_ANGLE_DEGREES = 137.508;

/**
 * 시리즈/세그먼트 인덱스에 해당하는 차트 색상을 반환합니다.
 * - 0~7: 테마 시맨틱 변수(`var(--chart-1)` .. `var(--chart-8)`) 사용
 * - 8 이상: 황금각 기반 동적 oklch 색상 생성 (반복 순환 방지)
 *
 * @param index 0부터 시작하는 시리즈 또는 세그먼트 인덱스
 * @returns CSS color 문자열
 */
export function resolveChartColor(index: number): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  const tokenColor = DEFAULT_CHART_COLORS[safeIndex];
  if (tokenColor) {
    return tokenColor;
  }

  const overflowOffset = safeIndex - DEFAULT_CHART_COLORS.length;
  const hue = Number(((25 + overflowOffset * GOLDEN_ANGLE_DEGREES) % 360).toFixed(1));
  return `oklch(0.63 0.17 ${hue})`;
}

/**
 * 파이 차트 렌더링용 정제 세그먼트 항목
 */
export interface PieChartSegment {
  name: string;
  value: number;
  fill: string;
}

/**
 * ChartAnalysisBlock의 series 정의를 shadcn ChartContainer 호환 ChartConfig 객체로 변환합니다.
 * 사용자 지정 색상이 없는 시리즈는 `--chart-1` ~ `--chart-5` 시맨틱 컬러를 순환 배정합니다.
 */
export function buildChartConfig(block: Pick<ChartAnalysisBlock, "series">): ChartConfig {
  const config: ChartConfig = {};

  block.series.forEach((s, index) => {
    const color = resolveChartColor(index);
    config[s.key] = {
      label: s.label,
      color,
    };
  });

  return config;
}

/**
 * 파이 차트 렌더링을 위해 첫 번째 시리즈 기준 유효(> 0, non-null) 세그먼트를 추출합니다.
 */
export function buildPieChartSegments(
  block: Pick<ChartAnalysisBlock, "xAxisKey" | "series" | "data">
): PieChartSegment[] {
  const primarySeries = block.series[0];
  if (!primarySeries) {
    return [];
  }

  return block.data.reduce<PieChartSegment[]>((acc, row, index) => {
    const rawValue = row[primarySeries.key];
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
      return acc;
    }

    const rawName = row[block.xAxisKey];
    const name = rawName !== null && rawName !== undefined ? String(rawName) : `항목 ${index + 1}`;
    const fill = resolveChartColor(acc.length);

    acc.push({ name, value: rawValue, fill });
    return acc;
  }, []);
}

/**
 * 테이블/툴팁 셀 값을 사람이 읽기 쉬운 문자열로 변환합니다.
 * 비율 계산 불능(`null`) 또는 누락(`undefined`)은 안전하게 `"-"`로 표시합니다.
 */
export function formatTableCellValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("ko-KR") : "-";
  }
  return value;
}
