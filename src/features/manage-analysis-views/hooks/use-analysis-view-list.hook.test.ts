import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnalysisViewList } from "./use-analysis-view-list.hook";

const mockPublishMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockUseAnalysisViewsQuery = vi.fn();

vi.mock("@/entities/analysis-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/analysis-view")>();
  return {
    ...actual,
    useAnalysisViewsQuery: () => mockUseAnalysisViewsQuery(),
    usePublishAnalysisViewMutation: () => ({
      mutateAsync: mockPublishMutateAsync,
      isPending: false,
    }),
    useDeleteAnalysisViewMutation: () => ({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    }),
  };
});

describe("useAnalysisViewList (manage-analysis-views/hooks)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAnalysisViewsQuery.mockReturnValue({
      data: [
        {
          id: "view-1",
          title: "매출 요약",
          description: null,
          blocks: [],
          publishedAt: null,
          createdAt: new Date("2026-02-01T00:00:00Z"),
          updatedAt: new Date("2026-02-01T00:00:00Z"),
          deletedAt: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("목록 쿼리 데이터와 발행/삭제 액션 핸들러를 노출한다", async () => {
    mockPublishMutateAsync.mockResolvedValueOnce({ id: "view-1" });
    mockDeleteMutateAsync.mockResolvedValueOnce({ id: "view-1" });

    const { result } = renderHook(() => useAnalysisViewList());
    expect(result.current.views).toHaveLength(1);

    await act(async () => {
      await result.current.handleTogglePublish("view-1", true);
      await result.current.handleDeleteView("view-1");
    });

    expect(mockPublishMutateAsync).toHaveBeenCalledWith({ id: "view-1", isPublished: true });
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("view-1");
    expect(result.current.actionErrorMessage).toBeNull();
  });

  it("발행 또는 삭제 실패 시 window.alert 대신 actionErrorMessage 상태로 에러를 노출한다", async () => {
    mockPublishMutateAsync.mockRejectedValueOnce({
      message: "분석 뷰를 발행하려면 최소 1개 이상의 콘텐츠 블록이 필요합니다.",
    });

    const { result } = renderHook(() => useAnalysisViewList());

    await act(async () => {
      await result.current.handleTogglePublish("view-1", true);
    });

    expect(result.current.actionErrorMessage).toBe(
      "분석 뷰를 발행하려면 최소 1개 이상의 콘텐츠 블록이 필요합니다."
    );
  });
});
