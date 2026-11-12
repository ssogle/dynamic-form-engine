import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Form } from "@/entities/form";
import { useSubmissionListTable } from "./use-submission-list-table.hook";

// Router 모킹
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// React Query 모킹
const mockFetchNextPage = vi.fn();
const mockDeleteSubmission = vi.fn();
const mockUseInfiniteQuery = vi.fn();

vi.mock("@/entities/form-submission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form-submission")>();
  return {
    ...actual,
    useInfiniteFormSubmissionsQuery: (formId: string, options: unknown) =>
      mockUseInfiniteQuery(formId, options),
    useDeleteSubmissionMutation: () => ({
      mutateAsync: mockDeleteSubmission,
    }),
  };
});

describe("useSubmissionListTable (features/manage-form-submissions/hooks)", () => {
  const dummyForm: Form = {
    id: "form-uuid-1",
    title: "설문 폼",
    description: "테스트 폼 설명",
    schemaDefinition: {
      version: "1.0",
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };

  const dummySubmissions = [
    {
      id: "sub-1",
      formId: "form-uuid-1",
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

  it("초기 렌더링 시 기본 정렬(createdAt:desc)로 쿼리를 호출하고 TanStack Table 인스턴스를 반환해야 한다", () => {
    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }));

    expect(mockUseInfiniteQuery).toHaveBeenCalledWith(
      "form-uuid-1",
      expect.objectContaining({
        sort: "createdAt:desc",
        limit: 20,
      })
    );

    expect(result.current.flatSubmissions).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.table).toBeDefined();
    expect(typeof result.current.table.getHeaderGroups).toBe("function");
  });

  it("handleRowClick을 호출하면 상세 페이지로 라우팅되어야 한다", () => {
    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }));

    act(() => {
      result.current.handleRowClick("sub-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-uuid-1/submissions/sub-1");
  });

  it("handleClearAllFilters를 호출하면 적용된 모든 필터가 초기화되어야 한다", () => {
    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }));

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

    const { result } = renderHook(() => useSubmissionListTable({ form: dummyForm }));

    await act(async () => {
      await result.current.handleDelete("sub-1");
    });

    expect(mockDeleteSubmission).toHaveBeenCalledWith("sub-1");
  });
});
