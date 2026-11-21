"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  buildAnalysisViewRefreshPrompt,
  extractAnalysisBlocks,
  useAnalysisViewDetailQuery,
  useAnalysisViewRefreshStore,
  useDeleteAnalysisViewMutation,
  usePublishAnalysisViewMutation,
  type AnalysisView,
} from "@/entities/analysis-view";

export interface UseAnalysisViewActionsParams {
  viewId: string;
}

export interface UseAnalysisViewActionsReturn {
  view: AnalysisView | undefined;
  isLoading: boolean;
  isError: boolean;
  error: { message?: string } | null;
  isPublished: boolean;
  canPublish: boolean;
  canRefresh: boolean;
  actionErrorMessage: string | null;
  refreshStatusMessage: string | null;
  isPublishPending: boolean;
  isRefreshPending: boolean;
  isDeletePending: boolean;
  handleTogglePublish: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleDelete: () => Promise<void>;
}

/**
 * 분석 뷰 상세 캔버스 상단 액션 바(발행 토글, 최신 데이터 재집계, 삭제 및 목록 복귀) 오케스트레이션 훅
 */
export function useAnalysisViewActions({
  viewId,
}: UseAnalysisViewActionsParams): UseAnalysisViewActionsReturn {
  const router = useRouter();
  const {
    data: view,
    isLoading,
    isError,
    error,
  } = useAnalysisViewDetailQuery(viewId, {
    publishedOnly: false,
  });
  const publishMutation = usePublishAnalysisViewMutation();
  const deleteMutation = useDeleteAnalysisViewMutation();
  const pendingRefresh = useAnalysisViewRefreshStore((state) => state.pendingRefresh);
  const isRefreshingByAi = useAnalysisViewRefreshStore((state) => state.isRefreshingByAi);
  const requestAiRefresh = useAnalysisViewRefreshStore((state) => state.requestAiRefresh);
  const [actionErrorMessage, setActionErrorMessage] = React.useState<string | null>(null);
  const [refreshStatusMessage, setRefreshStatusMessage] = React.useState<string | null>(null);
  const wasRefreshingRef = React.useRef(false);

  const isPublished = Boolean(view?.publishedAt);
  const blockCount = extractAnalysisBlocks(view).length;
  const canPublish = isPublished || blockCount > 0;
  const canRefresh = blockCount > 0;
  const isRefreshPending = isRefreshingByAi || pendingRefresh?.viewId === view?.id;

  React.useEffect(() => {
    if (wasRefreshingRef.current && !isRefreshPending) {
      setRefreshStatusMessage("Analyst AI가 최신 데이터를 기준으로 문서를 업데이트했습니다.");
    }
    wasRefreshingRef.current = isRefreshPending;
  }, [isRefreshPending]);

  const handleTogglePublish = React.useCallback(async () => {
    if (!view) return;
    setActionErrorMessage(null);
    setRefreshStatusMessage(null);
    const nextPublishedState = !Boolean(view.publishedAt);
    try {
      await publishMutation.mutateAsync({ id: view.id, isPublished: nextPublishedState });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "발행 상태를 변경하지 못했습니다.";
      setActionErrorMessage(message);
    }
  }, [view, publishMutation]);

  const handleRefresh = React.useCallback(async () => {
    if (!view || isRefreshPending) return;
    setActionErrorMessage(null);
    requestAiRefresh({
      viewId: view.id,
      viewTitle: view.title,
      prompt: buildAnalysisViewRefreshPrompt({ id: view.id, title: view.title }),
      requestedAt: Date.now(),
    });
    setRefreshStatusMessage(
      "Analyst AI에게 최신 데이터 기준 전체 블록(요약 글·표·차트) 재집계를 요청했습니다."
    );
  }, [view, isRefreshPending, requestAiRefresh]);

  const handleDelete = React.useCallback(async () => {
    if (!view) return;
    setActionErrorMessage(null);
    setRefreshStatusMessage(null);
    try {
      await deleteMutation.mutateAsync(view.id);
      router.push("/analyst/views");
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "분석 뷰를 삭제하지 못했습니다.";
      setActionErrorMessage(message);
    }
  }, [view, deleteMutation, router]);

  return {
    view,
    isLoading,
    isError,
    error,
    isPublished,
    canPublish,
    canRefresh,
    actionErrorMessage,
    refreshStatusMessage,
    isPublishPending: publishMutation.isPending,
    isRefreshPending,
    isDeletePending: deleteMutation.isPending,
    handleTogglePublish,
    handleRefresh,
    handleDelete,
  };
}
