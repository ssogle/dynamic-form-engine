"use client";

import * as React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export interface ColumnHeaderFilterProps {
  /**
   * 컬럼 표시 레이블
   */
  label: string;
  /**
   * 현재 정렬 방향
   */
  isSorted: false | "asc" | "desc";
  /**
   * 정렬 토글 핸들러 (Shift+클릭 지원)
   */
  onToggleSort: (event: React.MouseEvent) => void;
  /**
   * 현재 적용된 필터 키워드
   */
  filterValue: string;
  /**
   * 필터 키워드 적용 핸들러
   */
  onApplyFilter: (val: string) => void;
}

/**
 * 테이블 컬럼 헤더 정렬 및 인라인 팝오버 필터 컨트롤 컴포넌트 (ColumnHeaderFilter)
 *
 * 컬럼 레이블 클릭 시 정렬 토글을 실행하고, 우측 필터 아이콘 클릭 시
 * 팝오버 입력창을 띄워 컬럼별 검색/필터링을 수행합니다.
 */
export function ColumnHeaderFilter({
  label,
  isSorted,
  onToggleSort,
  filterValue,
  onApplyFilter,
}: ColumnHeaderFilterProps) {
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
