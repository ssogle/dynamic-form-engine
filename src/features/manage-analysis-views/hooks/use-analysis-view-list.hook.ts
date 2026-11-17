"use client";

import * as React from "react";
import {
  useAnalysisViewsQuery,
  useDeleteAnalysisViewMutation,
  usePublishAnalysisViewMutation,
  type AnalysisView,
} from "@/entities/analysis-view";

export interface UseAnalysisViewListReturn {
  /** 로드된 활성 분석 뷰 목록 */
  views: AnalysisView[] | undefined;
  /** 목록 로딩 중 여부 */
  isLoading: boolean;
  /** 목록 조회 에러 여부 */
  isError: boolean;
  /** 목록 조회 에러 객체 */
  error: { message?: string } | null;
  /** 발행/삭제 등 액션 실행 에러 메시지 */
  actionErrorMessage: string | null;
  /** 발행 상태 변경 뮤테이션 진행 여부 */
  isPublishPending: boolean;
  /** 삭제 뮤테이션 진행 여부 */
  isDeletePending: boolean;
  /** 발행/초안 회수 토글 핸들러 */
  handleTogglePublish: (id: string, isPublished: boolean) => Promise<void>;
  /** 단건 소프트 삭제 핸들러 */
  handleDeleteView: (id: string) => Promise<void>;
}

/**
 * 분석가 분석 뷰 목록 열람 및 일괄/단건 관리 오케스트레이션 훅
 */
export function useAnalysisViewList(): UseAnalysisViewListReturn {
  const { data: views, isLoading, isError, error } = useAnalysisViewsQuery();
  const publishMutation = usePublishAnalysisViewMutation();
  const deleteMutation = useDeleteAnalysisViewMutation();
  const [actionErrorMessage, setActionErrorMessage] = React.useState<string | null>(null);

  const handleTogglePublish = React.useCallback(
    async (id: string, isPublished: boolean) => {
      setActionErrorMessage(null);
      try {
        await publishMutation.mutateAsync({ id, isPublished });
      } catch (err) {
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "발행 상태를 변경하지 못했습니다.";
        setActionErrorMessage(message);
      }
    },
    [publishMutation]
  );

  const handleDeleteView = React.useCallback(
    async (id: string) => {
      setActionErrorMessage(null);
      try {
        await deleteMutation.mutateAsync(id);
      } catch (err) {
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "분석 뷰를 삭제하지 못했습니다.";
        setActionErrorMessage(message);
      }
    },
    [deleteMutation]
  );

  return {
    views,
    isLoading,
    isError,
    error,
    actionErrorMessage,
    isPublishPending: publishMutation.isPending,
    isDeletePending: deleteMutation.isPending,
    handleTogglePublish,
    handleDeleteView,
  };
}
