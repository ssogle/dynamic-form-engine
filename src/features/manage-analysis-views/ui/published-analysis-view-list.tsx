"use client";

import Link from "next/link";
import { FileBarChart2 } from "lucide-react";
import { extractAnalysisBlocks, usePublishedAnalysisViewsQuery } from "@/entities/analysis-view";
import { formatDate } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

/**
 * 컨슈머 포털(/consumer)에 공식 발행된 분석 뷰만 읽기 전용으로 나열하는 목록 컴포넌트
 */
export function PublishedAnalysisViewList() {
  const { data: views, isLoading, isError, error } = usePublishedAnalysisViewsQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base font-semibold">
            공개된 분석 뷰를 불러오지 못했습니다
          </CardTitle>
          <CardDescription>{error?.message ?? "잠시 후 다시 시도해 주세요."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!views || views.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <FileBarChart2 className="text-muted-foreground/60 mb-3 size-10" />
          <p className="text-foreground text-sm font-medium">현재 공개된 분석 뷰가 없습니다.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            분석가가 공식 발행한 리포트 문서가 이곳에 공유됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {views.map((view) => {
        const blockCount = extractAnalysisBlocks(view).length;

        return (
          <Card key={view.id} className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="line-clamp-1 text-base font-semibold">{view.title}</CardTitle>
                <Badge variant="default">공개 리포트</Badge>
              </div>
              <CardDescription className="line-clamp-2 min-h-10">
                {view.description || "공유된 분석 리포트 문서입니다."}
              </CardDescription>
            </CardHeader>

            <CardContent className="text-muted-foreground pb-3 text-xs">
              <div className="flex items-center justify-between">
                <span>콘텐츠 블록 {blockCount}개</span>
                <span>발행: {formatDate(view.publishedAt) || "-"}</span>
              </div>
            </CardContent>

            <CardFooter className="border-border border-t pt-3">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/consumer/views/${view.id}`}>분석 리포트 보기</Link>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
