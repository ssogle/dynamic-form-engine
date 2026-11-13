"use client";

import * as React from "react";
import {
  useFormsQuery,
  usePublishFormMutation,
  useDeleteFormMutation,
  type Form,
} from "@/entities/form";

export interface UseBuilderFormListReturn {
  /**
   * 로드된 활성 폼 메타데이터 목록
   */
  forms: Form[] | undefined;
  /**
   * 폼 목록 쿼리 로딩 상태
   */
  isLoading: boolean;
  /**
   * 폼 목록 조회 에러 여부
   */
  isError: boolean;
  /**
   * 폼 목록 조회 에러 객체
   */
  error: { message?: string } | null;
  /**
   * 폼 발행/회수 뮤테이션 진행 중 여부
   */
  isPublishPending: boolean;
  /**
   * 폼 삭제 뮤테이션 진행 중 여부
   */
  isDeletePending: boolean;
  /**
   * 폼 발행 상태 토글 핸들러
   */
  handleTogglePublish: (id: string, isPublished: boolean) => void;
  /**
   * 폼 소프트 삭제 핸들러
   */
  handleDeleteForm: (id: string) => void;
}

/**
 * 빌더 폼 목록 열람 및 관리 비즈니스 오케스트레이션 전용 커스텀 훅 (useBuilderFormList)
 *
 * 폼 목록 쿼리 조회, 발행 상태 토글 뮤테이션, 소프트 삭제 뮤테이션 제어를 캡슐화합니다.
 */
export function useBuilderFormList(): UseBuilderFormListReturn {
  const { data: forms, isLoading, isError, error } = useFormsQuery();
  const deleteFormMutation = useDeleteFormMutation();
  const publishFormMutation = usePublishFormMutation();

  const handleTogglePublish = React.useCallback(
    (id: string, isPublished: boolean) => {
      publishFormMutation.mutate({ id, isPublished });
    },
    [publishFormMutation]
  );

  const handleDeleteForm = React.useCallback(
    (id: string) => {
      deleteFormMutation.mutate(id);
    },
    [deleteFormMutation]
  );

  return {
    forms,
    isLoading,
    isError,
    error,
    isPublishPending: publishFormMutation.isPending,
    isDeletePending: deleteFormMutation.isPending,
    handleTogglePublish,
    handleDeleteForm,
  };
}
