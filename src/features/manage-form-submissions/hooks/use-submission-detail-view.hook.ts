"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useFormDetailQuery,
  extractActiveFields,
  extractPrimaryFieldId,
  extractPrimaryFieldValue,
  type Form,
  type CoreFormField,
} from "@/entities/form";
import {
  useFormSubmissionDetailQuery,
  useDeleteSubmissionMutation,
  useRelatedSubmissionsQuery,
  type FormSubmission,
  type RelatedSubmissionsGroup,
} from "@/entities/form-submission";
import { getRelationDetailRows, type RelationFieldDetailRows } from "../lib/relation-summary";
import type { FormSubmissionViewMode } from "../types/submission-view.types";
import { useRelationLookup } from "./use-relation-lookup.hook";

export interface UseSubmissionDetailViewParams {
  /**
   * 부모 폼의 UUID 식별자
   */
  formId: string;
  /**
   * 단건 응답 레코드의 UUID 식별자
   */
  submissionId: string;
  /**
   * 상세 화면 동작 모드 (기본값: "consumer")
   */
  mode?: FormSubmissionViewMode | undefined;
  /**
   * 프리뷰 모드에서 실데이터 부재 시 직접 바인딩할 가상 샘플 레코드
   */
  sampleSubmission?: FormSubmission | undefined;
}

export interface UseSubmissionDetailViewReturn {
  /**
   * 부모 폼 데이터
   */
  form: Form | undefined;
  /**
   * 단건 응답 레코드 데이터
   */
  submission: FormSubmission | undefined;
  /**
   * 현재 레코드를 참조하는 역방향 관계 서브미션 그룹 목록
   */
  relatedGroups: RelatedSubmissionsGroup[];
  /**
   * 폼 스키마의 소프트 삭제 제외 활성 필드 목록
   */
  activeFields: CoreFormField[];
  /**
   * 현재 폼의 도메인 대표 식별 필드 ID
   */
  primaryFieldId: string | undefined;
  /**
   * 현재 단건 응답 레코드의 대표 필드 표시값
   */
  primaryDisplayValue: string | undefined;
  /**
   * 정방향 관계형(relation) 필드별 복원된 타깃 폼 및 선택 행 목록
   */
  relationDetails: Record<string, RelationFieldDetailRows>;
  /**
   * 제출된 원시 Key-Value 데이터 딕셔너리
   */
  submittedData: Record<string, unknown>;
  /**
   * 폼 또는 서브미션 초기 로딩 상태
   */
  isLoading: boolean;
  /**
   * 폼 또는 서브미션 조회 실패 여부
   */
  isError: boolean;
  /**
   * 에러 메시지
   */
  errorMessage: string;
  /**
   * 역참조 관계 데이터 로딩 상태
   */
  isRelatedLoading: boolean;
  /**
   * 단건 응답 삭제 진행 중 여부
   */
  isDeleting: boolean;
  /**
   * 삭제 확인 팝오버 오픈 상태
   */
  isDeleteOpen: boolean;
  /**
   * 삭제 확인 팝오버 오픈 상태 제어 함수
   */
  setIsDeleteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * 선택된 역방향 관계 서브미션 그룹 탭 인덱스
   */
  selectedGroupIndex: number;
  /**
   * 역방향 관계 서브미션 그룹 탭 선택 함수
   */
  setSelectedGroupIndex: React.Dispatch<React.SetStateAction<number>>;
  /**
   * 단건 응답 삭제 핸들러 (성공 시 목록 페이지로 라우팅)
   */
  handleDelete: () => Promise<void>;
  /**
   * 실데이터 부재로 인해 샘플 데이터를 미리보기로 렌더링 중인지 여부
   */
  isSamplePreview: boolean;
}

/**
 * 컨슈머 폼 응답 단건 상세 조회 비즈니스 오케스트레이션 전용 커스텀 훅 (useSubmissionDetailView)
 *
 * 부모 폼 상세 조회, 단건 응답 레코드 조회, 역방향 관계 서브미션 쿼리,
 * 응답 삭제 뮤테이션 및 목록 페이지 복귀 라우팅을 캡슐화합니다.
 */
export function useSubmissionDetailView({
  formId,
  submissionId,
  mode = "consumer",
  sampleSubmission,
}: UseSubmissionDetailViewParams): UseSubmissionDetailViewReturn {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = React.useState(0);

  const isSamplePreview = mode === "preview";

  // 1. 부모 폼 스키마 및 단건 응답 데이터 비동기 쿼리 (프리뷰 모드에서는 단건/역참조 쿼리 전면 비활성화)
  const {
    data: form,
    isLoading: isFormLoading,
    isError: isFormError,
    error: formError,
  } = useFormDetailQuery(formId);

  const {
    data: fetchedSubmission,
    isLoading: isSubmissionLoading,
    isError: isSubmissionError,
    error: submissionError,
  } = useFormSubmissionDetailQuery(formId, isSamplePreview ? "" : submissionId, {
    enabled: !isSamplePreview,
  });

  // 2. 현재 레코드를 참조하는 역방향 관계 서브미션 목록 비동기 쿼리
  const { data: fetchedRelatedGroups = [], isLoading: isFetchedRelatedLoading } =
    useRelatedSubmissionsQuery(isSamplePreview ? "" : submissionId, {
      enabled: !isSamplePreview,
    });

  // 3. 응답 삭제 뮤테이션
  const { mutateAsync: deleteSubmission } = useDeleteSubmissionMutation(form?.id ?? formId);

  const submission = isSamplePreview ? sampleSubmission : fetchedSubmission;
  const relatedGroups = isSamplePreview ? [] : fetchedRelatedGroups;
  const isRelatedLoading = isSamplePreview ? false : isFetchedRelatedLoading;
  const isLoading = isSamplePreview ? isFormLoading : isFormLoading || isSubmissionLoading;
  const isError = isSamplePreview ? isFormError : isFormError || isSubmissionError;
  const errorMessage =
    formError instanceof Error
      ? formError.message
      : !isSamplePreview && submissionError instanceof Error
        ? submissionError.message
        : "응답 상세 정보를 불러오지 못했습니다.";

  // 4. 응답 삭제 핸들러 (프리뷰 모드에서는 차단)
  const handleDelete = React.useCallback(async () => {
    if (mode === "preview") {
      return;
    }
    try {
      setIsDeleting(true);
      await deleteSubmission(submissionId);
      router.push(`/consumer/forms/${formId}`);
    } catch (err) {
      console.error("응답 삭제 실패:", err);
      setIsDeleting(false);
    }
  }, [deleteSubmission, submissionId, formId, mode, router]);

  // 5. 활성 필드, 대표 식별 정보 및 정방향 관계형 상세 행 파생
  const activeFields = React.useMemo(() => extractActiveFields(form), [form]);
  const primaryFieldId = extractPrimaryFieldId(form);
  const primaryDisplayValue =
    form && submission ? extractPrimaryFieldValue(form, submission) : undefined;
  const submittedData = React.useMemo(
    () => (submission?.data ?? {}) as Record<string, unknown>,
    [submission]
  );

  const submissionListForLookup = React.useMemo(
    () => (submission && !isSamplePreview ? [submission] : []),
    [submission, isSamplePreview]
  );
  const { lookupMap: relationLookupMap } = useRelationLookup(activeFields, submissionListForLookup);

  const relationDetails = React.useMemo(() => {
    const map: Record<string, RelationFieldDetailRows> = {};
    for (const field of activeFields) {
      if (field.type === "relation") {
        map[field.id] = getRelationDetailRows(submittedData[field.id], field, relationLookupMap);
      }
    }
    return map;
  }, [activeFields, submittedData, relationLookupMap]);

  return {
    form,
    submission,
    relatedGroups,
    activeFields,
    primaryFieldId,
    primaryDisplayValue,
    relationDetails,
    submittedData,
    isLoading,
    isError,
    errorMessage,
    isRelatedLoading,
    isDeleting,
    isDeleteOpen,
    setIsDeleteOpen,
    selectedGroupIndex,
    setSelectedGroupIndex,
    handleDelete,
    isSamplePreview,
  };
}
