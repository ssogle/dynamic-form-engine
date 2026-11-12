"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useFormDetailQuery,
  extractActiveFields,
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

export interface UseSubmissionDetailViewParams {
  /**
   * 부모 폼의 UUID 식별자
   */
  formId: string;
  /**
   * 단건 응답 레코드의 UUID 식별자
   */
  submissionId: string;
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
}: UseSubmissionDetailViewParams): UseSubmissionDetailViewReturn {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = React.useState(0);

  // 1. 부모 폼 스키마 및 단건 응답 데이터 비동기 쿼리
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

  // 2. 현재 레코드를 참조하는 역방향 관계 서브미션 목록 비동기 쿼리
  const { data: relatedGroups = [], isLoading: isRelatedLoading } =
    useRelatedSubmissionsQuery(submissionId);

  // 3. 응답 삭제 뮤테이션
  const { mutateAsync: deleteSubmission } = useDeleteSubmissionMutation(form?.id ?? formId);

  const isLoading = isFormLoading || isSubmissionLoading;
  const isError = isFormError || isSubmissionError;
  const errorMessage =
    formError instanceof Error
      ? formError.message
      : submissionError instanceof Error
        ? submissionError.message
        : "응답 상세 정보를 불러오지 못했습니다.";

  // 4. 응답 삭제 핸들러
  const handleDelete = React.useCallback(async () => {
    try {
      setIsDeleting(true);
      await deleteSubmission(submissionId);
      router.push(`/consumer/forms/${formId}`);
    } catch (err) {
      console.error("응답 삭제 실패:", err);
      setIsDeleting(false);
    }
  }, [deleteSubmission, submissionId, formId, router]);

  // 5. 활성 필드 및 제출 데이터 파생
  const activeFields = React.useMemo(() => extractActiveFields(form), [form]);
  const submittedData = (submission?.data ?? {}) as Record<string, unknown>;

  return {
    form,
    submission,
    relatedGroups,
    activeFields,
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
  };
}
