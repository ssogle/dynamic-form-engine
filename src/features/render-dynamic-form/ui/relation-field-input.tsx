"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Link2, Search, Table2, X } from "lucide-react";
import {
  extractPrimaryFieldId,
  PrimaryFieldBadge,
  useFormDetailQuery,
  type CoreFormField,
  type Form,
} from "@/entities/form";
import {
  useFormSubmissionsByIdsQuery,
  useInfiniteFormSubmissionsQuery,
  type FormSubmission,
} from "@/entities/form-submission";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/lib/cn";
import {
  buildPickerFilterString,
  formatRelationCellValue,
  normalizeSelectedRelationIds,
  orderTargetColumns,
  removeRelationSelection,
  toggleRelationSelection,
} from "../lib/relation-table";

export interface RelationFieldInputProps {
  /** 참조 대상 타깃 도메인 폼의 고유 ID */
  targetFormId: string;
  /** 다중 선택 허용 여부 (false: 단일 행 클릭 선택, true: 체크박스 복수 선택) */
  multiple: boolean;
  /** 현재 React Hook Form 필드 값 (단일 string 또는 다중 string[]) */
  value: unknown;
  /** 값 변경 콜백 */
  onChange: (value: unknown) => void;
  /** 비활성화 여부 */
  disabled?: boolean | undefined;
  /** 미선택 상태 안내 문구 */
  placeholder?: string | undefined;
}

interface RelationPickerDialogBodyProps {
  targetFormId: string;
  targetForm?: Form | undefined;
  columns: CoreFormField[];
  primaryFieldId?: string | undefined;
  multiple: boolean;
  selectedIds: string[];
  onSelectValue: (nextValue: unknown, shouldClose?: boolean) => void;
  onClose: () => void;
}

/**
 * 피커 다이얼로그가 열렸을 때만 마운트되어 타깃 폼 목록을 무한 스크롤/검색/정렬 조회하는 내부 테이블 컴포넌트
 */
function RelationPickerDialogBody({
  targetFormId,
  targetForm,
  columns,
  primaryFieldId,
  multiple,
  selectedIds,
  onSelectValue,
  onClose,
}: RelationPickerDialogBodyProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortState, setSortState] = React.useState<{ id: string; desc: boolean }>({
    id: "createdAt",
    desc: true,
  });

  const filtersParam = React.useMemo(
    () =>
      buildPickerFilterString({
        primaryFieldId,
        searchQuery,
        columnFilters: {},
      }),
    [primaryFieldId, searchQuery]
  );

  const sortParam = `${sortState.id}:${sortState.desc ? "desc" : "asc"}`;

  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteFormSubmissionsQuery(targetFormId, {
      sort: sortParam,
      filters: filtersParam,
      limit: 20,
    });

  const rows = React.useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const totalCount = data?.pages[0]?.totalCount ?? rows.length;
  const primaryFieldLabel = columns.find((col) => col.id === primaryFieldId)?.label ?? "대표 필드";

  const handleToggleSort = (fieldId: string) => {
    setSortState((prev) =>
      prev.id === fieldId ? { id: fieldId, desc: !prev.desc } : { id: fieldId, desc: false }
    );
  };

  const handleRowSelect = (row: FormSubmission) => {
    const nextValue = toggleRelationSelection({
      currentIds: selectedIds,
      targetId: row.id,
      multiple,
    });
    onSelectValue(nextValue, !multiple);
  };

  return (
    <>
      <DialogHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <Table2 className="text-primary size-4" />
          <DialogTitle className="text-base font-bold">
            {targetForm?.title ?? "타깃 도메인"} 레코드 선택
          </DialogTitle>
          <Badge variant="outline" className="text-[11px]">
            {multiple ? "다중 선택" : "단일 선택"}
          </Badge>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              {selectedIds.length}건 선택됨
            </Badge>
          )}
        </div>
        <DialogDescription className="text-xs">
          표에서 연결할 레코드를 선택하세요. 대표 식별 필드({primaryFieldLabel})가 첫 번째 열에
          표시됩니다.
        </DialogDescription>
      </DialogHeader>

      {/* 검색 바 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${primaryFieldLabel} 기준으로 검색...`}
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              title="검색어 지우기"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">총 {totalCount}건</span>
      </div>

      {/* 타깃 레코드 테이블 뷰 */}
      <div className="border-border/60 min-h-[260px] flex-1 overflow-auto rounded-lg border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ) : isError ? (
          <div className="text-destructive py-12 text-center text-xs">
            타깃 폼의 레코드 목록을 불러오는 중 오류가 발생했습니다.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-xs">
            {searchQuery
              ? `'${searchQuery}' 검색 조건과 일치하는 레코드가 없습니다.`
              : "선택할 수 있는 타깃 레코드가 아직 제출되지 않았습니다."}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10 text-center">선택</TableHead>
                {columns.map((col) => {
                  const isPrimary = col.id === primaryFieldId;
                  const isSorted = sortState.id === col.id;
                  return (
                    <TableHead key={col.id} className="text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleSort(col.id)}
                        className="hover:text-foreground inline-flex items-center gap-1.5 font-semibold transition-colors"
                      >
                        <span>{col.label}</span>
                        {isPrimary && <PrimaryFieldBadge />}
                        {isSorted ? (
                          sortState.desc ? (
                            <ArrowDown className="text-primary size-3" />
                          ) : (
                            <ArrowUp className="text-primary size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="text-muted-foreground/60 size-3" />
                        )}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const rowData = (row.data as Record<string, unknown>) ?? {};

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => handleRowSelect(row)}
                    className={cn(
                      "cursor-pointer text-xs transition-colors",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleRowSelect(row)}
                        aria-label="레코드 선택"
                      />
                    </TableCell>
                    {columns.map((col) => {
                      const isPrimary = col.id === primaryFieldId;
                      const formatted = formatRelationCellValue(rowData[col.id], col);
                      return (
                        <TableCell
                          key={col.id}
                          className={cn(
                            "max-w-[220px] truncate",
                            isPrimary && "text-foreground font-semibold"
                          )}
                          title={formatted}
                        >
                          {formatted}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 추가 페이지네이션 로드 */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? "불러오는 중..." : "더 많은 레코드 불러오기"}
          </Button>
        </div>
      )}

      <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
        <div>
          {selectedIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 text-xs"
              onClick={() => onSelectValue(multiple ? [] : undefined, false)}
            >
              선택 전체 해제
            </Button>
          )}
        </div>
        <Button type="button" size="sm" className="h-8 px-4 text-xs" onClick={onClose}>
          {multiple ? "선택 완료" : "닫기"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * 관계형 도메인 연결 필드 입력 컴포넌트 (Selected Rows Mini Table + Target Form Table Picker Dialog)
 *
 * 타깃 폼의 스키마 정의(`primaryFieldId` 포함)를 단일 진실 원천으로 참조하여:
 * 1. 입력 화면에서는 선택된 레코드를 타깃 폼의 컬럼 구조 그대로 미니 테이블 행(Row)으로 렌더링하고,
 * 2. 선택/변경 버튼 클릭 시 모달 테이블 피커를 열어 검색·정렬·복수/단일 선택 인터랙션을 제공합니다.
 */
export function RelationFieldInput({
  targetFormId,
  multiple,
  value,
  onChange,
  disabled = false,
  placeholder,
}: RelationFieldInputProps) {
  const [open, setOpen] = React.useState(false);

  const selectedIds = React.useMemo(
    () => normalizeSelectedRelationIds(value, multiple),
    [value, multiple]
  );

  // 1. 타깃 폼 스키마 메타데이터 및 대표 필드 정보 구독
  const { data: targetForm, isLoading: isTargetFormLoading } = useFormDetailQuery(targetFormId);
  const primaryFieldId = extractPrimaryFieldId(targetForm);
  const orderedColumns = React.useMemo(() => orderTargetColumns(targetForm), [targetForm]);
  // 인라인 미니 테이블에서는 레이아웃 과밀 방지를 위해 최대 4개 핵심 열만 우선 표시
  const miniTableColumns = React.useMemo(() => orderedColumns.slice(0, 4), [orderedColumns]);

  // 2. 이미 선택되어 저장된 타깃 레코드 UUID 목록을 배치 조회 (1페이지 외부 데이터 포함)
  const { data: selectedRows = [], isLoading: isSelectedRowsLoading } =
    useFormSubmissionsByIdsQuery(targetFormId, selectedIds);

  const rowsById = React.useMemo(() => {
    const map = new Map<string, FormSubmission>();
    for (const row of selectedRows) {
      map.set(row.id, row);
    }
    return map;
  }, [selectedRows]);

  const handleRemoveRow = (targetId: string) => {
    const nextVal = removeRelationSelection({
      currentIds: selectedIds,
      targetId,
      multiple,
    });
    onChange(nextVal);
  };

  return (
    <div className="space-y-2">
      {/* 상단 액션 바: 타깃 폼 배지 및 피커 다이얼로그 트리거 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1 text-[11px] font-medium">
            <Link2 className="size-3" />
            {targetForm?.title ?? targetFormId}
          </Badge>
          <span className="text-muted-foreground text-[11px]">
            {multiple ? `복수 선택 (${selectedIds.length}건)` : "단일 선택"}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Table2 className="size-3.5" />
          {selectedIds.length > 0 ? "타깃 목록에서 변경" : "타깃 목록에서 선택"}
        </Button>
      </div>

      {/* 선택된 레코드 미니 테이블 */}
      {selectedIds.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            "border-border/70 bg-muted/20 text-muted-foreground flex w-full items-center justify-center rounded-lg border border-dashed px-4 py-4 text-xs transition-colors",
            !disabled && "hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
          )}
        >
          {placeholder ?? "선택된 레코드가 없습니다. 클릭하여 타깃 테이블에서 선택하세요."}
        </button>
      ) : isTargetFormLoading || isSelectedRowsLoading ? (
        <div className="space-y-1.5 rounded-lg border p-3">
          <Skeleton className="h-6 w-full rounded" />
          <Skeleton className="h-6 w-full rounded" />
        </div>
      ) : (
        <div className="border-border/70 bg-background overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                {miniTableColumns.map((col) => (
                  <TableHead key={col.id} className="h-8 px-2.5 text-[11px] font-semibold">
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.id === primaryFieldId && <PrimaryFieldBadge />}
                    </div>
                  </TableHead>
                ))}
                {!disabled && <TableHead className="h-8 w-10 px-2 text-center text-[11px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedIds.map((selectedId) => {
                const row = rowsById.get(selectedId);
                const rowData = (row?.data as Record<string, unknown>) ?? {};

                return (
                  <TableRow key={selectedId} className="text-xs">
                    {miniTableColumns.length === 0 ? (
                      <TableCell className="text-muted-foreground font-mono text-[11px]">
                        {selectedId}
                      </TableCell>
                    ) : (
                      miniTableColumns.map((col, idx) => {
                        const isPrimary = col.id === primaryFieldId;
                        const cellText = row
                          ? formatRelationCellValue(rowData[col.id], col)
                          : idx === 0
                            ? selectedId
                            : "-";
                        return (
                          <TableCell
                            key={col.id}
                            className={cn(
                              "max-w-[180px] truncate px-2.5 py-2",
                              isPrimary && "text-foreground font-semibold"
                            )}
                            title={cellText}
                          >
                            {cellText}
                          </TableCell>
                        );
                      })
                    )}
                    {!disabled && (
                      <TableCell className="px-2 py-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive size-6"
                          onClick={() => handleRemoveRow(selectedId)}
                          title="연결 해제"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 타깃 폼 목록 테이블 선택 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
          {open && (
            <RelationPickerDialogBody
              targetFormId={targetFormId}
              targetForm={targetForm}
              columns={orderedColumns}
              primaryFieldId={primaryFieldId}
              multiple={multiple}
              selectedIds={selectedIds}
              onSelectValue={(nextVal, shouldClose) => {
                onChange(nextVal);
                if (shouldClose) {
                  setOpen(false);
                }
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
