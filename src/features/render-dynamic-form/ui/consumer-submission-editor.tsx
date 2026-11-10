"use client";

import * as React from "react";
import Link from "next/link";
import { useFormDetailQuery } from "@/entities/form";
import {
  useFormSubmissionDetailQuery,
  useUpdateSubmissionMutation,
  useConsumerFormDraftStore,
} from "@/entities/form-submission";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDateTime } from "@/shared/lib/date";
import { DynamicFormRenderer } from "./dynamic-form-renderer";

export interface ConsumerSubmissionEditorProps {
  /**
   * 폼 식별자 (UUID)
   */
  formId: string;
  /**
   * 수정 대상 제출 응답 ID (UUID)
   */
  submissionId: string;
}

/**
 * 컨슈머 폼 기제출 응답 수정 전용 워크스페이스 컴포넌트 (ConsumerSubmissionEditor)
 *
 * 모달 팝업 대신 전체 화면 워크스페이스에서 기존 제출 데이터를 시각적으로 확인하고,
 * AI Navigator 실시간 필드 동기화 및 동적 유효성 검사를 거쳐 데이터를 수정/저장하는 독립적 기능 컴포넌트입니다.
 */
export function ConsumerSubmissionEditor({ formId, submissionId }: ConsumerSubmissionEditorProps) {
  const [isSuccessUpdated, setIsSuccessUpdated] = React.useState(false);

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

  React.useEffect(() => {
    setCurrentFormId(formId);
  }, [formId, setCurrentFormId]);

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
    try {
      await updateSubmission({
        submissionId,
        data: cleanedData,
      });
      setIsSuccessUpdated(true);
    } catch (err) {
      console.error("응답 수정 실패:", err);
    }
  };

  // 1. 서버 SSR 및 클라이언트 초기 하이드레이션, 데이터 로딩 단계 스켈레톤
  if (isLoading || ((!form || !submission) && !isError)) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-md" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="space-y-3 pb-6">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. 조회 실패 에러 상태 (에러 확정 또는 로딩 완료 후에도 데이터 부재)
  if (isError || !form || !submission) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              데이터를 불러오지 못했습니다
            </CardTitle>
            <CardDescription className="text-destructive/80 text-sm">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/consumer/forms/${formId}/submissions`}>제출 목록으로 돌아가기</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/consumer/forms">폼 전체 목록</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 3. 수정 완료 성공 화면
  if (isSuccessUpdated) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-border/60 py-8 text-center shadow-xs">
          <CardHeader className="space-y-2 pb-4">
            <Badge variant="outline" className="mx-auto w-fit text-xs font-normal">
              수정 완료
            </Badge>
            <CardTitle className="text-foreground text-2xl font-bold tracking-tight">
              응답이 성공적으로 수정되었습니다!
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              변경된 내용이 데이터베이스에 안전하게 반영되었습니다.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-3 pt-4">
            <Button asChild size="sm">
              <Link href={`/consumer/forms/${formId}/submissions`}>
                제출 내역 목록으로 돌아가기
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSuccessUpdated(false)}>
              계속 수정하기
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 4. 정상 응답 수정 폼 화면
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
          >
            <Link href={`/consumer/forms/${formId}/submissions`}>
              &larr; 제출 목록으로 돌아가기
            </Link>
          </Button>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="text-muted-foreground max-w-48 truncate font-mono text-xs">
            {submission.id}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            [{form.title}] 응답 수정
          </h1>
          <p className="text-muted-foreground text-xs">
            최초 제출 일시: {formatDateTime(submission.createdAt)}
            {submission.updatedAt && (
              <span className="ml-2 font-mono">
                (최근 수정: {formatDateTime(submission.updatedAt)})
              </span>
            )}
          </p>
        </div>
      </div>

      <DynamicFormRenderer
        form={form}
        mode="submission"
        values={mergedValues}
        submitTriggerCount={activeSubmitTriggerCount}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
      />
    </div>
  );
}
