"use client";

import * as React from "react";
import Link from "next/link";
import { useFormDetailQuery } from "@/entities/form";
import type {
  FormSubmission,
  SortItem,
  SubmissionDateRangeFilter,
} from "@/entities/form-submission";
import type { FieldFilterCondition } from "@/shared/schema";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import type { FormSubmissionViewMode } from "../types/submission-view.types";
import { SubmissionListTable } from "./submission-list-table";

export interface ManageFormSubmissionsProps {
  /**
   * 대상 폼 식별자 (UUID)
   */
  formId: string;
  /**
   * 분석 뷰 드릴다운 등에서 URL 쿼리로 전달된 초기 기간 필터
   */
  initialDateRange?: SubmissionDateRangeFilter | undefined;
  /**
   * 분석 뷰 드릴다운 등에서 URL 쿼리로 전달된 초기 컬럼 필터 목록
   */
  initialFilters?: FieldFilterCondition[] | undefined;
  /**
   * URL 쿼리 파라미터로부터 전달된 초기 정렬 조건 목록
   */
  initialSort?: SortItem[] | undefined;
  /**
   * 목록 동작 모드 (기본값: "consumer")
   */
  mode?: FormSubmissionViewMode | undefined;
  /**
   * 프리뷰 모드에서 실데이터 0건 시 폴백으로 표시할 가상 샘플 레코드 목록
   */
  sampleSubmissions?: FormSubmission[] | undefined;
  /**
   * 프리뷰 모드에서 행/상세 클릭 시 호출할 인라인 콜백
   */
  onSelectSubmission?: ((submissionId: string) => void) | undefined;
}

/**
 * 컨슈머 폼 응답 목록 열람 및 관리 피처 컴포넌트 (ManageFormSubmissions)
 *
 * 특정 폼의 상세 정보와 제출된 모든 응답 데이터를 조회하고,
 * 각 응답의 열람, 수정 전용 화면 이동, 삭제 인터랙션을 종합적으로 제공하는 자립형 기능 컴포넌트입니다.
 */
export function ManageFormSubmissions({
  formId,
  initialDateRange,
  initialFilters,
  initialSort,
  mode = "consumer",
  sampleSubmissions,
  onSelectSubmission,
}: ManageFormSubmissionsProps) {
  const { data: form, isLoading, isError, error } = useFormDetailQuery(formId);

  // 1. 서버 SSR 및 클라이언트 초기 하이드레이션, 데이터 로딩 단계 스켈레톤
  if (isLoading || (!form && !isError)) {
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

  // 2. 에러 상태 (에러 확정 또는 로딩 완료 후에도 폼 부재)
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
            <Link href={mode === "preview" ? "/builder/forms" : "/consumer"}>목록으로 이동</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // 3. 정상 응답 목록 (프리뷰 모드에서는 페이지 타이틀을 생략하고 테이블만 렌더링)
  return (
    <div className="space-y-6">
      {mode !== "preview" && (
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            [{form.title}] 데이터 목록
          </h1>
          <p className="text-muted-foreground text-xs">
            등록된 데이터 레코드 목록입니다. 컬럼 헤더를 클릭하여 다중 정렬하거나, 필터 아이콘으로
            컬럼별 검색 및 가로 스크롤을 이용할 수 있습니다.
          </p>
        </div>
      )}

      <SubmissionListTable
        form={form}
        initialDateRange={initialDateRange}
        initialFilters={initialFilters}
        initialSort={initialSort}
        mode={mode}
        sampleSubmissions={sampleSubmissions}
        onSelectSubmission={onSelectSubmission}
      />
    </div>
  );
}
