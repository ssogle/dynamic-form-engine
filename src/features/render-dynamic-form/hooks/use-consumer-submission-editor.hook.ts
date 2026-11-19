"use client";

import * as React from "react";
import { useFormDetailQuery, type Form } from "@/entities/form";
import {
  useFormSubmissionDetailQuery,
  useUpdateSubmissionMutation,
  useConsumerFormDraftStore,
  type FormSubmission,
} from "@/entities/form-submission";

export interface UseConsumerSubmissionEditorParams {
  /**
   * 폼 고유 식별자 (UUID)
   */
  formId: string;
  /**
   * 수정 대상 제출 응답 고유 식별자 (UUID)
   */
  submissionId: string;
}

export interface UseConsumerSubmissionEditorReturn {
  /**
   * 부모 폼 데이터
   */
  form: Form | undefined;
  /**
   * 기존 제출된 응답 데이터
   */
  submission: FormSubmission | undefined;
  /**
   * 폼 또는 서브미션 데이터 비동기 로딩 중 여부
   */
  isLoading: boolean;
  /**
   * 조회 실패 에러 여부
   */
  isError: boolean;
  /**
   * 에러 메시지 문자열
   */
  errorMessage: string;
  /**
   * 서버 수정 뮤테이션 진행 중 여부
   */
  isUpdating: boolean;
  /**
   * 수정 성공 완료 여부 플래그
   */
  isSuccessUpdated: boolean;
  /**
   * 서버 수정 실패(예: 409 낙관적 락 충돌) 안내 메시지
   */
  updateErrorMessage: string | null;
  /**
   * 원본 제출 데이터와 AI Navigator 임시 필드값이 안전하게 병합된 최종 폼 값
   */
  mergedValues: Record<string, unknown> | undefined;
  /**
   * AI Navigator에 의한 자동 제출 트리거 횟수
   */
  activeSubmitTriggerCount: number | undefined;
  /**
   * 수정된 데이터를 서버로 전송하는 핸들러
   */
  handleUpdate: (cleanedData: Record<string, unknown>) => Promise<void>;
  /**
   * 수정 완료 상태를 리셋하여 다시 수정을 진행할 수 있도록 전환하는 핸들러
   */
  handleResetSuccess: () => void;
}

/**
 * 컨슈머 폼 응답 수정 워크스페이스 전용 커스텀 훅 (useConsumerSubmissionEditor)
 *
 * 원본 응답 조회, 초안 스토어 동기화, 기존 데이터와 초안의 안전한 병합(`mergedValues`),
 * 서버 수정 뮤테이션 및 성공/실패 상태 전이를 전담합니다.
 */
export function useConsumerSubmissionEditor({
  formId,
  submissionId,
}: UseConsumerSubmissionEditorParams): UseConsumerSubmissionEditorReturn {
  const [isSuccessUpdated, setIsSuccessUpdated] = React.useState(false);
  const [updateErrorMessage, setUpdateErrorMessage] = React.useState<string | null>(null);

  // 1. 폼 스키마 및 기존 단건 제출 데이터 비동기 조회
  const {
    data: form,
    isLoading: isFormLoading,
    isError: isFormError,
    error: formError,
  } = useFormDetailQuery(formId);

  const {
    data: submission,
    isLoading: isSubmissionLoading,
    isError: isSubmissionError,
    error: submissionError,
  } = useFormSubmissionDetailQuery(formId, submissionId);

  // 2. 응답 데이터 갱신 뮤테이션 훅
  const { mutateAsync: updateSubmission, isPending: isUpdating } = useUpdateSubmissionMutation(
    form?.id ?? formId
  );

  // 3. AI Navigator 초안 스토어 및 실시간 필드 동기화 바인딩
  const currentDraftFormId = useConsumerFormDraftStore((state) => state.currentFormId);
  const draftValues = useConsumerFormDraftStore((state) => state.draftValues);
  const submitTriggerCount = useConsumerFormDraftStore((state) => state.submitTriggerCount);
  const setCurrentFormId = useConsumerFormDraftStore((state) => state.setCurrentFormId);
  const resetDraft = useConsumerFormDraftStore((state) => state.resetDraft);

  React.useEffect(() => {
    resetDraft();
    setCurrentFormId(formId);
    return () => {
      resetDraft();
    };
  }, [formId, setCurrentFormId, resetDraft]);

  const activeDraftValues = currentDraftFormId === formId ? draftValues : undefined;
  const activeSubmitTriggerCount = currentDraftFormId === formId ? submitTriggerCount : undefined;

  // 기존 제출된 응답 데이터와 AI Navigator가 수정한 임시 필드값을 안전하게 병합
  const submissionData = submission?.data;
  const mergedValues = React.useMemo(() => {
    if (!submissionData) return activeDraftValues;
    if (!activeDraftValues || Object.keys(activeDraftValues).length === 0) {
      return submissionData;
    }
    return {
      ...submissionData,
      ...activeDraftValues,
    };
  }, [submissionData, activeDraftValues]);

  const isLoading = isFormLoading || isSubmissionLoading;
  const isError = isFormError || isSubmissionError;
  const errorMessage =
    formError instanceof Error
      ? formError.message
      : submissionError instanceof Error
        ? submissionError.message
        : "응답 정보를 불러오지 못했습니다.";

  /**
   * 폼 유효성 검사를 통과한 정제 데이터를 서버로 전송하여 수정
   */
  const handleUpdate = async (cleanedData: Record<string, unknown>) => {
    setUpdateErrorMessage(null);
    try {
      await updateSubmission({
        submissionId,
        data: cleanedData,
        expectedVersion: submission?.version ?? 1,
      });
      resetDraft();
      setIsSuccessUpdated(true);
    } catch (err) {
      const httpErr = err as { status?: number; code?: string; message?: string };
      if (httpErr?.status === 409 || httpErr?.code === "CONFLICT") {
        setUpdateErrorMessage(
          "다른 사용자가 먼저 응답을 수정하여 최신 버전으로 다시 불러왔습니다. 변경 사항을 확인한 뒤 다시 저장해 주세요."
        );
      } else {
        setUpdateErrorMessage(
          httpErr?.message ?? "응답 수정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
        console.error("응답 수정 실패:", err);
      }
    }
  };

  /**
   * 수정 성공 완료 상태를 초기화
   */
  const handleResetSuccess = () => {
    setIsSuccessUpdated(false);
    setUpdateErrorMessage(null);
  };

  return {
    form,
    submission,
    isLoading,
    isError,
    errorMessage,
    isUpdating,
    isSuccessUpdated,
    updateErrorMessage,
    mergedValues,
    activeSubmitTriggerCount,
    handleUpdate,
    handleResetSuccess,
  };
}
