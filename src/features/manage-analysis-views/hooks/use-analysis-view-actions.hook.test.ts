import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnalysisViewRefreshStore } from "@/entities/analysis-view";
import { useAnalysisViewActions } from "./use-analysis-view-actions.hook";

const mockPush = vi.fn();
const mockPublishMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockUseAnalysisViewDetailQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/entities/analysis-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/analysis-view")>();
  return {
    ...actual,
    useAnalysisViewDetailQuery: (...args: unknown[]) => mockUseAnalysisViewDetailQuery(...args),
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

describe("useAnalysisViewActions (manage-analysis-views/hooks)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAnalysisViewRefreshStore.setState({ pendingRefresh: null, isRefreshingByAi: false });
  });

  it("블록이 0개이고 미발행 상태이면 canPublish는 false여야 한다", () => {
    mockUseAnalysisViewDetailQuery.mockReturnValue({
      data: {
        id: "view-1",
        title: "빈 문서",
        description: null,
        blocks: [],
        publishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        deletedAt: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() => useAnalysisViewActions({ viewId: "view-1" }));
    expect(result.current.isPublished).toBe(false);
    expect(result.current.canPublish).toBe(false);
  });

  it("블록이 1개 이상일 때 handleTogglePublish로 발행 전환을 수행하고, handleDelete 후 목록으로 이동한다", async () => {
    mockUseAnalysisViewDetailQuery.mockReturnValue({
      data: {
        id: "view-1",
        title: "완성 문서",
        description: null,
        blocks: [{ id: "b1", type: "text", content: "내용" }],
        publishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        deletedAt: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockPublishMutateAsync.mockResolvedValueOnce({ id: "view-1" });
    mockDeleteMutateAsync.mockResolvedValueOnce({ id: "view-1" });

    const { result } = renderHook(() => useAnalysisViewActions({ viewId: "view-1" }));
    expect(result.current.canPublish).toBe(true);

    await act(async () => {
      await result.current.handleTogglePublish();
    });
    expect(mockPublishMutateAsync).toHaveBeenCalledWith({ id: "view-1", isPublished: true });

    await act(async () => {
      await result.current.handleDelete();
    });
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("view-1");
    expect(mockPush).toHaveBeenCalledWith("/analyst/views");
  });

  it("handleRefresh는 Analyst AI 재집계 요청을 스토어에 등록하고 AI 작업 상태에 따라 isRefreshPending과 상태 메시지를 갱신한다", async () => {
    mockUseAnalysisViewDetailQuery.mockReturnValue({
      data: {
        id: "view-1",
        title: "재집계 문서",
        description: null,
        blocks: [{ id: "b1", type: "text", content: "내용" }],
        publishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        deletedAt: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() => useAnalysisViewActions({ viewId: "view-1" }));
    expect(result.current.canRefresh).toBe(true);
    expect(result.current.isRefreshPending).toBe(false);

    await act(async () => {
      await result.current.handleRefresh();
    });

    const pending = useAnalysisViewRefreshStore.getState().pendingRefresh;
    expect(pending?.viewId).toBe("view-1");
    expect(pending?.prompt).toContain("재집계 문서");
    expect(pending?.prompt).toContain("SET_ALL_BLOCKS");
    expect(result.current.isRefreshPending).toBe(true);
    expect(result.current.refreshStatusMessage).toContain("Analyst AI");

    act(() => {
      useAnalysisViewRefreshStore.setState({ pendingRefresh: null, isRefreshingByAi: true });
    });
    expect(result.current.isRefreshPending).toBe(true);

    act(() => {
      useAnalysisViewRefreshStore.setState({ pendingRefresh: null, isRefreshingByAi: false });
    });
    expect(result.current.isRefreshPending).toBe(false);
    expect(result.current.refreshStatusMessage).toContain("업데이트했습니다");
  });
});
