"use client";

import * as React from "react";
import { FileBarChart2 } from "lucide-react";
import {
  extractAnalysisBlocks,
  useAnalysisViewDetailQuery,
  type AnalysisView,
} from "@/entities/analysis-view";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { ChartBlockRenderer } from "./chart-block-renderer";
import { TableBlockRenderer } from "./table-block-renderer";
import { TextBlockRenderer } from "./text-block-renderer";

export interface AnalysisViewRendererProps {
  /** 서버에서 단건 상세를 자동 조회할 때 전달하는 분석 뷰 ID */
  viewId?: string;
  /** true일 경우 발행된 문서만 조회 허용 (컨슈머 포털 전용) */
  publishedOnly?: boolean;
  /** 외부에서 이미 조회된 분석 뷰를 직접 주입할 때 사용 */
  view?: AnalysisView | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  headerActions?: React.ReactNode;
}

/**
 * 블록 기반 분석 뷰 문서 전체를 렌더링하는 순수 프레젠테이션 오케스트레이터
 */
export function AnalysisViewRenderer({
  viewId,
  publishedOnly = false,
  view: viewProp,
  isLoading: isLoadingProp = false,
  isError: isErrorProp = false,
  errorMessage: errorMessageProp,
  headerActions,
}: AnalysisViewRendererProps) {
  const detailQuery = useAnalysisViewDetailQuery(viewId ?? "", {
    enabled: Boolean(viewId) && viewProp === undefined,
    publishedOnly,
  });

  const view = viewProp !== undefined ? viewProp : detailQuery.data;
  const isLoading =
    isLoadingProp || (Boolean(viewId) && viewProp === undefined && detailQuery.isLoading);
  const isError = isErrorProp || (Boolean(viewId) && viewProp === undefined && detailQuery.isError);
  const errorMessage = errorMessageProp ?? detailQuery.error?.message;
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-6 text-sm">
        {errorMessage || "분석 뷰 문서를 불러오는 중 오류가 발생했습니다."}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <FileBarChart2 className="text-muted-foreground/60 mb-3 size-10" />
        <p className="text-foreground text-sm font-medium">분석 뷰를 찾을 수 없습니다.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          삭제되었거나 아직 발행되지 않은 문서일 수 있습니다.
        </p>
      </div>
    );
  }

  const blocks = extractAnalysisBlocks(view);
  const isPublished = Boolean(view.publishedAt);

  return (
    <article className="space-y-6">
      <header className="border-border flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">{view.title}</h1>
            <Badge variant={isPublished ? "default" : "secondary"}>
              {isPublished ? "발행됨" : "초안"}
            </Badge>
          </div>
          {view.description ? (
            <p className="text-muted-foreground text-sm">{view.description}</p>
          ) : null}
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span className="text-foreground/80 font-medium">
              데이터 기준 시각: {formatDateTime(view.updatedAt) || "-"}
            </span>
            {view.publishedAt ? (
              <span>발행 일시: {formatDateTime(view.publishedAt) || "-"}</span>
            ) : null}
          </div>
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
        ) : null}
      </header>

      {publishedOnly ? (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border px-3.5 py-2 text-xs">
          저장된 스냅샷 리포트입니다. 각 블록 하단의 원천 데이터 링크를 통해 실시간 상세 내역을 바로
          확인할 수 있습니다.
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <FileBarChart2 className="text-muted-foreground/60 mb-3 size-10" />
          <p className="text-foreground text-sm font-medium">아직 작성된 분석 블록이 없습니다.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            우측 Analyst AI Navigator에게 데이터 집계 및 차트/표 블록 추가를 요청해 보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {blocks.map((block) => {
            switch (block.type) {
              case "text":
                return <TextBlockRenderer key={block.id} block={block} />;
              case "table":
                return <TableBlockRenderer key={block.id} block={block} />;
              case "chart":
                return <ChartBlockRenderer key={block.id} block={block} />;
            }
          })}
        </div>
      )}
    </article>
  );
}
