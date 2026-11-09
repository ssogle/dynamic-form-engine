"use client";

import * as React from "react";
import Link from "next/link";
import { useFormDetailQuery } from "@/entities/form";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { SubmissionListTable } from "./submission-list-table";

export interface ManageFormSubmissionsProps {
  /**
   * 대상 폼 식별자 (슬러그)
   */
  slug: string;
}

/**
 * 컨슈머 폼 응답 목록 열람 및 관리 피처 컴포넌트 (ManageFormSubmissions)
 *
 * 특정 폼의 상세 정보와 제출된 모든 응답 데이터를 조회하고,
 * 각 응답의 열람, 수정 전용 화면 이동, 삭제 인터랙션을 종합적으로 제공하는 자립형 기능 컴포넌트입니다.
 */
export function ManageFormSubmissions({ slug }: ManageFormSubmissionsProps) {
  const { data: form, isLoading, isError, error } = useFormDetailQuery(slug);

  // 1. 로딩 상태 스켈레톤
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  // 2. 에러 상태
  if (isError || !form) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader>
          <CardTitle className="text-destructive text-base">폼을 불러오지 못했습니다</CardTitle>
          <CardDescription className="text-destructive/80 text-sm">
            {error instanceof Error ? error.message : "존재하지 않거나 삭제된 폼입니다."}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" size="sm">
            <Link href="/consumer/forms">폼 목록으로 이동</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // 3. 정상 응답 목록 및 헤더
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          [{form.title}] 제출 내역
        </h1>
        <p className="text-muted-foreground text-xs">
          총 등록된 제출 데이터 목록입니다. 각 응답 데이터를 직접 확인하고 수정하거나 삭제할 수
          있습니다.
        </p>
      </div>

      <SubmissionListTable form={form} />
    </div>
  );
}
