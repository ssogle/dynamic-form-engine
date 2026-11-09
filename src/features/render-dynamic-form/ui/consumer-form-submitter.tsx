"use client";

import * as React from "react";
import Link from "next/link";
import { useFormDetailQuery } from "@/entities/form";
import { useSubmitFormMutation, useConsumerFormDraftStore } from "@/entities/form-submission";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { DynamicFormRenderer } from "./dynamic-form-renderer";

export interface ConsumerFormSubmitterProps {
  /**
   * 대상 폼 식별자 (슬러그)
   */
  slug: string;
}

/**
 * 컨슈머 폼 입력 및 실시간 제출 기능 컴포넌트 (ConsumerFormSubmitter)
 *
 * 공식 발행된 활성 폼을 불러와 엔드유저가 실시간 유효성 검증과 함께
 * 답변을 작성하고 서버로 일괄 제출(Batch Submission)하는 독립적 기능 컴포넌트입니다.
 */
export function ConsumerFormSubmitter({ slug }: ConsumerFormSubmitterProps) {
  const { data: form, isLoading, isError, error } = useFormDetailQuery(slug);
  const [isSuccessSubmitted, setIsSuccessSubmitted] = React.useState(false);

  const { mutateAsync: submitResponse, isPending: isSubmitting } = useSubmitFormMutation(
    form?.id ?? slug
  );

  const currentDraftSlug = useConsumerFormDraftStore((state) => state.currentSlug);
  const draftValues = useConsumerFormDraftStore((state) => state.draftValues);
  const submitTriggerCount = useConsumerFormDraftStore((state) => state.submitTriggerCount);
  const setCurrentSlug = useConsumerFormDraftStore((state) => state.setCurrentSlug);

  React.useEffect(() => {
    setCurrentSlug(slug);
  }, [slug, setCurrentSlug]);

  const activeDraftValues = currentDraftSlug === slug ? draftValues : undefined;
  const activeSubmitTriggerCount = currentDraftSlug === slug ? submitTriggerCount : undefined;

  /**
   * 폼 유효성 검사를 통과한 정제 데이터를 서버로 제출
   */
  const handleSubmit = async (cleanedData: Record<string, unknown>) => {
    try {
      await submitResponse(cleanedData);
      setIsSuccessSubmitted(true);
    } catch (err) {
      console.error("폼 제출 실패:", err);
    }
  };

  // 1. 로딩 스켈레톤
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
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

  // 2. 조회 에러 상태
  if (isError || !form) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader>
            <CardTitle className="text-destructive text-base">폼을 불러오지 못했습니다</CardTitle>
            <CardDescription className="text-destructive/80 text-sm">
              {error instanceof Error ? error.message : "존재하지 않거나 삭제된 폼입니다."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link href="/consumer/forms">폼 목록으로 돌아가기</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 3. 미발행 폼 접근 방어
  if (!form.publishedAt) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base font-semibold">
              아직 발행되지 않은 폼입니다
            </CardTitle>
            <CardDescription className="text-muted-foreground mx-auto max-w-md text-xs/relaxed">
              작성자가 폼을 공식 발행할 때까지 일반 응답자는 내용을 열람하거나 제출할 수 없습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/consumer/forms">다른 폼 목록 둘러보기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. 제출 완료 화면
  if (isSuccessSubmitted) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-border/60 py-8 text-center shadow-xs">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-foreground text-2xl font-bold tracking-tight">
              응답이 성공적으로 제출되었습니다!
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              작성해 주신 소중한 데이터가 안전하게 데이터베이스에 저장되었습니다.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-3 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsSuccessSubmitted(false)}>
              새로운 응답 작성하기
            </Button>
            <Button asChild size="sm">
              <Link href={`/consumer/forms/${slug}/submissions`}>제출된 내역 확인하기</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 5. 정상 폼 입력 및 실시간 제출 화면
  return (
    <DynamicFormRenderer
      form={form}
      mode="submission"
      values={activeDraftValues}
      submitTriggerCount={activeSubmitTriggerCount}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
