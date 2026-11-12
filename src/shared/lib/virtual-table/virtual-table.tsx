"use client";

import * as React from "react";
import type { Table as TanStackTable, Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/ui/table";
import { cn } from "@/shared/lib/cn";

/**
 * 가상화 테이블의 표준 컬럼 너비(px) 설정 상수
 */
export const TABLE_COLUMN_WIDTH = {
  /** 기본 렌더링 너비: 200px */
  DEFAULT: 200,
  /** 최소 축소 한계 너비: 150px */
  MIN: 150,
  /** 최대 확장 한계 너비: 500px */
  MAX: 500,
} as const;

/**
 * 가상화 데이터 테이블(VirtualTable) 컴포넌트의 프로퍼티 정의
 */
export interface VirtualTableProps<TData> {
  /**
   * TanStack Table 인스턴스
   */
  table: TanStackTable<TData>;

  /**
   * 행 높이 추정치(px 단위, 기본값: 44px)
   */
  estimateRowHeight?: number | undefined;

  /**
   * 스크롤 컨테이너의 최대 높이 클래스 (기본값: "max-h-150")
   */
  maxHeightClassName?: string | undefined;

  /**
   * 외부에서 스크롤 컨테이너 제어가 필요할 때 전달하는 React ref
   */
  containerRef?: React.RefObject<HTMLDivElement | null> | undefined;

  /**
   * 추가 데이터(다음 페이지) 패칭 진행 여부
   */
  isFetchingNextPage?: boolean | undefined;

  /**
   * 다음 페이지 데이터 존재 여부
   */
  hasNextPage?: boolean | undefined;

  /**
   * 스크롤이 하단에 도달했을 때 추가 데이터를 로드하는 콜백 함수
   */
  fetchNextPage?: (() => void) | undefined;

  /**
   * 행 클릭 시 호출되는 콜백 함수
   */
  onRowClick?: ((row: Row<TData>) => void) | undefined;

  /**
   * 테이블 루트 요소에 적용할 추가 Tailwind CSS 클래스명
   */
  className?: string | undefined;

  /**
   * 스크롤 컨테이너 요소에 적용할 추가 Tailwind CSS 클래스명
   */
  containerClassName?: string | undefined;

  /**
   * 마지막 컬럼이 테이블의 남는 가로 영역을 자동으로 채우도록 할지 여부 (기본값: true)
   */
  stretchLastColumn?: boolean | undefined;
}

/**
 * 범용 가상화 데이터 테이블(VirtualTable) 엔진 컴포넌트
 *
 * TanStack Table의 상태(정렬, 리사이징, 가시성)와 TanStack Virtual의 가상 스크롤 렌더러를 결합하여,
 * 대용량 데이터 행을 44px 고정 높이로 가상화하고 실시간 컬럼 리사이징 및 무한 스크롤을 안정적으로 지원합니다.
 *
 * @param props VirtualTableProps<TData>
 */
export function VirtualTable<TData>({
  table,
  estimateRowHeight = 44,
  maxHeightClassName = "max-h-150",
  containerRef,
  isFetchingNextPage = false,
  hasNextPage = false,
  fetchNextPage,
  onRowClick,
  className,
  containerClassName,
  stretchLastColumn = true,
}: VirtualTableProps<TData>) {
  const internalRef = React.useRef<HTMLDivElement | null>(null);
  const resolvedContainerRef = containerRef ?? internalRef;

  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  // 1. TanStack Virtual 가상 스크롤 엔진 연동
  // React Compiler 자동 메모이제이션 스킵 대응
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => resolvedContainerRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalVirtualHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  // 2. 렌더링 대상 행 계산 (jsdom 등 테스트 환경의 0px 측정 대비 초기 20개 안전 폴백 적용)
  const rowsToRender = React.useMemo(() => {
    if (virtualRows.length > 0) {
      return virtualRows.map((virtualRow) => ({
        key: virtualRow.key,
        row: rows[virtualRow.index],
      }));
    }
    return rows.slice(0, 20).map((row, index) => ({
      key: row?.id ?? index,
      row,
    }));
  }, [virtualRows, rows]);

  // 3-1. TanStack Virtualizer 마지막 가상 행 가시화 감지 (가상 렌더링 최적화 페칭)
  const lastVirtualItem = virtualRows[virtualRows.length - 1];
  React.useEffect(() => {
    if (!lastVirtualItem) return;

    if (
      lastVirtualItem.index >= rows.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage &&
      fetchNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVirtualItem, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 3-2. 스크롤 하단 도달 감지 핸들러 (사용자 스크롤 사전 감지: 여유 버퍼 250px)
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

      if (scrollBottom < 250 && hasNextPage && !isFetchingNextPage && fetchNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  const isResizingAny = Boolean(table.getState().columnSizingInfo?.isResizingColumn);

  return (
    <div className="border-border/60 bg-card rounded-lg border shadow-xs">
      <Table
        containerRef={resolvedContainerRef}
        containerClassName={cn(maxHeightClassName, "w-full overflow-auto", containerClassName)}
        containerProps={{ onScroll: handleScroll }}
        className={cn(
          "table-fixed border-collapse text-left text-xs",
          isResizingAny && "select-none",
          className
        )}
        style={{
          width: `${table.getTotalSize()}px`,
          minWidth: stretchLastColumn ? "100%" : undefined,
        }}
      >
        {/* 고정 헤더 */}
        <TableHeader className="bg-muted/70 border-border/60 text-muted-foreground sticky top-0 z-10 border-b font-medium backdrop-blur-xs">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header, headerIndex) => {
                const isLast = stretchLastColumn && headerIndex === headerGroup.headers.length - 1;
                const canResize = header.column.getCanResize();
                const isResizing = header.column.getIsResizing();

                return (
                  <TableHead
                    key={header.id}
                    className="border-border/60 relative h-10 border-r px-3 py-2 whitespace-nowrap select-none last:border-r-0"
                    style={
                      isLast
                        ? { minWidth: `${header.column.columnDef.minSize ?? header.getSize()}px` }
                        : { width: `${header.getSize()}px` }
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : typeof header.column.columnDef.header === "function"
                        ? header.column.columnDef.header(header.getContext())
                        : header.column.columnDef.header}

                    {/* 컬럼 리사이저 드래그 핸들 (우측 끝 정확 안착 및 편안한 히트박스) */}
                    {canResize && (
                      <div
                        data-testid={`resizer-${header.id}`}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "group absolute top-0 -right-2 z-20 flex h-full w-4 cursor-col-resize touch-none items-center justify-center select-none",
                          isResizing && "bg-primary/20"
                        )}
                      >
                        <div
                          className={cn(
                            "group-hover:bg-primary h-full w-0.5 transition-colors group-hover:w-1",
                            isResizing ? "bg-primary w-1" : "bg-transparent"
                          )}
                        />
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        {/* 가상화 행 바디 */}
        <TableBody className="divide-border/40 divide-y">
          {/* 상단 가상 스페이서 패딩 */}
          {paddingTop > 0 && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                style={{ height: `${paddingTop}px` }}
                colSpan={columns.length}
                className="border-0 p-0"
              />
            </TableRow>
          )}

          {/* 현재 뷰포트에 표시되는 가상 행 목록 */}
          {rowsToRender.map(({ key, row }) => {
            if (!row) return null;

            return (
              <TableRow
                key={key}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "hover:bg-muted/40 h-11 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
              >
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const isLast =
                    stretchLastColumn && cellIndex === row.getVisibleCells().length - 1;
                  const rawValue = cell.getValue();
                  const cellString =
                    rawValue !== null && rawValue !== undefined ? String(rawValue) : "";

                  return (
                    <TableCell
                      key={cell.id}
                      className="border-border/30 h-11 truncate border-r px-3 py-2 whitespace-nowrap last:border-r-0"
                      style={
                        isLast
                          ? {
                              minWidth: `${cell.column.columnDef.minSize ?? cell.column.getSize()}px`,
                            }
                          : { width: `${cell.column.getSize()}px` }
                      }
                      title={cellString}
                    >
                      {cell.column.columnDef.cell instanceof Function
                        ? cell.column.columnDef.cell(cell.getContext())
                        : (rawValue as React.ReactNode)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}

          {/* 하단 가상 스페이서 패딩 */}
          {paddingBottom > 0 && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                style={{ height: `${paddingBottom}px` }}
                colSpan={columns.length}
                className="border-0 p-0"
              />
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 무한 스크롤 추가 데이터 패칭 인디케이터 */}
      {isFetchingNextPage && (
        <div className="text-muted-foreground border-border/40 flex items-center justify-center gap-2 border-t p-2 text-xs">
          <span className="border-primary inline-block size-3 animate-spin rounded-full border-2 border-t-transparent" />
          <span>추가 데이터를 불러오는 중입니다...</span>
        </div>
      )}
    </div>
  );
}
