"use client";

import * as React from "react";
import Link from "next/link";
import { FileBarChart2, Globe, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { extractAnalysisBlocks } from "@/entities/analysis-view";
import { formatDate } from "@/shared/lib/date";
import { dispatchFocusNavigator } from "@/shared/lib/navigator-focus";
import { Button } from "@/shared/ui/button";
import { PublishStatusBadge } from "@/shared/ui/publish-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Skeleton } from "@/shared/ui/skeleton";
import { useAnalysisViewList } from "../hooks/use-analysis-view-list.hook";

/**
 * 분석가 작업 공간(/analyst/views)의 전체 분석 뷰 목록 및 발행/삭제 제어 카드 리스트
 */
export function AnalysisViewList() {
  const {
    views,
    isLoading,
    isError,
    error,
    actionErrorMessage,
    isPublishPending,
    isDeletePending,
    handleTogglePublish,
    handleDeleteView,
  } = useAnalysisViewList();

  const [openDeleteId, setOpenDeleteId] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">분석 뷰 문서 목록</CardTitle>
            <span className="text-muted-foreground text-xs">불러오는 중...</span>
          </div>
          <CardDescription>저장된 분석 리포트 목록을 로드하고 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40 w-full">
        <CardHeader>
          <CardTitle className="text-destructive text-base font-semibold">
            분석 뷰 목록을 불러오지 못했습니다
          </CardTitle>
          <CardDescription>
            {error?.message ?? "서버와의 통신 중 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!views || views.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">분석 뷰 문서 목록</CardTitle>
          <CardDescription>
            AI Analyst Navigator와 함께 작성한 분석 리포트 문서가 이곳에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileBarChart2 className="text-muted-foreground/60 mb-3 size-10" />
          <p className="text-foreground text-sm font-medium">등록된 분석 뷰가 없습니다.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Analyst AI Navigator에게 폼 데이터 비교·집계 및 새 분석 뷰 작성을 요청해 보세요.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5 text-xs"
            onClick={() => dispatchFocusNavigator({ prefillText: "분석 뷰를 새로 만들어줘: " })}
          >
            <Sparkles className="text-primary size-3.5" />
            AI에게 분석 뷰 요청하기
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => dispatchFocusNavigator({ prefillText: "분석 뷰를 새로 만들어줘: " })}
        >
          <Sparkles className="text-primary size-3.5" />
          AI에게 새 분석 뷰 요청
        </Button>
      </div>

      {actionErrorMessage ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {actionErrorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {views.map((view) => {
          const blockCount = extractAnalysisBlocks(view).length;
          const isPublished = Boolean(view.publishedAt);
          const cannotPublish = !isPublished && blockCount === 0;

          return (
            <Card key={view.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/analyst/views/${view.id}`}
                    className="text-foreground line-clamp-1 text-base font-semibold hover:underline"
                  >
                    {view.title}
                  </Link>
                  <PublishStatusBadge isPublished={isPublished} />
                </div>
                <CardDescription className="line-clamp-2 min-h-10">
                  {view.description || "설명이 등록되지 않은 분석 뷰 문서입니다."}
                </CardDescription>
              </CardHeader>

              <CardContent className="text-muted-foreground pb-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>구성 블록 {blockCount}개</span>
                  {view.publishedAt ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatDate(view.publishedAt)} 발행
                    </span>
                  ) : (
                    <span>수정: {formatDate(view.updatedAt) || "-"}</span>
                  )}
                </div>
              </CardContent>

              <CardFooter className="border-border flex items-center justify-between gap-2 border-t pt-3">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/analyst/views/${view.id}`}>문서 열기</Link>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={isPublished ? "outline" : "default"}
                    size="sm"
                    className="gap-1.5"
                    disabled={isPublishPending || cannotPublish}
                    onClick={() => handleTogglePublish(view.id, !isPublished)}
                  >
                    {isPublished ? (
                      <>
                        <RotateCcw className="size-3.5" />
                        발행 취소
                      </>
                    ) : (
                      <>
                        <Globe className="size-3.5" />
                        공식 발행
                      </>
                    )}
                  </Button>

                  <Popover
                    open={openDeleteId === view.id}
                    onOpenChange={(open) => setOpenDeleteId(open ? view.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8"
                        aria-label="분석 뷰 삭제"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 space-y-3">
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">분석 뷰를 삭제할까요?</p>
                        <p className="text-muted-foreground text-xs">
                          &apos;{view.title}&apos; 문서가 보관함에서 제외됩니다.
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOpenDeleteId(null)}
                        >
                          취소
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isDeletePending}
                          onClick={async () => {
                            await handleDeleteView(view.id);
                            setOpenDeleteId(null);
                          }}
                        >
                          삭제 확인
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
