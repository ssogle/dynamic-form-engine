"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Globe, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useAnalysisViewActions } from "../hooks/use-analysis-view-actions.hook";

export interface AnalysisViewActionBarProps {
  viewId: string;
}

/**
 * 분석 뷰 상세 캔버스 상단 제어 바 (목록 복귀, 최신 데이터 갱신, 발행 토글, Popover 삭제 확인)
 */
export function AnalysisViewActionBar({ viewId }: AnalysisViewActionBarProps) {
  const {
    view,
    isPublished,
    canPublish,
    canRefresh,
    actionErrorMessage,
    refreshStatusMessage,
    isPublishPending,
    isRefreshPending,
    isDeletePending,
    handleTogglePublish,
    handleRefresh,
    handleDelete,
  } = useAnalysisViewActions({ viewId });

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
          <Link href="/analyst/views">
            <ArrowLeft className="size-4" />
            분석 뷰 목록
          </Link>
        </Button>

        {view ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isRefreshPending || !canRefresh}
              onClick={handleRefresh}
            >
              <RefreshCw className={isRefreshPending ? "size-3.5 animate-spin" : "size-3.5"} />
              {isRefreshPending ? "AI 재집계 중..." : "최신 데이터로 갱신"}
            </Button>

            <Button
              type="button"
              variant={isPublished ? "outline" : "default"}
              size="sm"
              className="gap-1.5"
              disabled={isPublishPending || !canPublish}
              onClick={handleTogglePublish}
            >
              {isPublished ? (
                <>
                  <RotateCcw className="size-3.5" />
                  발행 취소 (초안)
                </>
              ) : (
                <>
                  <Globe className="size-3.5" />
                  공식 발행
                </>
              )}
            </Button>

            <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  삭제
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-medium">문서를 삭제할까요?</p>
                  <p className="text-muted-foreground text-xs">
                    삭제 후 분석 뷰 목록 화면으로 돌아갑니다.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isDeletePending}
                    onClick={async () => {
                      await handleDelete();
                      setConfirmOpen(false);
                    }}
                  >
                    삭제 확인
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>

      {refreshStatusMessage ? (
        <div className="border-border bg-muted/40 text-foreground rounded-lg border px-3 py-2 text-xs">
          {refreshStatusMessage}
        </div>
      ) : null}

      {actionErrorMessage ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-xs">
          {actionErrorMessage}
        </div>
      ) : null}
    </div>
  );
}
