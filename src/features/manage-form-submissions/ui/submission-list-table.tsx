"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { VirtualTable } from "@/shared/lib/virtual-table";
import type { Form } from "@/entities/form";
import type { FormSubmission, SubmissionDateRangeFilter } from "@/entities/form-submission";
import type { FieldFilterCondition } from "@/shared/schema";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { formatFilterConditionSummary, resolveFilterFieldLabel } from "../lib/filter-summary";
import type { FormSubmissionViewMode } from "../types/submission-view.types";
import { useSubmissionListTable, getColumnLabel } from "../hooks/use-submission-list-table.hook";

export interface SubmissionListTableProps {
  form: Form;
  initialDateRange?: SubmissionDateRangeFilter | undefined;
  initialFilters?: FieldFilterCondition[] | undefined;
  /** 테이블 동작 모드 (기본값: "consumer") */
  mode?: FormSubmissionViewMode | undefined;
  /** 프리뷰 모드에서 실데이터 0건 시 폴백으로 표시할 가상 샘플 레코드 목록 */
  sampleSubmissions?: FormSubmission[] | undefined;
  /** 프리뷰 모드에서 행/상세 클릭 시 호출할 인라인 콜백 */
  onSelectSubmission?: ((submissionId: string) => void) | undefined;
}

/**
 * 컨슈머 폼 응답 목록 가상화 테이블 컴포넌트 (SubmissionListTable)
 *
 * TanStack Table + TanStack Virtual 기반 고성능 가상화 무한 스크롤 데이터 테이블입니다.
 * 비즈니스 상태 및 이벤트 오케스트레이션 로직은 useSubmissionListTable 훅에 전담 위임하고,
 * 순수 뷰 렌더링(상단 툴바, 컬럼 가시성 드롭다운, 가상화 테이블 본문)만 담당하는 Thin View입니다.
 */
export function SubmissionListTable({
  form,
  initialDateRange,
  initialFilters,
  mode = "consumer",
  sampleSubmissions,
  onSelectSubmission,
}: SubmissionListTableProps) {
  const {
    table,
    flatSubmissions,
    totalCount,
    activeFields,
    columnFilters,
    relationLookupMap,
    dateRangeFilter,
    dateRangeFieldLabel,
    activeFilterCount,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    tableContainerRef,
    handleSetFieldFilter,
    handleClearAllFilters,
    handleClearDateRange,
    handleRowClick,
    isSamplePreview,
  } = useSubmissionListTable({
    form,
    initialDateRange,
    initialFilters,
    mode,
    sampleSubmissions,
    onSelectSubmission,
  });

  const relationNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const targetEntry of Object.values(relationLookupMap)) {
      for (const [subId, label] of Object.entries(targetEntry.labelsById)) {
        map.set(subId, label);
      }
    }
    return map;
  }, [relationLookupMap]);

  // 1. 초기 로딩 스켈레톤
  if (isLoading && flatSubmissions.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );
  }

  // 2. 에러 상태
  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader>
          <CardTitle className="text-destructive text-sm font-semibold">
            응답 데이터를 불러오지 못했습니다
          </CardTitle>
          <CardDescription className="text-destructive/80 text-xs">
            {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activeColumnFilters = Object.values(columnFilters);

  return (
    <div className="space-y-3">
      {/* 테이블 상단 툴바: 레코드 수, 활성 필터 배지, 컬럼 가시성 설정 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            총 <strong className="text-foreground font-semibold">{totalCount}</strong>개 레코드
          </span>
          {isSamplePreview && (
            <Badge variant="secondary" className="text-[11px] font-medium">
              샘플 데이터 미리보기
            </Badge>
          )}
          {dateRangeFilter && (dateRangeFilter.startDate || dateRangeFilter.endDate) ? (
            <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]">
              기간({dateRangeFieldLabel}): {dateRangeFilter.startDate ?? "..."} ~{" "}
              {dateRangeFilter.endDate ?? "..."}
              <button
                type="button"
                onClick={handleClearDateRange}
                className="hover:text-foreground ml-1 text-xs"
                title="기간 필터 해제"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ) : null}
          {activeColumnFilters.map((condition) => {
            const fieldMeta = activeFields.find((f) => f.id === condition.fieldId);
            const fieldLabel = resolveFilterFieldLabel(condition.fieldId, activeFields);
            const summary = formatFilterConditionSummary(condition, fieldMeta, relationNameMap);

            return (
              <Badge
                key={condition.fieldId}
                variant="outline"
                className="gap-1 px-2 py-0.5 text-[11px]"
              >
                <span>
                  {fieldLabel}: {summary}
                </span>
                <button
                  type="button"
                  onClick={() => handleSetFieldFilter(condition.fieldId, undefined)}
                  className="hover:text-foreground ml-1 text-xs"
                  title={`${fieldLabel} 필터 해제`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]">
              필터 {activeFilterCount}개 적용 중
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="hover:text-foreground ml-1 text-xs"
                title="모든 필터 초기화"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>

        {/* 컬럼 가시성 드롭다운/팝오버 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs">
              <SlidersHorizontal className="size-3" />
              컬럼 표시
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2 shadow-md">
            <div className="space-y-1.5 text-xs">
              <div className="text-muted-foreground p-1 font-semibold">표시할 컬럼 선택</div>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {table
                  .getAllLeafColumns()
                  .filter((col) => col.id !== "actions")
                  .map((column) => {
                    const isVisible = column.getIsVisible();
                    const colTitle = getColumnLabel(column.id, activeFields);

                    return (
                      <label
                        key={column.id}
                        className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs select-none"
                      >
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                        />
                        <span className="truncate">{colTitle}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 3. 빈 상태 */}
      {flatSubmissions.length === 0 && (
        <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
          <CardContent className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              {activeFilterCount > 0
                ? "검색 조건에 일치하는 응답이 없습니다"
                : "제출된 응답이 아직 없습니다"}
            </p>
            <p className="text-muted-foreground text-xs">
              {activeFilterCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAllFilters}
                  className="mt-2 h-7 text-xs"
                >
                  필터 모두 지우기
                </Button>
              ) : mode === "preview" ? (
                "활성 필드를 추가하면 데이터 목록 미리보기 레코드가 자동으로 생성됩니다."
              ) : (
                "상단 '신규 데이터 작성' 버튼을 눌러 첫 번째 응답을 등록해 보세요."
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 4. 가상화 무한 스크롤 TanStack Table */}
      {flatSubmissions.length > 0 && (
        <VirtualTable
          table={table}
          containerRef={tableContainerRef}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          onRowClick={mode === "preview" ? undefined : (row) => handleRowClick(row.original.id)}
        />
      )}
    </div>
  );
}
