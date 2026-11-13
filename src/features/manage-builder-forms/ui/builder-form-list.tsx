"use client";

import React from "react";
import Link from "next/link";
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
import { formatDate } from "@/shared/lib/date";
import { useBuilderFormList } from "../hooks/use-builder-form-list.hook";

/**
 * 빌더 전용 폼 목록 열람 및 소프트 삭제 기능 컴포넌트 (BuilderFormList)
 *
 * 데이터베이스에 저장된 모든 활성 폼의 슬러그, 메타데이터, 발행 상태를 카드 형태로 표시합니다.
 * 비즈니스 로직(목록 쿼리, 발행 상태 토글, 삭제 뮤테이션 등)은 useBuilderFormList 훅에 전담 위임하는 순수 얇은 뷰(Thin View)입니다.
 */
export function BuilderFormList() {
  const {
    forms,
    isLoading,
    isError,
    error,
    isPublishPending,
    isDeletePending,
    handleTogglePublish,
    handleDeleteForm,
  } = useBuilderFormList();

  /* 1. 로딩 상태: shadcn Skeleton 컴포넌트 활용 */
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">폼 메타데이터 목록</CardTitle>
            <span className="text-muted-foreground text-xs">폼 목록을 불러오는 중...</span>
          </div>
          <CardDescription>
            데이터베이스로부터 등록된 폼 스키마를 로드하고 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  /* 2. 에러 상태 */
  if (isError) {
    return (
      <Card className="border-destructive/40 w-full">
        <CardHeader>
          <CardTitle className="text-destructive text-base font-semibold">
            폼 목록을 불러오지 못했습니다
          </CardTitle>
          <CardDescription>
            {error?.message ?? "서버와의 통신 중 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  /* 3. 빈 목록 상태 */
  if (!forms || forms.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">폼 메타데이터 목록</CardTitle>
          <CardDescription>
            동적으로 생성된 폼의 스키마와 메타데이터가 이곳에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground text-sm">등록된 폼이 없습니다.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            AI Navigator 대화창에 자연어로 새로운 폼 생성을 요청해 보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  /* 4. 데이터 목록 및 인터랙션 상태 */
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">폼 메타데이터 목록</CardTitle>
        </div>
        <CardDescription>
          현재 데이터베이스에 저장된 활성 폼 총 {forms.length}개입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {forms.map((form) => (
          <div
            key={form.id}
            className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-semibold">{form.title}</span>
                {form.publishedAt ? (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 text-[10px] hover:bg-emerald-700"
                  >
                    발행됨
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    초안
                  </Badge>
                )}
              </div>
            </div>
            {form.description ? (
              <p className="text-muted-foreground text-xs/relaxed">{form.description}</p>
            ) : null}
            <div className="text-muted-foreground/80 mt-1 flex items-center justify-between text-[11px]">
              <span>
                ID: {form.id}
                {form.publishedAt ? (
                  <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">
                    · {formatDate(form.publishedAt)} 발행
                  </span>
                ) : (
                  <span className="text-muted-foreground ml-2">· 미발행 초안</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant={form.publishedAt ? "outline" : "default"}
                  onClick={() => handleTogglePublish(form.id, !form.publishedAt)}
                  disabled={isPublishPending}
                >
                  {form.publishedAt ? "발행 취소" : "발행"}
                </Button>
                <Button size="xs" variant="outline" asChild>
                  <Link href={`/builder/forms/${form.id}`}>캔버스 열기</Link>
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteForm(form.id)}
                  disabled={isDeletePending}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="text-muted-foreground border-t pt-3 text-xs">
        Drizzle ORM 및 Supabase Transaction Pooler를 통해 실시간 동기화됩니다.
      </CardFooter>
    </Card>
  );
}
