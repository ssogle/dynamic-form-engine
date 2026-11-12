"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Trash2, Calendar, Clock, FileText } from "lucide-react";
import { useFormDetailQuery, extractActiveFields, type CoreFormField } from "@/entities/form";
import {
  useFormSubmissionDetailQuery,
  useDeleteSubmissionMutation,
} from "@/entities/form-submission";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { formatDateTime } from "@/shared/lib/date";

export interface SubmissionDetailViewProps {
  /**
   * 부모 폼의 UUID 식별자
   */
  formId: string;
  /**
   * 단건 응답 레코드의 UUID 식별자
   */
  submissionId: string;
}

/**
 * 폼 필드 타입별 한글 라벨 매핑 사전
 */
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "단문 텍스트",
  textarea: "장문 텍스트",
  number: "숫자",
  select: "선택 항목",
};

/**
 * 컨슈머 폼 응답 단건 상세 조회 뷰 컴포넌트
 *
 * 제출된 응답 레코드의 메타데이터(제출/수정 일시, 식별자)와
 * 폼 스키마에 정의된 활성 필드별 입력값들을 읽기 전용 카드로 깔끔하게 시각화합니다.
 * 또한 상위 목록 복귀, 수정 전용 워크스페이스 이동, 응답 삭제 인터랙션을 제공합니다.
 *
 * @param props SubmissionDetailViewProps
 */
export function SubmissionDetailView({ formId, submissionId }: SubmissionDetailViewProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

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

  // 2. 응답 삭제 뮤테이션
  const { mutateAsync: deleteSubmission } = useDeleteSubmissionMutation(form?.id ?? formId);

  const isLoading = isFormLoading || isSubmissionLoading;
  const isError = isFormError || isSubmissionError;
  const errorMessage =
    formError instanceof Error
      ? formError.message
      : submissionError instanceof Error
        ? submissionError.message
        : "응답 상세 정보를 불러오지 못했습니다.";

  // 3. 응답 삭제 핸들러
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

  // 1. 로딩 상태 스켈레톤
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-1/3 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. 에러 상태
  if (isError || !submission || !form) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Link href={`/consumer/forms/${formId}`}>
            <ArrowLeft className="size-3.5" />
            데이터 목록으로 돌아가기
          </Link>
        </Button>

        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader>
            <CardTitle className="text-destructive text-base font-semibold">
              응답 상세 조회 실패
            </CardTitle>
            <CardDescription className="text-destructive/80 text-xs">
              {errorMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const activeFields = extractActiveFields(form);
  const submittedData = submission.data ?? {};

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* 1. 상단 네비게이션 및 액션 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Link href={`/consumer/forms/${formId}`}>
            <ArrowLeft className="size-3.5" />
            데이터 목록으로 돌아가기
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href={`/consumer/forms/${formId}/submissions/${submissionId}/edit`}>
              <Edit className="size-3.5" />
              수정하기
            </Link>
          </Button>
          <Popover open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={isDeleting}
              >
                <Trash2 className="size-3.5" />
                {isDeleting ? "삭제 중..." : "삭제하기"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 space-y-2 p-3 text-left shadow-md">
              <div className="space-y-1">
                <p className="text-foreground text-xs font-semibold">응답을 삭제하시겠습니까?</p>
                <p className="text-muted-foreground text-[11px]">삭제 후에는 복구할 수 없습니다.</p>
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsDeleteOpen(false)}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={async () => {
                    setIsDeleteOpen(false);
                    await handleDelete();
                  }}
                >
                  삭제 확인
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 2. 폼 기본 정보 및 응답 메타데이터 헤더 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-primary text-xs font-semibold tracking-wide uppercase">
            Submission Detail
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="text-muted-foreground font-mono text-xs">
            ID: {submission.id.slice(0, 8)}...
          </span>
        </div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">{form.title}</h1>
        {form.description && (
          <p className="text-muted-foreground text-xs/relaxed">{form.description}</p>
        )}
      </div>

      {/* 3. 일시 메타데이터 카드 */}
      <Card className="border-border/60 bg-muted/20 shadow-xs">
        <CardContent className="grid grid-cols-1 gap-4 p-4 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-2.5">
            <div className="bg-background border-border/60 flex size-8 shrink-0 items-center justify-center rounded-md border">
              <Calendar className="text-muted-foreground size-4" />
            </div>
            <div>
              <div className="text-muted-foreground font-medium">최초 제출 일시</div>
              <div className="text-foreground font-semibold">
                {formatDateTime(submission.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-background border-border/60 flex size-8 shrink-0 items-center justify-center rounded-md border">
              <Clock className="text-muted-foreground size-4" />
            </div>
            <div>
              <div className="text-muted-foreground font-medium">최종 수정 일시</div>
              <div className="text-foreground font-semibold">
                {formatDateTime(submission.updatedAt)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 제출된 응답 데이터 필드 카드 */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="border-border/40 border-b pb-4">
          <div className="flex items-center gap-2">
            <FileText className="text-primary size-4" />
            <CardTitle className="text-base font-bold">제출된 응답 내용</CardTitle>
          </div>
          <CardDescription className="text-xs">
            총 {activeFields.length}개의 항목에 대해 등록된 상세 데이터입니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="divide-border/40 divide-y p-0">
          {activeFields.map((field: CoreFormField) => {
            const rawValue = submittedData[field.id];
            const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== "";
            const displayValue = hasValue ? String(rawValue) : "-";
            const typeLabel = FIELD_TYPE_LABELS[field.type] ?? field.type;

            return (
              <div key={field.id} className="space-y-1.5 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">{field.label}</span>
                    {field.required && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        필수
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-muted-foreground px-1.5 py-0 text-[10px]"
                  >
                    {typeLabel}
                  </Badge>
                </div>

                {/* 필드 입력값 상세 출력 */}
                <div className="bg-muted/30 border-border/40 mt-1 rounded-md border p-3">
                  {field.type === "textarea" ? (
                    <p className="text-foreground text-xs/relaxed whitespace-pre-wrap">
                      {hasValue ? displayValue : <span className="text-muted-foreground">-</span>}
                    </p>
                  ) : (
                    <p className="text-foreground text-xs font-medium">
                      {hasValue ? displayValue : <span className="text-muted-foreground">-</span>}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 5. 하단 복귀 버튼 */}
      <div className="flex justify-end pt-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href={`/consumer/forms/${formId}`}>
            <ArrowLeft className="size-3.5" />
            데이터 목록으로
          </Link>
        </Button>
      </div>
    </div>
  );
}
