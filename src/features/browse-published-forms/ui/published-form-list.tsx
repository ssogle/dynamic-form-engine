"use client";

import Link from "next/link";
import { usePublishedFormsQuery } from "@/entities/form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

/**
 * 컨슈머 포털(/consumer)에 공식 발행된 폼 목록을 카드 그리드로 나열하는 컴포넌트
 *
 * 카드를 클릭하면 해당 폼의 데이터 목록(/consumer/forms/[id])으로 이동합니다.
 */
export function PublishedFormList() {
  const { data: publishedForms, isLoading, isError, error } = usePublishedFormsQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="border-border/60 shadow-xs">
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader>
          <CardTitle className="text-destructive text-base">
            폼 목록을 불러오지 못했습니다
          </CardTitle>
          <CardDescription className="text-destructive/80 text-sm">
            {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!publishedForms || publishedForms.length === 0) {
    return (
      <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold">
            현재 이용 가능한 데이터 폼이 없습니다
          </CardTitle>
          <CardDescription className="text-muted-foreground mx-auto max-w-md text-xs/relaxed">
            관리자가 데이터 도메인 폼을 공식 발행하면 이곳에 자동으로 노출됩니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {publishedForms.map((form) => (
        <Link
          key={form.id}
          href={`/consumer/forms/${form.id}`}
          className="group block focus-visible:outline-hidden"
        >
          <Card className="border-border/60 group-hover:border-primary/50 group-hover:bg-muted/30 flex h-full flex-col justify-between shadow-xs transition-all">
            <CardHeader className="space-y-1.5">
              <CardTitle className="group-hover:text-primary text-lg font-bold tracking-tight transition-colors">
                {form.title}
              </CardTitle>
              {form.description && (
                <CardDescription className="line-clamp-2 text-xs/relaxed">
                  {form.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
