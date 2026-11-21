import * as React from "react";
import Link from "next/link";
import {
  isValidCalendarDate,
  parseSortParam,
  type SubmissionDateRangeFilter,
} from "@/entities/form-submission";
import { parseFieldFiltersParam } from "@/shared/schema";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { ManageFormSubmissions } from "@/features/manage-form-submissions";

interface ConsumerFormIdPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    startDate?: string | undefined;
    endDate?: string | undefined;
    dateFieldId?: string | undefined;
    filters?: string | undefined;
    sort?: string | undefined;
  }>;
}

/**
 * 컨슈머 데이터 도메인 레코드 목록 관리 페이지 (/consumer/forms/[id])
 *
 * 공식 발행된 활성 폼의 제출 데이터를 조회/검색/정렬하는 기본 메인 뷰포트입니다.
 * 분석 뷰의 `[원본 데이터 보기]` 링크로부터 전달된 `?startDate=...&endDate=...&dateFieldId=...&filters=...` 쿼리를 수용합니다.
 */
export default async function ConsumerFormIdPage({
  params,
  searchParams,
}: ConsumerFormIdPageProps) {
  const { id } = await params;
  const rawQuery = await searchParams;

  const validStartDate =
    rawQuery.startDate && isValidCalendarDate(rawQuery.startDate) ? rawQuery.startDate : undefined;
  const validEndDate =
    rawQuery.endDate && isValidCalendarDate(rawQuery.endDate) ? rawQuery.endDate : undefined;

  const initialDateRange: SubmissionDateRangeFilter | undefined =
    validStartDate || validEndDate
      ? {
          startDate: validStartDate,
          endDate: validEndDate,
          dateFieldId: rawQuery.dateFieldId?.trim() || undefined,
        }
      : undefined;

  const parsedFilters = parseFieldFiltersParam(rawQuery.filters);
  const initialFilters = parsedFilters.length > 0 ? parsedFilters : undefined;
  const initialSort =
    rawQuery.sort && rawQuery.sort.trim().length > 0 ? parseSortParam(rawQuery.sort) : undefined;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink href="/consumer" label="포털 목록으로" />

        <Button asChild size="sm">
          <Link href={`/consumer/forms/${id}/new`}>신규 데이터 작성</Link>
        </Button>
      </div>

      <ManageFormSubmissions
        formId={id}
        initialDateRange={initialDateRange}
        initialFilters={initialFilters}
        initialSort={initialSort}
      />
    </div>
  );
}
