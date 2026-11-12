"use client";

import * as React from "react";
import { useFormDetailQuery, type Form } from "@/entities/form";
import { useSubmitFormMutation, useConsumerFormDraftStore } from "@/entities/form-submission";

export interface UseConsumerFormSubmitterParams {
  /**
   * 대상 폼 식별자 (UUID)
   */
  formId: string;
}

export interface UseConsumerFormSubmitterReturn {
  /**
   * 로드된 폼 메타데이터 및 스키마
   */
  form: Form | undefined;
  /**
   * 폼 상세 로딩 상태
   */
  isLoading: boolean;
  /**
   * 폼 상세 조회 에러 여부
   */
  isError: boolean;
  /**
   * 폼 상세 조회 에러 객체
   */
  error: unknown;
  /**
   * 서버로의 응답 제출 진행 중 여부
   */
  isSubmitting: boolean;
  /**
   * 제출 성공 완료 여부 플래그
   */
  isSuccessSubmitted: boolean;
  /**
   * AI Navigator 등 외부에서 주입된 활성 필드 초안 데이터
   */
  activeDraftValues: Record<string, unknown> | undefined;
  /**
   * AI Navigator의 자동 제출 트리거 횟수
   */
  activeSubmitTriggerCount: number | undefined;
  /**
   * 정제된 폼 데이터를 서버로 제출하는 핸들러
   */
  handleSubmit: (cleanedData: Record<string, unknown>) => Promise<void>;
  /**
   * 제출 완료 상태를 리셋하여 새 응답을 작성하도록 전환하는 핸들러
   */
  handleResetSuccess: () => void;
}

/**
 * 컨슈머 폼 제출 워크플로우 전용 커스텀 훅 (useConsumerFormSubmitter)
 *
 * 폼 상세 데이터 페칭, 초안 스토어 라이프사이클 동기화,
 * 서버 제출 뮤테이션 및 성공/실패 상태 전이를 전담합니다.
 */
export function useConsumerFormSubmitter({
  formId,
}: UseConsumerFormSubmitterParams): UseConsumerFormSubmitterReturn {
  const { data: form, isLoading, isError, error } = useFormDetailQuery(formId);
  const [isSuccessSubmitted, setIsSuccessSubmitted] = React.useState(false);

  const { mutateAsync: submitResponse, isPending: isSubmitting } = useSubmitFormMutation(
    form?.id ?? formId
  );

  const currentDraftFormId = useConsumerFormDraftStore((state) => state.currentFormId);
  const draftValues = useConsumerFormDraftStore((state) => state.draftValues);
  const submitTriggerCount = useConsumerFormDraftStore((state) => state.submitTriggerCount);
  const setCurrentFormId = useConsumerFormDraftStore((state) => state.setCurrentFormId);
  const resetDraft = useConsumerFormDraftStore((state) => state.resetDraft);

  // 컴포넌트 마운트 시 기존 드래프트 초기화 후 대상 폼 동기화, 언마운트 시 클린업
  React.useEffect(() => {
    resetDraft();
    setCurrentFormId(formId);
    return () => {
      resetDraft();
    };
  }, [formId, setCurrentFormId, resetDraft]);

  const activeDraftValues = currentDraftFormId === formId ? draftValues : undefined;
  const activeSubmitTriggerCount = currentDraftFormId === formId ? submitTriggerCount : undefined;

  /**
   * 유효성 검증을 통과한 폼 데이터를 서버에 제출
   */
  const handleSubmit = async (cleanedData: Record<string, unknown>) => {
    try {
      await submitResponse(cleanedData);
      resetDraft();
      setIsSuccessSubmitted(true);
    } catch (err) {
      console.error("폼 제출 실패:", err);
    }
  };

  /**
   * 성공 상태를 초기화하고 폼 작성을 재개
   */
  const handleResetSuccess = () => {
    setIsSuccessSubmitted(false);
  };

  return {
    form,
    isLoading,
    isError,
    error,
    isSubmitting,
    isSuccessSubmitted,
    activeDraftValues,
    activeSubmitTriggerCount,
    handleSubmit,
    handleResetSuccess,
  };
}
