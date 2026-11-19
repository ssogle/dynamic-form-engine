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
import { TABLE_COLUMN_WIDTH } from "@/shared/lib/virtual-table";
import {
  normalizeFieldFilterCondition,
  resolveTargetFieldCapability,
  serializeFieldFiltersParam,
  validateFiltersAgainstFields,
  type FieldFilterCondition,
} from "@/shared/schema";
import type { Form, CoreFormField } from "@/entities/form";
import {
  extractActiveFields,
  extractPrimaryFieldId,
  formatFieldDisplayValue,
  PrimaryFieldBadge,
} from "@/entities/form";
import {
  useInfiniteFormSubmissionsQuery,
  useDeleteSubmissionMutation,
  type FormSubmission,
  type SortItem,
  type SubmissionDateRangeFilter,
} from "@/entities/form-submission";
import { formatDateTime } from "@/shared/lib/date";
import { formatRelationSummaryCell, type RelationLookupMap } from "../lib/relation-summary";
import type { FormSubmissionViewMode } from "../types/submission-view.types";
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
  /**
   * URL 쿼리 파라미터로부터 전달된 초기 기간 필터 (분석 뷰 드릴다운 연동)
   */
  initialDateRange?: SubmissionDateRangeFilter | undefined;
  /**
   * URL 쿼리 파라미터로부터 전달된 초기 컬럼 필터 목록 (분석 뷰 드릴다운 연동)
   */
  initialFilters?: FieldFilterCondition[] | undefined;
  /**
   * URL 쿼리 파라미터로부터 전달된 초기 다중 정렬 목록
   */
  initialSort?: SortItem[] | undefined;
  /**
   * 테이블 동작 모드 (기본값: "consumer")
   */
  mode?: FormSubmissionViewMode | undefined;
  /**
   * 상세 화면 내 임베디드 렌더링 여부 (true 시 필터·정렬 변경 시 URL 쿼리 sync 생략)
   */
  embedded?: boolean | undefined;
  /**
   * 초기화(handleClearAllFilters) 시에도 항상 유지·합산되는 고정 필터 조건 목록 (역참조 필터링용)
   */
  lockedFilters?: FieldFilterCondition[] | undefined;
  /**
   * 프리뷰 모드에서 실데이터 0건일 때 폴백으로 표시할 가상 샘플 레코드 목록
   */
  sampleSubmissions?: FormSubmission[] | undefined;
  /**
   * 프리뷰 모드에서 행/상세 클릭 시 호출할 인라인 콜백
   */
  onSelectSubmission?: ((submissionId: string) => void) | undefined;
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
   * 현재 적용 중인 컬럼별 필터 맵
   */
  columnFilters: Record<string, FieldFilterCondition>;
  /**
   * 관계형 필드 요약/배지 표시용 조회 딕셔너리
   */
  relationLookupMap: RelationLookupMap;
  /**
   * 현재 적용 중인 기간 필터 상태
   */
  dateRangeFilter: SubmissionDateRangeFilter | undefined;
  /**
   * 기간 필터에 적용 중인 기준 날짜 필드 라벨 (예: "결제일" 또는 "제출일")
   */
  dateRangeFieldLabel: string;
  /**
   * 현재 적용 중인 컬럼 및 기간 필터 개수
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
   * 단일 컬럼 필터 값 설정 핸들러 (구조화 조건 객체 또는 레거시 문자열 지원)
   */
  handleSetFieldFilter: (fieldId: string, value: FieldFilterCondition | string | undefined) => void;
  /**
   * 모든 활성 컬럼 및 기간 필터 초기화 핸들러
   */
  handleClearAllFilters: () => void;
  /**
   * 기간 필터만 단독 해제하는 핸들러
   */
  handleClearDateRange: () => void;
  /**
   * 단건 응답 삭제 핸들러
   */
  handleDelete: (submissionId: string) => Promise<void>;
  /**
   * 행 클릭 시 상세 페이지 이동 핸들러
   */
  handleRowClick: (submissionId: string) => void;
  /**
   * 실데이터 부재로 인해 샘플 데이터를 미리보기로 렌더링 중인지 여부
   */
  isSamplePreview: boolean;
}

function buildInitialFiltersMap(
  initialFilters: FieldFilterCondition[] | undefined,
  activeFields: CoreFormField[]
): Record<string, FieldFilterCondition> {
  if (!initialFilters || initialFilters.length === 0) {
    return {};
  }
  const map: Record<string, FieldFilterCondition> = {};
  for (const item of initialFilters) {
    const check = validateFiltersAgainstFields([item], activeFields, { allowSystemFields: true });
    if (check.error === null && check.data[0]) {
      map[check.data[0].fieldId] = check.data[0];
    }
  }
  return map;
}

function serializeSortItems(sorting: SortingState): string {
  if (sorting.length === 0) return "createdAt:desc";
  return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
}

function buildConsumerFormUrl(
  formId: string,
  dateRange?: SubmissionDateRangeFilter,
  filters?: Record<string, FieldFilterCondition>,
  sorting?: SortingState
): string {
  const basePath = `/consumer/forms/${formId}`;
  const searchParams = new URLSearchParams();
  if (dateRange?.startDate) searchParams.set("startDate", dateRange.startDate);
  if (dateRange?.endDate) searchParams.set("endDate", dateRange.endDate);
  if (dateRange?.dateFieldId) searchParams.set("dateFieldId", dateRange.dateFieldId);

  const serializedFilters = serializeFieldFiltersParam(
    filters ? Object.values(filters) : undefined
  );
  if (serializedFilters) {
    searchParams.set("filters", serializedFilters);
  }
  const serializedSort = sorting ? serializeSortItems(sorting) : undefined;
  if (serializedSort && serializedSort !== "createdAt:desc") {
    searchParams.set("sort", serializedSort);
  }
  const qs = searchParams.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * 제출 응답 목록 가상화 테이블 비즈니스 오케스트레이션 전용 커스텀 훅 (useSubmissionListTable)
 *
 * 서버 무한 스크롤 연동, 다중 정렬/타입별 컬럼 필터 직렬화, 기간 필터 연동, TanStack Table 인스턴스화,
 * 컬럼 정의 생성, 삭제 인터랙션 및 라우팅 로직을 캡슐화합니다.
 */
export function useSubmissionListTable({
  form,
  initialDateRange,
  initialFilters,
  initialSort,
  mode = "consumer",
  embedded = false,
  lockedFilters,
  sampleSubmissions,
  onSelectSubmission,
}: UseSubmissionListTableParams): UseSubmissionListTableReturn {
  const router = useRouter();
  const activeFields = React.useMemo(() => extractActiveFields(form), [form]);
  const primaryFieldId = extractPrimaryFieldId(form);
  const resolvedInitialSorting = React.useMemo<SortingState>(
    () => (initialSort && initialSort.length > 0 ? initialSort : [{ id: "createdAt", desc: true }]),
    [initialSort]
  );
  const [sorting, setSorting] = React.useState<SortingState>(resolvedInitialSorting);
  const [columnFilters, setColumnFilters] = React.useState<Record<string, FieldFilterCondition>>(
    () => buildInitialFiltersMap(initialFilters, activeFields)
  );
  const [dateRangeFilter, setDateRangeFilter] = React.useState<
    SubmissionDateRangeFilter | undefined
  >(initialDateRange);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const initialStartDate = initialDateRange?.startDate;
  const initialEndDate = initialDateRange?.endDate;
  const initialDateFieldId = initialDateRange?.dateFieldId;
  const initialFiltersSignature = serializeFieldFiltersParam(initialFilters) ?? "";
  const initialSortSignature = serializeSortItems(resolvedInitialSorting);

  React.useEffect(() => {
    setSorting((prev) =>
      serializeSortItems(prev) === initialSortSignature ? prev : resolvedInitialSorting
    );
  }, [initialSortSignature, resolvedInitialSorting]);

  React.useEffect(() => {
    setDateRangeFilter((prev) => {
      if (!initialStartDate && !initialEndDate) {
        return prev === undefined ? prev : undefined;
      }
      if (
        prev?.startDate === initialStartDate &&
        prev?.endDate === initialEndDate &&
        prev?.dateFieldId === initialDateFieldId
      ) {
        return prev;
      }
      return {
        startDate: initialStartDate,
        endDate: initialEndDate,
        dateFieldId: initialDateFieldId,
      };
    });
  }, [initialStartDate, initialEndDate, initialDateFieldId]);

  React.useEffect(() => {
    setColumnFilters(buildInitialFiltersMap(initialFilters, activeFields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiltersSignature, activeFields]);

  // 활성 폼 스키마에 실제 존재하는 date 타입 필드인지 검증해 안전한 기준 축 ID/라벨 도출
  const resolvedDateMeta = React.useMemo(() => {
    if (!dateRangeFilter?.dateFieldId) return undefined;
    const matched = activeFields.find(
      (f) => f.id === dateRangeFilter.dateFieldId && f.type === "date"
    );
    return matched;
  }, [activeFields, dateRangeFilter?.dateFieldId]);

  const resolvedDateFieldId = resolvedDateMeta?.id;
  const dateRangeFieldLabel = resolvedDateMeta?.label ?? "제출일";
  const hasActiveDateRange = Boolean(dateRangeFilter?.startDate || dateRangeFilter?.endDate);

  // 1. 다중 정렬 파라미터 직렬화 (예: "f_exp:desc,createdAt:desc")
  const sortQueryString = React.useMemo(() => {
    if (sorting.length === 0) return "createdAt:desc";
    return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
  }, [sorting]);

  // 2. 컬럼별 필터 파라미터 직렬화 (고정 필터 lockedFilters + 사용자 필터 합산)
  const filtersQueryString = React.useMemo(() => {
    const merged = [...(lockedFilters ?? []), ...Object.values(columnFilters)];
    return serializeFieldFiltersParam(merged);
  }, [lockedFilters, columnFilters]);

  // 3. 서버 무한 스크롤 쿼리 훅 연동 (프리뷰 모드에서는 실데이터 조회를 전면 비활성화)
  const { data, isLoading, isError, error, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteFormSubmissionsQuery(mode === "preview" ? "" : form.id, {
      sort: sortQueryString,
      filters: filtersQueryString,
      limit: 20,
      startDate: dateRangeFilter?.startDate,
      endDate: dateRangeFilter?.endDate,
      dateFieldId: resolvedDateFieldId,
    });

  const { mutateAsync: deleteSubmission } = useDeleteSubmissionMutation(form.id);

  // 모든 누적 페이지 아이템 평탄화 (프리뷰 모드에서는 항상 스키마 기반 샘플 데이터만 사용)
  const serverSubmissions = React.useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  const serverTotalCount = data?.pages[0]?.totalCount ?? serverSubmissions.length;
  const isSamplePreview = mode === "preview";
  const flatSubmissions = React.useMemo(
    () => (isSamplePreview ? (sampleSubmissions ?? []) : serverSubmissions),
    [isSamplePreview, sampleSubmissions, serverSubmissions]
  );
  const totalCount = isSamplePreview ? flatSubmissions.length : serverTotalCount;

  // 샘플 데이터에는 실제 DB UUID가 없으므로 관계형 배치 조회를 생략해 불필요한 400 요청 방지
  const lookupTargets = React.useMemo(
    () => (isSamplePreview ? [] : serverSubmissions),
    [isSamplePreview, serverSubmissions]
  );
  const { lookupMap: relationLookupMap } = useRelationLookup(activeFields, lookupTargets);

  // 단일 컬럼 필터 갱신 핸들러 (문자열 전달 시 해당 필드의 기본 연산자로 자동 변환)
  // React 19 Strict Mode/동시성 렌더링에서 setState 업데이터 내부 부수효과(router.replace)를 금지하므로,
  // 다음 상태 객체를 외부에서 순수하게 계산한 뒤 상태 갱신과 URL 동기화를 분리 실행합니다.
  const handleSetFieldFilter = React.useCallback(
    (fieldId: string, value: FieldFilterCondition | string | undefined) => {
      const targetField = activeFields.find((f) => f.id === fieldId);
      const capability = resolveTargetFieldCapability(fieldId, targetField);

      const next = { ...columnFilters };
      if (value === undefined || value === "") {
        delete next[fieldId];
      } else if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
          delete next[fieldId];
        } else {
          const defaultOp = capability?.filterOperators.includes("contains")
            ? "contains"
            : (capability?.defaultOperator ?? "contains");
          next[fieldId] = { fieldId, op: defaultOp, value: trimmed };
        }
      } else {
        next[fieldId] = normalizeFieldFilterCondition(value);
      }

      setColumnFilters(next);
      if (mode !== "preview" && !embedded) {
        router.replace(buildConsumerFormUrl(form.id, dateRangeFilter, next, sorting), {
          scroll: false,
        });
      }
    },
    [activeFields, columnFilters, dateRangeFilter, embedded, form.id, mode, router, sorting]
  );

  // 기간 필터만 해제하고 URL 쿼리스트링도 함께 정리
  const handleClearDateRange = React.useCallback(() => {
    setDateRangeFilter(undefined);
    if (mode !== "preview" && !embedded) {
      router.replace(buildConsumerFormUrl(form.id, undefined, columnFilters, sorting), {
        scroll: false,
      });
    }
  }, [router, form.id, columnFilters, embedded, mode, sorting]);

  // 전체 필터 초기화
  const handleClearAllFilters = React.useCallback(() => {
    setColumnFilters({});
    if (hasActiveDateRange) {
      setDateRangeFilter(undefined);
    }
    if (mode !== "preview" && !embedded) {
      router.replace(buildConsumerFormUrl(form.id, undefined, undefined, sorting), {
        scroll: false,
      });
    }
  }, [hasActiveDateRange, router, embedded, form.id, mode, sorting]);

  // 단건 응답 삭제 핸들러 (프리뷰 모드에서는 차단)
  const handleDelete = React.useCallback(
    async (submissionId: string) => {
      if (mode === "preview") {
        return;
      }
      try {
        setDeletingId(submissionId);
        await deleteSubmission(submissionId);
      } catch (err) {
        console.error("응답 삭제 실패:", err);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteSubmission, mode]
  );

  // 행 클릭 시 상세 화면 전환 핸들러 (프리뷰 모드에서는 데이터 행 클릭 동작 비활성화)
  const handleRowClick = React.useCallback(
    (submissionId: string) => {
      if (mode === "preview") {
        return;
      }
      router.push(`/consumer/forms/${form.id}/submissions/${submissionId}`);
    },
    [mode, router, form.id]
  );

  // 4. 동적 TanStack 컬럼 정의 (순수 createElement 기반)
  const columns = React.useMemo<ColumnDef<FormSubmission>[]>(() => {
    const cols: ColumnDef<FormSubmission>[] = [];
    const renderStaticHeader = (label: string, isPrimary = false) =>
      React.createElement(
        "div",
        { className: "flex items-center gap-1.5 py-1 text-xs font-semibold whitespace-nowrap" },
        label,
        isPrimary ? React.createElement(PrimaryFieldBadge) : null
      );

    // 폼 활성 필드별 동적 컬럼 생성
    activeFields.forEach((field: CoreFormField) => {
      const isPrimary = field.id === primaryFieldId;
      cols.push({
        id: field.id,
        accessorFn: (row) => row.data?.[field.id],
        header: ({ column }) =>
          isSamplePreview
            ? renderStaticHeader(field.label, isPrimary)
            : React.createElement(ColumnHeaderFilter, {
                fieldId: field.id,
                label: field.label,
                fieldType: field.type,
                options: field.options,
                relationTargetFormId: field.relationConfig?.targetFormId,
                isPrimary,
                isSorted: column.getIsSorted(),
                onToggleSort: (e: React.MouseEvent) => {
                  column.toggleSorting(undefined, e.shiftKey);
                },
                filterCondition: columnFilters[field.id],
                onApplyFilter: (condition?: FieldFilterCondition) =>
                  handleSetFieldFilter(field.id, condition),
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
      header: ({ column }) =>
        isSamplePreview
          ? renderStaticHeader(SYSTEM_COLUMN_LABELS.createdAt)
          : React.createElement(ColumnHeaderFilter, {
              fieldId: "createdAt",
              label: SYSTEM_COLUMN_LABELS.createdAt,
              fieldType: "system_date",
              isSorted: column.getIsSorted(),
              onToggleSort: (e: React.MouseEvent) => {
                column.toggleSorting(undefined, e.shiftKey);
              },
              filterCondition: columnFilters.createdAt,
              onApplyFilter: (condition?: FieldFilterCondition) =>
                handleSetFieldFilter("createdAt", condition),
            }),
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
      header: ({ column }) =>
        isSamplePreview
          ? renderStaticHeader(SYSTEM_COLUMN_LABELS.updatedAt)
          : React.createElement(ColumnHeaderFilter, {
              fieldId: "updatedAt",
              label: SYSTEM_COLUMN_LABELS.updatedAt,
              fieldType: "system_date",
              isSorted: column.getIsSorted(),
              onToggleSort: (e: React.MouseEvent) => {
                column.toggleSorting(undefined, e.shiftKey);
              },
              filterCondition: columnFilters.updatedAt,
              onApplyFilter: (condition?: FieldFilterCondition) =>
                handleSetFieldFilter("updatedAt", condition),
            }),
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
          mode,
          onSelectSubmission,
        }),
      size: mode === "preview" ? 96 : 180,
      minSize: mode === "preview" ? 80 : 180,
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
    mode,
    onSelectSubmission,
    isSamplePreview,
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
  }, [sortQueryString, filtersQueryString, dateRangeFilter]);

  const activeFilterCount = Object.keys(columnFilters).length + (hasActiveDateRange ? 1 : 0);

  return {
    table,
    flatSubmissions,
    totalCount,
    activeFields,
    primaryFieldId,
    columnFilters,
    relationLookupMap,
    dateRangeFilter: hasActiveDateRange
      ? {
          startDate: dateRangeFilter?.startDate,
          endDate: dateRangeFilter?.endDate,
          dateFieldId: resolvedDateFieldId,
        }
      : undefined,
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
    handleDelete,
    handleRowClick,
    isSamplePreview,
  };
}
