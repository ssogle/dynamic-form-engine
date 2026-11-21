"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartAnalysisBlock } from "@/entities/analysis-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/chart";
import { buildChartConfig, buildPieChartSegments } from "../lib/build-chart-config";
import { BlockSourceLinksFooter } from "./block-source-links-footer";

export interface ChartBlockRendererProps {
  block: ChartAnalysisBlock;
  /** 카드 헤더 우측에 삽입할 추가 액션 (예: 분석가 캔버스 AI 수정 버튼) */
  headerAction?: React.ReactNode | undefined;
}

/**
 * 분석 뷰 문서의 Recharts/shadcn 시각화 차트 블록 렌더러 (`bar` | `line` | `pie`)
 */
export function ChartBlockRenderer({ block, headerAction }: ChartBlockRendererProps) {
  const chartConfig = React.useMemo(() => buildChartConfig(block), [block]);
  const pieSegments = React.useMemo(
    () => (block.chartType === "pie" ? buildPieChartSegments(block) : []),
    [block]
  );

  const hasChartData = block.chartType === "pie" ? pieSegments.length > 0 : block.data.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
          {block.description ? <CardDescription>{block.description}</CardDescription> : null}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent>
        {!hasChartData ? (
          <div className="border-border text-muted-foreground flex h-48 items-center justify-center rounded-md border border-dashed text-sm">
            시각화할 차트 데이터가 없습니다.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
            {block.chartType === "bar" ? (
              <BarChart data={block.data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey={block.xAxisKey} tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {block.series.map((s) => (
                  <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={4} />
                ))}
              </BarChart>
            ) : block.chartType === "line" ? (
              <LineChart data={block.data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey={block.xAxisKey} tickLine={false} tickMargin={8} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {block.series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={`var(--color-${s.key})`}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            ) : (
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie
                  data={pieSegments}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={92}
                  paddingAngle={2}
                />
              </PieChart>
            )}
          </ChartContainer>
        )}

        {block.chartType === "pie" && pieSegments.length > 0 ? (
          <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
            {pieSegments.map((seg) => (
              <div key={seg.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: seg.fill }}
                />
                <span>{seg.name}</span>
                <span className="text-foreground font-medium tabular-nums">
                  ({seg.value.toLocaleString("ko-KR")})
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
      <BlockSourceLinksFooter block={block} />
    </Card>
  );
}
