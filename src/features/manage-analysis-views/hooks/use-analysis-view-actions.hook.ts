"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  extractAnalysisBlocks,
  useAnalysisViewDetailQuery,
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
  actionErrorMessage: string | null;
  isPublishPending: boolean;
  isDeletePending: boolean;
  handleTogglePublish: () => Promise<void>;
  handleDelete: () => Promise<void>;
}

/**
 * 분석 뷰 상세 캔버스 상단 액션 바(발행 토글, 삭제 및 목록 복귀) 오케스트레이션 훅
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
  const [actionErrorMessage, setActionErrorMessage] = React.useState<string | null>(null);

  const isPublished = Boolean(view?.publishedAt);
  const blockCount = extractAnalysisBlocks(view).length;
  const canPublish = isPublished || blockCount > 0;

  const handleTogglePublish = React.useCallback(async () => {
    if (!view) return;
    setActionErrorMessage(null);
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

  const handleDelete = React.useCallback(async () => {
    if (!view) return;
    setActionErrorMessage(null);
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
    actionErrorMessage,
    isPublishPending: publishMutation.isPending,
    isDeletePending: deleteMutation.isPending,
    handleTogglePublish,
    handleDelete,
  };
}
