"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import {
  extractActiveFields,
  extractPrimaryFieldId,
  extractPrimaryFieldValue,
  useFormDetailQuery,
} from "@/entities/form";
import {
  useFormSubmissionsByIdsQuery,
  useInfiniteFormSubmissionsQuery,
} from "@/entities/form-submission";
import { resolveFieldQueryCapability, serializeFieldFiltersParam } from "@/shared/schema";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";

export interface RelationColumnFilterPickerProps {
  /** 참조 대상 타깃 폼 UUID */
  targetFormId: string;
  /** 현재 선택된 타깃 응답 UUID 목록 */
  selectedIds: string[];
  /** 선택된 타깃 응답 UUID 목록 변경 핸들러 */
  onChangeSelectedIds: (nextIds: string[]) => void;
}

/**
 * 컨슈머 응답 테이블 컬럼 헤더에서 관계형(relation) 필드를 필터링할 때
 * 타깃 폼의 레코드를 검색·다중 선택할 수 있는 전용 피커 컴포넌트입니다.
 */
export function RelationColumnFilterPicker({
  targetFormId,
  selectedIds,
  onChangeSelectedIds,
}: RelationColumnFilterPickerProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const { data: targetForm, isLoading: isFormLoading } = useFormDetailQuery(targetFormId);

  const primaryFieldId = React.useMemo(() => extractPrimaryFieldId(targetForm), [targetForm]);
  const primaryField = React.useMemo(() => {
    if (!primaryFieldId) return undefined;
    return extractActiveFields(targetForm).find((f) => f.id === primaryFieldId);
  }, [targetForm, primaryFieldId]);

  const filtersParam = React.useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !primaryFieldId) {
      return undefined;
    }
    const primaryCap = resolveFieldQueryCapability(primaryField);
    const op = primaryCap?.filterOperators.includes("contains")
      ? "contains"
      : primaryCap?.filterOperators.includes("eq")
        ? "eq"
        : null;
    if (!op) {
      return undefined;
    }
    return serializeFieldFiltersParam([{ fieldId: primaryFieldId, op, value: trimmed }]);
  }, [primaryFieldId, primaryField, searchQuery]);

  const {
    data: submissionsData,
    isLoading: isListLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteFormSubmissionsQuery(targetFormId, {
    filters: filtersParam,
    limit: 15,
  });

  const { data: selectedRecords = [] } = useFormSubmissionsByIdsQuery(targetFormId, selectedIds);

  const candidateRows = React.useMemo(
    () => submissionsData?.pages.flatMap((page) => page.items) ?? [],
    [submissionsData]
  );

  // 후보 목록 + 선택된 레코드에서 UUID -> 대표 표시명 사전 구성
  const displayNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of [...selectedRecords, ...candidateRows]) {
      const displayVal = extractPrimaryFieldValue(targetForm, row);
      if (displayVal) {
        map.set(row.id, displayVal);
      }
    }
    return map;
  }, [selectedRecords, candidateRows, targetForm]);

  const handleToggleId = (recordId: string, checked: boolean) => {
    if (checked) {
      if (!selectedIds.includes(recordId)) {
        onChangeSelectedIds([...selectedIds, recordId]);
      }
    } else {
      onChangeSelectedIds(selectedIds.filter((id) => id !== recordId));
    }
  };

  return (
    <div className="space-y-2">
      {/* 선택된 타깃 레코드 칩 */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 px-1.5 py-0.5 text-[10px]">
              <span className="max-w-36 truncate">{displayNameMap.get(id) ?? id.slice(0, 8)}</span>
              <button
                type="button"
                onClick={() => handleToggleId(id, false)}
                className="hover:text-foreground"
                title="선택 해제"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* 타깃 폼 대표 필드 검색 입력창 */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2 left-2 size-3.5" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={targetForm ? `${targetForm.title} 대표명 검색...` : "연결 레코드 검색..."}
          className="h-7.5 pl-7 text-xs"
        />
      </div>

      {/* 타깃 레코드 목록 */}
      <div className="max-h-44 space-y-1 overflow-y-auto rounded border p-1">
        {(isFormLoading || isListLoading) && candidateRows.length === 0 ? (
          <div className="space-y-1.5 p-1">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : candidateRows.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-[11px]">
            표시할 레코드가 없습니다.
          </p>
        ) : (
          <>
            {candidateRows.map((row) => {
              const isChecked = selectedIds.includes(row.id);
              const label = displayNameMap.get(row.id) ?? row.id.slice(0, 8);
              return (
                <label
                  key={row.id}
                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs select-none"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggleId(row.id, Boolean(checked))}
                  />
                  <span className="truncate">{label}</span>
                </label>
              );
            })}
            {hasNextPage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="h-6 w-full text-[11px]"
              >
                {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
