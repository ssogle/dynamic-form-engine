import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Form } from "@/entities/form";
import { useSubmissionListTable } from "./use-submission-list-table.hook";

// Router 모킹
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// React Query & Entities 모킹
const mockFetchNextPage = vi.fn();
const mockDeleteSubmission = vi.fn();
const mockUseInfiniteQuery = vi.fn();
const mockGetFormDetail = vi.fn();
const mockGetFormSubmissionsByIds = vi.fn();

vi.mock("@/entities/form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form")>();
  return {
    ...actual,
    getFormDetail: (formId: string) => mockGetFormDetail(formId),
  };
});

vi.mock("@/entities/form-submission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form-submission")>();
  return {
    ...actual,
    useInfiniteFormSubmissionsQuery: (formId: string, options: unknown) =>
      mockUseInfiniteQuery(formId, options),
    getFormSubmissionsByIds: (formId: string, ids: string[]) =>
      mockGetFormSubmissionsByIds(formId, ids),
    useDeleteSubmissionMutation: () => ({
      mutateAsync: mockDeleteSubmission,
    }),
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("useSubmissionListTable (features/manage-form-submissions/hooks)", () => {
  const dummyForm: Form = {
    id: "form-uuid-1",
    title: "설문 폼",
    description: "테스트 폼 설명",
    schemaDefinition: {
      version: "1.0",
      primaryFieldId: "field-name",
      fields: [
        {
          id: "field-name",
          label: "이름",
          type: "text",
          required: true,
          description: "응답자의 성명을 기록합니다.",
          order: 0,
        },
      ],
    },
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };

  const dummySubmissions = [
    {
      id: "sub-1",
      formId: "form-uuid-1",
      version: 1,
      data: { "field-name": "홍길동" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            items: dummySubmissions,
            totalCount: 1,
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    });
  });

  it("초기 렌더링 시 기본 정렬(createdAt:desc)로 쿼리를 호출하고 primaryFieldId 및 TanStack Table 인스턴스를 반환해야 한다", () => {
    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }), {
      wrapper: createWrapper(),
    });

    expect(mockUseInfiniteQuery).toHaveBeenCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        sort: "createdAt:desc",
        limit: 20,
      })
    );

    expect(result.current.primaryFieldId).toBe("field-name");
    expect(result.current.flatSubmissions).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.table).toBeDefined();
    expect(typeof result.current.table.getHeaderGroups).toBe("function");
  });

  it("handleRowClick을 호출하면 상세 페이지로 라우팅되어야 한다", () => {
    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleRowClick("sub-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-uuid-1/submissions/sub-1");
  });

  it("handleClearAllFilters를 호출하면 적용된 모든 필터가 초기화되어야 한다", () => {
    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }), {
      wrapper: createWrapper(),
    });

    // 필터 수동 주입 시뮬레이션
    act(() => {
      result.current.handleSetFieldFilter("field-name", "홍길동");
    });

    expect(result.current.activeFilterCount).toBe(1);

    act(() => {
      result.current.handleClearAllFilters();
    });

    expect(result.current.activeFilterCount).toBe(0);
  });

  it("handleDelete를 호출하면 삭제 뮤테이션이 실행되어야 한다", async () => {
    mockDeleteSubmission.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleDelete("sub-1");
    });

    expect(mockDeleteSubmission).toHaveBeenCalledWith("sub-1");
  });

  it("관계형(relation) 필드가 포함된 경우 타깃 폼과 선택된 레코드들을 배치 조회하여 셀에 대표값 요약을 표시해야 한다", async () => {
    const targetFormId = "22222222-2222-4222-a222-222222222222";
    const subAId = "aaaa1111-1111-4111-a111-111111111111";
    const subBId = "bbbb2222-2222-4222-a222-222222222222";

    const formWithRelation: Form = {
      ...dummyForm,
      schemaDefinition: {
        primaryFieldId: "field-name",
        fields: [
          {
            id: "field-name",
            label: "이름",
            type: "text",
            required: true,
            description: "성명",
          },
          {
            id: "field-project",
            label: "참조 프로젝트",
            type: "relation",
            required: false,
            description: "귀속 프로젝트 연결",
            relationConfig: { targetFormId, multiple: true },
          },
        ],
      },
    };

    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                id: "sub-rel-1",
                formId: "form-uuid-1",
                data: { "field-name": "홍길동", "field-project": [subAId, subBId] },
                createdAt: new Date("2026-01-01T00:00:00Z"),
                updatedAt: new Date("2026-01-01T00:00:00Z"),
                deletedAt: null,
              },
            ],
            totalCount: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    });

    mockGetFormDetail.mockResolvedValue({
      id: targetFormId,
      title: "프로젝트 관리",
      schemaDefinition: {
        primaryFieldId: "p_name",
        fields: [
          {
            id: "p_name",
            label: "프로젝트명",
            type: "text",
            required: true,
            description: "프로젝트 이름",
          },
        ],
      },
    });

    mockGetFormSubmissionsByIds.mockResolvedValue([
      {
        id: subAId,
        formId: targetFormId,
        data: { p_name: "차세대 ERP 구축" },
      },
      {
        id: subBId,
        formId: targetFormId,
        data: { p_name: "AI 검색 고도화" },
      },
    ]);

    const { result } = renderHook(() => useSubmissionListTable({ form: formWithRelation }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const relCell = result.current.table
        .getRowModel()
        .rows[0]?.getVisibleCells()
        .find((c) => c.column.id === "field-project");
      const rendered = relCell?.column.columnDef.cell;
      expect(typeof rendered).toBe("function");
      const el =
        typeof rendered === "function"
          ? (rendered(relCell!.getContext()) as React.ReactElement<{ title?: string }>)
          : undefined;
      expect(el?.props.title).toBe("차세대 ERP 구축 외 1건");
    });

    expect(mockGetFormDetail).toHaveBeenCalledWith(targetFormId);
    expect(mockGetFormSubmissionsByIds).toHaveBeenCalledWith(targetFormId, [subAId, subBId]);
  });

  it("select 및 checkbox 필드의 셀 렌더링 시 내부 코드값 대신 옵션의 한글 라벨(비활성 옵션 포함)을 표시해야 한다", () => {
    const formWithOptions: Form = {
      ...dummyForm,
      schemaDefinition: {
        primaryFieldId: "field-priority",
        fields: [
          {
            id: "field-priority",
            label: "우선순위",
            type: "select",
            required: true,
            description: "긴급도 구분",
            options: [
              { label: "긴급", value: "HIGH", description: "즉시 처리", disabled: false },
              { label: "과거보류", value: "LEGACY_HOLD", description: "폐기 옵션", disabled: true },
            ],
          },
          {
            id: "field-tags",
            label: "비용 항목",
            type: "checkbox",
            required: false,
            description: "복수 항목 선택",
            options: [
              { label: "식대", value: "MEAL", description: "식비", disabled: false },
              { label: "교통비", value: "TAXI", description: "이동비", disabled: false },
            ],
          },
        ],
      },
    };

    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                id: "sub-opt-1",
                formId: "form-uuid-1",
                data: { "field-priority": "LEGACY_HOLD", "field-tags": ["MEAL", "TAXI"] },
                createdAt: new Date("2026-01-01T00:00:00Z"),
                updatedAt: new Date("2026-01-01T00:00:00Z"),
                deletedAt: null,
              },
            ],
            totalCount: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    });

    const { result } = renderHook(() => useSubmissionListTable({ form: formWithOptions }), {
      wrapper: createWrapper(),
    });

    const cells = result.current.table.getRowModel().rows[0]?.getVisibleCells() ?? [];
    const priorityCell = cells.find((c) => c.column.id === "field-priority");
    const tagsCell = cells.find((c) => c.column.id === "field-tags");

    const renderCellTitle = (cell: typeof priorityCell) => {
      const cellDef = cell?.column.columnDef.cell;
      const el =
        typeof cellDef === "function"
          ? (cellDef(cell!.getContext()) as React.ReactElement<{ title?: string }>)
          : undefined;
      return el?.props.title;
    };

    expect(renderCellTitle(priorityCell)).toBe("과거보류");
    expect(renderCellTitle(tagsCell)).toBe("식대, 교통비");
  });

  it("initialDateRange 전달 시 무한 스크롤 쿼리에 기간 파라미터를 전달하고, 해제 시 URL 쿼리를 제거해야 한다", () => {
    const formWithDate: Form = {
      ...dummyForm,
      schemaDefinition: {
        primaryFieldId: "field-name",
        fields: [
          ...dummyForm.schemaDefinition.fields,
          {
            id: "field-paid-at",
            label: "결제일",
            type: "date",
            required: true,
            description: "실제 결제일",
            order: 1,
          },
        ],
      },
    };

    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: formWithDate,
          initialDateRange: {
            startDate: "2026-09-01",
            endDate: "2026-11-16",
            dateFieldId: "field-paid-at",
          },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        startDate: "2026-09-01",
        endDate: "2026-11-16",
        dateFieldId: "field-paid-at",
      })
    );
    expect(result.current.dateRangeFieldLabel).toBe("결제일");
    expect(result.current.activeFilterCount).toBe(1);

    act(() => {
      result.current.handleClearDateRange();
    });

    expect(result.current.dateRangeFilter).toBeUndefined();
    expect(result.current.activeFilterCount).toBe(0);
    expect(mockReplace).toHaveBeenCalledWith("/consumer/forms/form-uuid-1", { scroll: false });
  });

  it("initialFilters 전달 시 직렬화된 filters 쿼리를 전송하고, 구조화 필터 설정 시 URL 쿼리를 동기화해야 한다", () => {
    const formWithNumber: Form = {
      ...dummyForm,
      schemaDefinition: {
        primaryFieldId: "field-name",
        fields: [
          ...dummyForm.schemaDefinition.fields,
          {
            id: "field-amount",
            label: "금액",
            type: "number",
            required: false,
            description: "지출 금액",
          },
        ],
      },
    };

    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: formWithNumber,
          initialFilters: [{ fieldId: "field-amount", op: "between", min: 1000, max: 5000 }],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.activeFilterCount).toBe(1);
    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        filters: JSON.stringify([{ fieldId: "field-amount", op: "between", min: 1000, max: 5000 }]),
      })
    );

    act(() => {
      result.current.handleSetFieldFilter("createdAt", {
        fieldId: "createdAt",
        op: "gte",
        value: "2026-10-01",
      });
    });

    expect(result.current.activeFilterCount).toBe(2);
    expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining("filters="), {
      scroll: false,
    });
  });

  it("initialFilters에 날짜 형식이 아닌 값이 포함된 경우 안전하게 무시해야 한다", () => {
    const formWithDate: Form = {
      ...dummyForm,
      schemaDefinition: {
        primaryFieldId: "field-name",
        fields: [
          ...dummyForm.schemaDefinition.fields,
          {
            id: "field-date",
            label: "결제일",
            type: "date",
            required: false,
            description: "결제 날짜",
          },
        ],
      },
    };

    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: formWithDate,
          initialFilters: [
            { fieldId: "field-date", op: "eq", value: "not-a-date" },
            { fieldId: "createdAt", op: "gte", value: "2026-02-31" },
          ],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.columnFilters).toEqual({});
  });

  it("preview 모드에서는 실데이터 조회를 비활성화하고 sampleSubmissions만 사용하며 행 클릭·라우팅·삭제를 차단해야 한다", async () => {
    const onSelectSubmission = vi.fn();
    const sampleSubmissions = [
      {
        id: "sample-preview-1",
        formId: "form-uuid-1",
        version: 1,
        data: { "field-name": "이름 예시 1" },
        createdAt: new Date("2026-11-18T09:00:00.000Z"),
        updatedAt: new Date("2026-11-18T09:00:00.000Z"),
        deletedAt: null,
      },
    ];

    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: dummyForm,
          mode: "preview",
          sampleSubmissions,
          onSelectSubmission,
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith("", expect.any(Object));
    expect(result.current.isSamplePreview).toBe(true);
    expect(result.current.flatSubmissions).toEqual(sampleSubmissions);
    expect(result.current.totalCount).toBe(1);

    act(() => {
      result.current.handleRowClick("sample-preview-1");
      result.current.handleSetFieldFilter("field-name", "예시");
      result.current.handleClearAllFilters();
    });

    expect(onSelectSubmission).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDelete("sample-preview-1");
    });

    expect(mockDeleteSubmission).not.toHaveBeenCalled();
  });

  it("preview 모드에서는 sampleSubmissions가 비어 있을 때도 실데이터 대신 빈 목록을 반환해야 한다", () => {
    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: dummyForm,
          mode: "preview",
          sampleSubmissions: [],
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith("", expect.any(Object));
    expect(result.current.isSamplePreview).toBe(true);
    expect(result.current.flatSubmissions).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it("initialSort가 전달되면 초기 정렬 상태와 쿼리 파라미터를 반영하고 변경 시 동기화해야 한다", () => {
    const { rerender } = renderHook(
      ({ initialSort }) =>
        useSubmissionListTable({
          form: dummyForm,
          initialSort,
        }),
      {
        wrapper: createWrapper(),
        initialProps: {
          initialSort: [{ id: "field-name", desc: false }],
        },
      }
    );

    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        sort: "field-name:asc",
      })
    );

    rerender({
      initialSort: [{ id: "createdAt", desc: true }],
    });

    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        sort: "createdAt:desc",
      })
    );
  });

  it("embedded 및 lockedFilters 전달 시 필터 초기화 후에도 고정 필터를 유지하고 URL 동기화를 생략해야 한다", () => {
    const lockedFilter = {
      fieldId: "field-name",
      op: "contains" as const,
      value: "프로젝트",
    };

    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: dummyForm,
          embedded: true,
          lockedFilters: [lockedFilter],
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        filters: JSON.stringify([lockedFilter]),
      })
    );

    act(() => {
      result.current.handleSetFieldFilter("field-name", "추가검색");
    });
    expect(mockReplace).not.toHaveBeenCalled();

    act(() => {
      result.current.handleClearAllFilters();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockUseInfiniteQuery).toHaveBeenLastCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        filters: JSON.stringify([lockedFilter]),
      })
    );
  });

  it("정렬 배지 제거(handleRemoveSort) 및 초기화(handleResetSorting) 시 기본 정렬(createdAt:desc)과 URL 동기화를 올바르게 복원해야 한다", () => {
    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: dummyForm,
          initialSort: [
            { id: "field-name", desc: false },
            { id: "createdAt", desc: true },
          ],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isDefaultSorting).toBe(false);
    expect(result.current.sorting).toEqual([
      { id: "field-name", desc: false },
      { id: "createdAt", desc: true },
    ]);

    act(() => {
      result.current.handleRemoveSort("field-name");
    });

    expect(result.current.sorting).toEqual([{ id: "createdAt", desc: true }]);
    expect(result.current.isDefaultSorting).toBe(true);
    expect(mockReplace).toHaveBeenLastCalledWith("/consumer/forms/form-uuid-1", { scroll: false });

    act(() => {
      result.current.handleRemoveSort("createdAt");
    });
    expect(result.current.sorting).toEqual([{ id: "createdAt", desc: true }]);
    expect(result.current.isDefaultSorting).toBe(true);

    act(() => {
      result.current.handleResetSorting();
    });
    expect(result.current.sorting).toEqual([{ id: "createdAt", desc: true }]);
  });

  it("compact 또는 selectionMode 설정 시 __select 체크박스 열 추가 및 actions 열 숨김이 적용되어야 한다", () => {
    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: dummyForm,
          compact: true,
          selectionMode: {
            multiple: true,
            selectedIds: ["sub-1"],
            onToggleSelect: vi.fn(),
          },
        }),
      { wrapper: createWrapper() }
    );

    const columnIds = result.current.table.getAllColumns().map((col) => col.id);
    expect(columnIds[0]).toBe("__select");
    expect(columnIds).not.toContain("actions");
  });

  it("onRemoveSelectedRow 전달 시 우측 __unlink 열이 추가되고 기본 actions 열은 숨겨져야 한다", () => {
    const onRemoveSelectedRow = vi.fn();
    const { result } = renderHook(
      () =>
        useSubmissionListTable({
          form: dummyForm,
          embedded: true,
          compact: true,
          onRemoveSelectedRow,
        }),
      { wrapper: createWrapper() }
    );

    const columnIds = result.current.table.getAllColumns().map((col) => col.id);
    expect(columnIds[columnIds.length - 1]).toBe("__unlink");
    expect(columnIds).not.toContain("actions");
  });
});
