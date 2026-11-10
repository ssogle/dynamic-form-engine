"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { VirtualTable, TABLE_COLUMN_WIDTH } from "@/shared/lib/virtual-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";

import type { Form, CoreFormField } from "@/entities/form";
import { extractActiveFields } from "@/entities/form";
import {
  useInfiniteFormSubmissionsQuery,
  useDeleteSubmissionMutation,
  type FormSubmission,
} from "@/entities/form-submission";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { formatDateTime } from "@/shared/lib/date";

export interface SubmissionListTableProps {
  form: Form;
}

/**
 * 시스템 공통 컬럼의 사용자 친화적 한글 레이블 사전
 */
export const SYSTEM_COLUMN_LABELS = {
  id: "ID",
  createdAt: "제출 일시",
  updatedAt: "수정 일시",
  actions: "관리",
} as const;

/**
 * 컬럼 ID를 기반으로 화면 및 체크박스 목록에 표시할 한글 제목을 반환합니다.
 */
function getColumnLabel(columnId: string, activeFields: CoreFormField[]): string {
  if (columnId in SYSTEM_COLUMN_LABELS) {
    return SYSTEM_COLUMN_LABELS[columnId as keyof typeof SYSTEM_COLUMN_LABELS];
  }
  const fieldMeta = activeFields.find((f) => f.id === columnId);
  return fieldMeta?.label || columnId;
}

/**
 * 특정 컬럼 헤더용 정렬 및 팝오버 필터 컨트롤 컴포넌트
 */
function ColumnHeaderFilter({
  label,
  isSorted,
  onToggleSort,
  filterValue,
  onApplyFilter,
}: {
  label: string;
  isSorted: false | "asc" | "desc";
  onToggleSort: (event: React.MouseEvent) => void;
  filterValue: string;
  onApplyFilter: (val: string) => void;
}) {
  const [localInput, setLocalInput] = React.useState(filterValue);
  const [prevFilterValue, setPrevFilterValue] = React.useState(filterValue);
  const [isOpen, setIsOpen] = React.useState(false);

  // React 19 권장: 렌더 중 부모 상태 변경 반영
  if (filterValue !== prevFilterValue) {
    setPrevFilterValue(filterValue);
    setLocalInput(filterValue);
  }

  const handleApply = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    onApplyFilter(localInput.trim());
    setIsOpen(false);
  };

  const handleClear = () => {
    setLocalInput("");
    onApplyFilter("");
    setIsOpen(false);
  };

  const hasFilter = Boolean(filterValue);

  return (
    <div className="flex items-center justify-between gap-1 pr-2">
      {/* 1. 컬럼 타이틀 (말줄임 보장 & 클릭 시 정렬) */}
      <button
        type="button"
        onClick={onToggleSort}
        className="hover:text-foreground flex items-center gap-1.5 truncate text-left font-semibold transition-colors"
        title={`${label} (클릭하여 정렬, Shift+클릭으로 다중 정렬)`}
      >
        <span className="truncate">{label}</span>
        {isSorted === "asc" && <ArrowUp className="text-primary size-3.5 shrink-0" />}
        {isSorted === "desc" && <ArrowDown className="text-primary size-3.5 shrink-0" />}
        {!isSorted && (
          <ArrowUpDown className="text-muted-foreground/60 size-3 shrink-0 opacity-70" />
        )}
      </button>

      {/* 2. 팝오버 필터 트리거 */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`hover:bg-muted size-6 p-0 ${
              hasFilter ? "text-primary bg-primary/10 font-bold" : "text-muted-foreground/70"
            }`}
            title={hasFilter ? `현재 필터 적용 중: "${filterValue}"` : `${label} 검색`}
          >
            <Filter className="size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3 shadow-md">
          <form onSubmit={handleApply} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-semibold">[{label}] 필터</span>
              {hasFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-5 px-1.5 text-[10px]"
                  onClick={handleClear}
                >
                  <RotateCcw className="mr-1 size-2.5" />
                  초기화
                </Button>
              )}
            </div>
            <Input
              autoFocus
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder="검색할 키워드 입력..."
              className="h-8 text-xs"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setIsOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" size="sm" className="h-7 px-2.5 text-xs">
                적용
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * TanStack Table + TanStack Virtual 기반 고성능 가상화 무한 스크롤 데이터 테이블
 */
export function SubmissionListTable({ form }: SubmissionListTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // 1. 다중 정렬 파라미터 직렬화 (예: "f_exp:desc,createdAt:desc")
  const sortQueryString = React.useMemo(() => {
    if (sorting.length === 0) return "createdAt:desc";
    return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
  }, [sorting]);

  // 2. 컬럼별 필터 파라미터 직렬화 (예: '{"f_applicant":"홍길동"}')
  const filtersQueryString = React.useMemo(() => {
    const activeEntries = Object.entries(columnFilters).filter(([, val]) => Boolean(val?.trim()));
    if (activeEntries.length === 0) return undefined;
    return JSON.stringify(Object.fromEntries(activeEntries));
  }, [columnFilters]);

  // 3. 서버 무한 스크롤 쿼리 훅 연동
  const { data, isLoading, isError, error, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteFormSubmissionsQuery(form.id, {
      sort: sortQueryString,
      filters: filtersQueryString,
      limit: 20,
    });

  const { mutateAsync: deleteSubmission } = useDeleteSubmissionMutation(form.id);

  // 모든 누적 페이지 아이템 평탄화
  const flatSubmissions = React.useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount ?? flatSubmissions.length;
  const activeFields = extractActiveFields(form);

  // 단일 컬럼 필터 갱신 핸들러
  const handleSetFieldFilter = React.useCallback((fieldId: string, value: string) => {
    setColumnFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      return { ...prev, [fieldId]: value };
    });
  }, []);

  // 전체 필터 초기화
  const handleClearAllFilters = React.useCallback(() => {
    setColumnFilters({});
  }, []);

  const handleDelete = React.useCallback(
    async (submissionId: string) => {
      if (!window.confirm("정말 이 응답을 삭제하시겠습니까?")) return;

      try {
        setDeletingId(submissionId);
        await deleteSubmission(submissionId);
      } catch (err) {
        console.error("응답 삭제 실패:", err);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteSubmission]
  );

  // 4. 동적 TanStack 컬럼 정의 (헤더/셀 줄바꿈 방지 및 한 줄 말줄임 규칙)
  const columns = React.useMemo<ColumnDef<FormSubmission>[]>(() => {
    const cols: ColumnDef<FormSubmission>[] = [];

    // // 임시 테스트용 시스템 컬럼: 응답 ID (첫 번째 셀)
    // cols.push({
    //   id: "id",
    //   accessorKey: "id",
    //   header: ({ column }) => {
    //     const isSorted = column.getIsSorted();
    //     return (
    //       <div className="flex items-center gap-1.5 pr-2">
    //         <button
    //           type="button"
    //           onClick={(e) => column.toggleSorting(undefined, e.shiftKey)}
    //           className="hover:text-foreground flex items-center gap-1.5 truncate font-semibold transition-colors"
    //           title={`${SYSTEM_COLUMN_LABELS.id} (클릭하여 정렬, Shift+클릭 다중 정렬)`}
    //         >
    //           <span>{SYSTEM_COLUMN_LABELS.id}</span>
    //           {isSorted === "asc" && <ArrowUp className="text-primary size-3.5 shrink-0" />}
    //           {isSorted === "desc" && <ArrowDown className="text-primary size-3.5 shrink-0" />}
    //           {!isSorted && (
    //             <ArrowUpDown className="text-muted-foreground/60 size-3 shrink-0 opacity-70" />
    //           )}
    //         </button>
    //       </div>
    //     );
    //   },
    //   cell: (info) => {
    //     const idVal = String(info.getValue() ?? "");
    //     return (
    //       <div
    //         className="text-muted-foreground truncate font-mono text-xs whitespace-nowrap"
    //         title={idVal}
    //       >
    //         {idVal}
    //       </div>
    //     );
    //   },
    //   size: 140,
    //   minSize: 100,
    //   maxSize: 300,
    // });

    // 폼 활성 필드별 동적 컬럼 생성
    activeFields.forEach((field: CoreFormField) => {
      cols.push({
        id: field.id,
        accessorFn: (row) => row.data?.[field.id],
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <ColumnHeaderFilter
              label={field.label}
              isSorted={isSorted}
              onToggleSort={(e) => {
                column.toggleSorting(undefined, e.shiftKey);
              }}
              filterValue={columnFilters[field.id] ?? ""}
              onApplyFilter={(val) => handleSetFieldFilter(field.id, val)}
            />
          );
        },
        cell: (info) => {
          const rawVal = info.getValue();
          const displayVal =
            rawVal !== undefined && rawVal !== null && rawVal !== "" ? String(rawVal) : "-";
          return (
            <div className="max-w-full truncate text-xs whitespace-nowrap" title={displayVal}>
              {displayVal}
            </div>
          );
        },
        size: TABLE_COLUMN_WIDTH.DEFAULT,
        minSize: TABLE_COLUMN_WIDTH.MIN,
        maxSize: TABLE_COLUMN_WIDTH.MAX,
      });
    });

    // 시스템 컬럼: 제출 일시
    cols.push({
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <div className="flex items-center gap-1.5 pr-2">
            <button
              type="button"
              onClick={(e) => column.toggleSorting(undefined, e.shiftKey)}
              className="hover:text-foreground flex items-center gap-1.5 truncate font-semibold transition-colors"
              title={`${SYSTEM_COLUMN_LABELS.createdAt} (클릭하여 정렬, Shift+클릭 다중 정렬)`}
            >
              <span>{SYSTEM_COLUMN_LABELS.createdAt}</span>
              {isSorted === "asc" && <ArrowUp className="text-primary size-3.5 shrink-0" />}
              {isSorted === "desc" && <ArrowDown className="text-primary size-3.5 shrink-0" />}
              {!isSorted && (
                <ArrowUpDown className="text-muted-foreground/60 size-3 shrink-0 opacity-70" />
              )}
            </button>
          </div>
        );
      },
      cell: (info) => {
        const rawDate = info.getValue() as string | Date | undefined;
        const formatted = formatDateTime(rawDate);
        return (
          <div
            className="text-muted-foreground truncate text-xs whitespace-nowrap"
            title={formatted}
          >
            {formatted}
          </div>
        );
      },
      size: TABLE_COLUMN_WIDTH.DEFAULT,
      minSize: TABLE_COLUMN_WIDTH.MIN,
      maxSize: TABLE_COLUMN_WIDTH.MAX,
    });

    // 시스템 컬럼: 수정 일시
    cols.push({
      id: "updatedAt",
      accessorKey: "updatedAt",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <div className="flex items-center gap-1.5 pr-2">
            <button
              type="button"
              onClick={(e) => column.toggleSorting(undefined, e.shiftKey)}
              className="hover:text-foreground flex items-center gap-1.5 truncate font-semibold transition-colors"
              title={`${SYSTEM_COLUMN_LABELS.updatedAt} (클릭하여 정렬, Shift+클릭 다중 정렬)`}
            >
              <span>{SYSTEM_COLUMN_LABELS.updatedAt}</span>
              {isSorted === "asc" && <ArrowUp className="text-primary size-3.5 shrink-0" />}
              {isSorted === "desc" && <ArrowDown className="text-primary size-3.5 shrink-0" />}
              {!isSorted && (
                <ArrowUpDown className="text-muted-foreground/60 size-3 shrink-0 opacity-70" />
              )}
            </button>
          </div>
        );
      },
      cell: (info) => {
        const rawDate = info.getValue() as string | Date | undefined;
        const formatted = formatDateTime(rawDate);
        return (
          <div
            className="text-muted-foreground truncate text-xs whitespace-nowrap"
            title={formatted}
          >
            {formatted}
          </div>
        );
      },
      size: TABLE_COLUMN_WIDTH.DEFAULT,
      minSize: TABLE_COLUMN_WIDTH.MIN,
      maxSize: TABLE_COLUMN_WIDTH.MAX,
    });

    // 관리 액션 컬럼 (마지막 컬럼으로서 남는 공간을 자연스럽게 채움)
    cols.push({
      id: "actions",
      header: () => <div className="text-left font-semibold">{SYSTEM_COLUMN_LABELS.actions}</div>,
      cell: ({ row }) => {
        const sub = row.original;
        return (
          <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/consumer/forms/${form.id}/submissions/${sub.id}`}>상세</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/consumer/forms/${form.id}/submissions/${sub.id}/edit`}>수정</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(sub.id);
              }}
              disabled={deletingId === sub.id}
            >
              {deletingId === sub.id ? "삭제 중..." : "삭제"}
            </Button>
          </div>
        );
      },
      size: 180,
      minSize: 180,
      enableResizing: false,
    });

    return cols;
  }, [activeFields, columnFilters, handleSetFieldFilter, form.id, deletingId, handleDelete]);

  // 5. TanStack Table 인스턴스화
  // React Compiler의 자동 메모이제이션 대상에서 TanStack Table 내부 함수가 제외됨에 따른 경고를 억제합니다.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: flatSubmissions,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: true,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
  });

  // 6. 스크롤 컨테이너 참조 및 정렬/필터 변경 시 스크롤 상단 리셋
  const tableContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    tableContainerRef.current?.scrollTo({ top: 0 });
  }, [sortQueryString, filtersQueryString]);

  const activeFilterCount = Object.keys(columnFilters).length;

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

  return (
    <div className="space-y-3">
      {/* 테이블 상단 툴바: 레코드 수, 활성 필터 배지, 컬럼 가시성 설정 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            총 <strong className="text-foreground font-semibold">{totalCount}</strong>개 레코드
          </span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]">
              필터 {activeFilterCount}개 적용 중
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="hover:text-foreground ml-1 text-xs"
                title="모든 필터 초기화"
              >
                <X className="size-3"></X>
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
          onRowClick={(row) =>
            router.push(`/consumer/forms/${form.id}/submissions/${row.original.id}`)
          }
        />
      )}
    </div>
  );
}
