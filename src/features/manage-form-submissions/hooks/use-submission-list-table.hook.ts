"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type Table,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TABLE_COLUMN_WIDTH } from "@/shared/lib/virtual-table";
import type { Form, CoreFormField } from "@/entities/form";
import {
  extractActiveFields,
  extractPrimaryFieldId,
  formatFieldDisplayValue,
} from "@/entities/form";
import {
  useInfiniteFormSubmissionsQuery,
  useDeleteSubmissionMutation,
  type FormSubmission,
} from "@/entities/form-submission";
import { formatDateTime } from "@/shared/lib/date";
import { formatRelationSummaryCell } from "../lib/relation-summary";
import { useRelationLookup } from "./use-relation-lookup.hook";
import { ColumnHeaderFilter } from "../ui/column-header-filter";
import { SubmissionActionCell } from "../ui/submission-action-cell";

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
export function getColumnLabel(columnId: string, activeFields: CoreFormField[]): string {
  if (columnId in SYSTEM_COLUMN_LABELS) {
    return SYSTEM_COLUMN_LABELS[columnId as keyof typeof SYSTEM_COLUMN_LABELS];
  }
  const fieldMeta = activeFields.find((f) => f.id === columnId);
  return fieldMeta?.label || columnId;
}

export interface UseSubmissionListTableParams {
  /**
   * 폼 메타데이터 객체
   */
  form: Form;
}

export interface UseSubmissionListTableReturn {
  /**
   * TanStack Table 인스턴스
   */
  table: Table<FormSubmission>;
  /**
   * 누적된 무한 스크롤 평탄화 응답 목록
   */
  flatSubmissions: FormSubmission[];
  /**
   * 전체 응답 레코드 수
   */
  totalCount: number;
  /**
   * 폼 활성 필드 목록
   */
  activeFields: CoreFormField[];
  /**
   * 현재 폼의 도메인 대표 식별 필드 ID
   */
  primaryFieldId: string | undefined;
  /**
   * 현재 적용 중인 컬럼 필터 개수
   */
  activeFilterCount: number;
  /**
   * 데이터 로딩 상태
   */
  isLoading: boolean;
  /**
   * 데이터 조회 실패 여부
   */
  isError: boolean;
  /**
   * 데이터 조회 에러 객체
   */
  error: unknown;
  /**
   * 다음 페이지 추가 로딩 중 여부
   */
  isFetchingNextPage: boolean;
  /**
   * 다음 페이지 존재 여부
   */
  hasNextPage: boolean;
  /**
   * 다음 페이지 비동기 요청 트리거
   */
  fetchNextPage: () => void;
  /**
   * 가상화 테이블 스크롤 컨테이너 ref
   */
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  /**
   * 단일 컬럼 필터 값 설정 핸들러
   */
  handleSetFieldFilter: (fieldId: string, value: string) => void;
  /**
   * 모든 활성 컬럼 필터 초기화 핸들러
   */
  handleClearAllFilters: () => void;
  /**
   * 단건 응답 삭제 핸들러
   */
  handleDelete: (submissionId: string) => Promise<void>;
  /**
   * 행 클릭 시 상세 페이지 이동 핸들러
   */
  handleRowClick: (submissionId: string) => void;
}

/**
 * 제출 응답 목록 가상화 테이블 비즈니스 오케스트레이션 전용 커스텀 훅 (useSubmissionListTable)
 *
 * 서버 무한 스크롤 연동, 다중 정렬/컬럼 필터 직렬화, TanStack Table 인스턴스화,
 * 컬럼 정의 생성, 삭제 인터랙션 및 라우팅 로직을 캡슐화합니다.
 */
export function useSubmissionListTable({
  form,
}: UseSubmissionListTableParams): UseSubmissionListTableReturn {
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
  const activeFields = React.useMemo(() => extractActiveFields(form), [form]);
  const primaryFieldId = extractPrimaryFieldId(form);
  const { lookupMap: relationLookupMap } = useRelationLookup(activeFields, flatSubmissions);

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

  // 단건 응답 삭제 핸들러
  const handleDelete = React.useCallback(
    async (submissionId: string) => {
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

  // 행 클릭 시 상세 페이지 이동 핸들러
  const handleRowClick = React.useCallback(
    (submissionId: string) => {
      router.push(`/consumer/forms/${form.id}/submissions/${submissionId}`);
    },
    [router, form.id]
  );

  // 4. 동적 TanStack 컬럼 정의 (순수 createElement 기반)
  const columns = React.useMemo<ColumnDef<FormSubmission>[]>(() => {
    const cols: ColumnDef<FormSubmission>[] = [];

    // 폼 활성 필드별 동적 컬럼 생성
    activeFields.forEach((field: CoreFormField) => {
      const isPrimary = field.id === primaryFieldId;
      cols.push({
        id: field.id,
        accessorFn: (row) => row.data?.[field.id],
        header: ({ column }) =>
          React.createElement(ColumnHeaderFilter, {
            label: field.label,
            isPrimary,
            isSorted: column.getIsSorted(),
            onToggleSort: (e: React.MouseEvent) => {
              column.toggleSorting(undefined, e.shiftKey);
            },
            filterValue: columnFilters[field.id] ?? "",
            onApplyFilter: (val: string) => handleSetFieldFilter(field.id, val),
          }),
        cell: (info) => {
          const rawVal = info.getValue();
          const displayVal =
            field.type === "relation"
              ? formatRelationSummaryCell(rawVal, field, relationLookupMap)
              : formatFieldDisplayValue(rawVal, field);

          return React.createElement(
            "div",
            {
              className: isPrimary
                ? "max-w-full truncate text-xs font-semibold whitespace-nowrap"
                : "max-w-full truncate text-xs whitespace-nowrap",
              title: displayVal,
            },
            displayVal
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
        return React.createElement(
          "div",
          { className: "flex items-center gap-1.5 pr-2" },
          React.createElement(
            "button",
            {
              type: "button",
              onClick: (e: React.MouseEvent) => column.toggleSorting(undefined, e.shiftKey),
              className:
                "hover:text-foreground flex items-center gap-1.5 truncate font-semibold transition-colors",
              title: `${SYSTEM_COLUMN_LABELS.createdAt} (클릭하여 정렬, Shift+클릭 다중 정렬)`,
            },
            React.createElement("span", null, SYSTEM_COLUMN_LABELS.createdAt),
            isSorted === "asc"
              ? React.createElement(ArrowUp, { className: "text-primary size-3.5 shrink-0" })
              : isSorted === "desc"
                ? React.createElement(ArrowDown, { className: "text-primary size-3.5 shrink-0" })
                : React.createElement(ArrowUpDown, {
                    className: "text-muted-foreground/60 size-3 shrink-0 opacity-70",
                  })
          )
        );
      },
      cell: (info) => {
        const rawDate = info.getValue() as string | Date | undefined;
        const formatted = formatDateTime(rawDate);
        return React.createElement(
          "div",
          {
            className: "text-muted-foreground truncate text-xs whitespace-nowrap",
            title: formatted,
          },
          formatted
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
        return React.createElement(
          "div",
          { className: "flex items-center gap-1.5 pr-2" },
          React.createElement(
            "button",
            {
              type: "button",
              onClick: (e: React.MouseEvent) => column.toggleSorting(undefined, e.shiftKey),
              className:
                "hover:text-foreground flex items-center gap-1.5 truncate font-semibold transition-colors",
              title: `${SYSTEM_COLUMN_LABELS.updatedAt} (클릭하여 정렬, Shift+클릭 다중 정렬)`,
            },
            React.createElement("span", null, SYSTEM_COLUMN_LABELS.updatedAt),
            isSorted === "asc"
              ? React.createElement(ArrowUp, { className: "text-primary size-3.5 shrink-0" })
              : isSorted === "desc"
                ? React.createElement(ArrowDown, { className: "text-primary size-3.5 shrink-0" })
                : React.createElement(ArrowUpDown, {
                    className: "text-muted-foreground/60 size-3 shrink-0 opacity-70",
                  })
          )
        );
      },
      cell: (info) => {
        const rawDate = info.getValue() as string | Date | undefined;
        const formatted = formatDateTime(rawDate);
        return React.createElement(
          "div",
          {
            className: "text-muted-foreground truncate text-xs whitespace-nowrap",
            title: formatted,
          },
          formatted
        );
      },
      size: TABLE_COLUMN_WIDTH.DEFAULT,
      minSize: TABLE_COLUMN_WIDTH.MIN,
      maxSize: TABLE_COLUMN_WIDTH.MAX,
    });

    // 관리 액션 컬럼
    cols.push({
      id: "actions",
      header: () =>
        React.createElement(
          "div",
          { className: "text-left font-semibold" },
          SYSTEM_COLUMN_LABELS.actions
        ),
      cell: ({ row }) =>
        React.createElement(SubmissionActionCell, {
          submission: row.original,
          formId: form.id,
          deletingId,
          onDelete: handleDelete,
        }),
      size: 180,
      minSize: 180,
      enableResizing: false,
    });

    return cols;
  }, [
    activeFields,
    primaryFieldId,
    relationLookupMap,
    columnFilters,
    handleSetFieldFilter,
    form.id,
    deletingId,
    handleDelete,
  ]);

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

  return {
    table,
    flatSubmissions,
    totalCount,
    activeFields,
    primaryFieldId,
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
    handleDelete,
    handleRowClick,
  };
}
