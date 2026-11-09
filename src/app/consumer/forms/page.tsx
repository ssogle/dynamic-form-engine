"use client";

import * as React from "react";
import Link from "next/link";
import { usePublishedFormsQuery } from "@/entities/form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDate } from "@/shared/lib/date";

/**
 * 컨슈머 발행된 폼 목록 화면 (/consumer/forms)
 *
 * 공식 발행된 활성 폼 목록을 카드 그리드로 표시하며,
 * 각 폼으로 이동하여 신규 응답을 작성하거나 기존 제출 내역을 확인할 수 있습니다.
 */
export default function ConsumerFormsPage() {
  const { data: publishedForms, isLoading, isError, error } = usePublishedFormsQuery();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">참여 가능한 폼 목록</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          공식 발행되어 응답 제출이 가능한 폼 목록입니다. 원하는 폼을 선택하여 직접 작성하거나, 좌측
          AI Navigator에게 원하는 설문 내용을 말씀해 주시면 자율 입력을 도와드립니다.
        </p>
      </div>

      {/* 1. 로딩 상태 스켈레톤 그리드 */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="border-border/60 shadow-xs">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
              </CardHeader>
              <CardFooter className="pt-2">
                <Skeleton className="h-9 w-full rounded-md" />
              </CardFooter>
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

      {/* 4. 정상 폼 목록 카드 그리드 */}
      {!isLoading && !isError && publishedForms && publishedForms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {publishedForms.map((form) => (
            <Card
              key={form.id}
              className="border-border/60 hover:border-border flex flex-col justify-between shadow-xs transition-colors"
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="default" className="text-[10px]">
                    발행됨
                  </Badge>
                  <span className="text-muted-foreground font-mono text-xs">/{form.slug}</span>
                </div>
                <CardTitle className="text-lg font-bold tracking-tight">{form.title}</CardTitle>
                {form.description && (
                  <CardDescription className="line-clamp-2 text-xs/relaxed">
                    {form.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="text-muted-foreground pb-3 text-xs">
                발행일시: {formatDate(form.publishedAt)}
              </CardContent>

              <CardFooter className="flex items-center gap-2">
                <Button asChild className="flex-1 font-medium" size="sm">
                  <Link href={`/consumer/forms/${form.slug}`}>응답 작성하기</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/consumer/forms/${form.slug}/submissions`}>응답 내역</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
