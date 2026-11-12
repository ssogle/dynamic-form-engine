"use client";

import * as React from "react";
import Link from "next/link";
import { usePublishedFormsQuery } from "@/entities/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

/**
 * 컨슈머 발행된 폼 목록 화면 (/consumer/forms)
 *
 * 공식 발행된 활성 폼 목록을 카드 그리드로 표시하며,
 * 카드를 클릭하여 해당 폼의 데이터 목록(/consumer/forms/[id])으로 즉시 이동합니다.
 */
export default function ConsumerFormsPage() {
  const { data: publishedForms, isLoading, isError, error } = usePublishedFormsQuery();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">참여 가능한 폼 목록</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          공식 발행되어 응답 제출이 가능한 폼 목록입니다. 원하는 폼 카드를 선택하여 데이터 목록을
          확인하거나, 좌측 AI Navigator에게 원하는 설문 내용을 말씀해 주시면 자율 입력을
          도와드립니다.
        </p>
      </div>

      {/* 1. 로딩 상태 스켈레톤 그리드 */}
      {isLoading && (
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
      )}

      {/* 2. 에러 상태 */}
      {isError && (
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
      )}

      {/* 3. 빈 상태 */}
      {!isLoading && !isError && (!publishedForms || publishedForms.length === 0) && (
        <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base font-semibold">
              현재 참여 가능한 폼이 없습니다
            </CardTitle>
            <CardDescription className="text-muted-foreground mx-auto max-w-md text-xs/relaxed">
              빌더에서 새로운 폼을 생성하고 발행하면 이곳에 자동으로 노출됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/builder/forms">빌더에서 폼 만들기</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. 정상 폼 목록 카드 그리드 (카드 클릭 시 해당 폼의 데이터 목록으로 이동) */}
      {!isLoading && !isError && publishedForms && publishedForms.length > 0 && (
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
      )}
    </div>
  );
}
