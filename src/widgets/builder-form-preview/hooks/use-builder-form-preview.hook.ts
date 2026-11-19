"use client";

import * as React from "react";
import { useFormDetailQuery, type Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { buildPreviewSampleSubmissions } from "@/features/manage-form-submissions";
import type { BuilderDataPreviewView } from "../types/builder-form-preview.types";

export interface UseBuilderFormPreviewParams {
  /** 미리보기 대상 폼 고유 식별자 (UUID) */
  readonly formId: string;
}

export interface UseBuilderFormPreviewReturn {
  /** 미리보기 모달 열림 여부 */
  readonly isOpen: boolean;
  /** 현재 또는 직전에 열린 미리보기 뷰 (닫힘 애니메이션 중 콘텐츠 유지를 위해 별도 보관) */
  readonly activeView: BuilderDataPreviewView;
  /** 지정한 미리보기 뷰("list" 또는 "detail") 모달 열기 핸들러 */
  readonly handleOpenView: (view: BuilderDataPreviewView) => void;
  /** 미리보기 모달 열림/닫힘 상태 변경 핸들러 */
  readonly handleOpenChange: (open: boolean) => void;
  /** 조회된 폼 엔티티 */
  readonly form: Form | undefined;
  /** 스키마 기반 가상 샘플 레코드 목록 */
  readonly sampleSubmissions: FormSubmission[];
  /** 상세 미리보기 모달에서 표시할 대상 샘플 응답 ID */
  readonly detailSubmissionId: string;
  /** 상세 화면에 직접 전달할 첫 번째 가상 샘플 레코드 */
  readonly detailSampleSubmission: FormSubmission | undefined;
}

/**
 * 빌더 데이터 미리보기 모달 상태 오케스트레이션 훅 (useBuilderFormPreview)
 *
 * 폼 캔버스를 주 작업 화면으로 유지한 채, `목록 미리보기` 및 `상세 미리보기` 모달에
 * 현재 폼 스키마 기반의 가상 샘플 레코드를 생성·공급합니다.
 */
export function useBuilderFormPreview({
  formId,
}: UseBuilderFormPreviewParams): UseBuilderFormPreviewReturn {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState<BuilderDataPreviewView>("list");

  const { data: form } = useFormDetailQuery(formId);

  const sampleSubmissions = React.useMemo(
    () => (form ? buildPreviewSampleSubmissions(form) : []),
    [form]
  );

  const detailSampleSubmission = sampleSubmissions[0];
  const detailSubmissionId = detailSampleSubmission?.id ?? "";

  const handleOpenView = React.useCallback((view: BuilderDataPreviewView) => {
    setActiveView(view);
    setIsOpen(true);
  }, []);

  const handleOpenChange = React.useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return {
    isOpen,
    activeView,
    handleOpenView,
    handleOpenChange,
    form,
    sampleSubmissions,
    detailSubmissionId,
    detailSampleSubmission,
  };
}
