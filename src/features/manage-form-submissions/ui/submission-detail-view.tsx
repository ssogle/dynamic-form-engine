"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Trash2, Calendar, Clock, FileText, Link2 } from "lucide-react";
import { formatFieldDisplayValue, PrimaryFieldBadge, type CoreFormField } from "@/entities/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { formatDateTime } from "@/shared/lib/date";
import { useSubmissionDetailView } from "../hooks/use-submission-detail-view.hook";
import { RelatedSubmissionSubtable } from "./related-submission-subtable";

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
 * 컨슈머 폼 응답 단건 상세 조회 뷰 컴포넌트 (SubmissionDetailView)
 *
 * 제출된 응답 레코드의 메타데이터와 폼 스키마에 정의된 활성 필드별 입력값들을 읽기 전용 카드로 깔끔하게 시각화합니다.
 * 비즈니스 상태 관리 및 이벤트 오케스트레이션은 useSubmissionDetailView 훅에 전담 위임하는 순수 얇은 뷰(Thin View)입니다.
 */
export function SubmissionDetailView({ formId, submissionId }: SubmissionDetailViewProps) {
  const {
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
  } = useSubmissionDetailView({ formId, submissionId });

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
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-primary text-xs font-semibold tracking-wide uppercase">
            Submission Detail
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="text-muted-foreground font-mono text-xs">ID: {submission.id}</span>
          {primaryDisplayValue && (
            <>
              <span className="text-muted-foreground/60">•</span>
              <div className="inline-flex items-center gap-1.5">
                <PrimaryFieldBadge />
                <span className="text-foreground text-xs font-semibold">{primaryDisplayValue}</span>
              </div>
            </>
          )}
        </div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {primaryDisplayValue ? `${form.title} — ${primaryDisplayValue}` : form.title}
        </h1>
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
            const isPrimary = Boolean(primaryFieldId && field.id === primaryFieldId);
            const hasValue =
              rawValue !== undefined &&
              rawValue !== null &&
              rawValue !== "" &&
              (!Array.isArray(rawValue) || rawValue.length > 0);
            const displayValue = formatFieldDisplayValue(rawValue, field);
            const typeLabel = FIELD_TYPE_LABELS[field.type] ?? field.type;
            const relDetail = field.type === "relation" ? relationDetails[field.id] : undefined;

            return (
              <div
                key={field.id}
                className={`space-y-1.5 p-4 sm:p-5 ${isPrimary ? "bg-primary/[0.02]" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">{field.label}</span>
                    {isPrimary && <PrimaryFieldBadge />}
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
                {field.type === "relation" ? (
                  <div className="mt-1 space-y-2">
                    {relDetail?.targetForm && relDetail.rows.length > 0 ? (
                      <RelatedSubmissionSubtable
                        group={{
                          sourceForm: {
                            id: relDetail.targetForm.id,
                            title: relDetail.targetForm.title,
                            schemaDefinition: relDetail.targetForm.schemaDefinition,
                          },
                          submissions: relDetail.rows,
                        }}
                      />
                    ) : relDetail && relDetail.missingIds.length > 0 ? (
                      <div className="bg-muted/30 border-border/40 flex flex-wrap gap-1.5 rounded-md border p-3">
                        {relDetail.missingIds.map((missingId) => (
                          <Badge key={missingId} variant="outline" className="font-mono text-xs">
                            {missingId}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-muted/30 border-border/40 rounded-md border p-3">
                        <span className="text-muted-foreground text-xs">
                          연결된 타깃 레코드가 없습니다.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 5. 연결된 내역 (역참조 서브미션 목록) 카드 */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="border-border/40 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="text-primary size-4" />
              <CardTitle className="text-base font-bold">연결된 내역</CardTitle>
            </div>
            {relatedGroups.length > 0 && (
              <Badge variant="outline" className="text-xs">
                총 {relatedGroups.reduce((acc, g) => acc + g.submissions.length, 0)}건
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            현재 레코드를 참조하고 있는 다른 폼의 응답 데이터 내역입니다.
          </CardDescription>

          {/* 소스 폼이 복수일 경우 탭 전환 버튼 제공 */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {relatedGroups.map((grp, idx) => {
              const isSelected = idx === selectedGroupIndex;
              return (
                <Button
                  key={grp.sourceForm.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedGroupIndex(idx)}
                >
                  {grp.sourceForm.title} ({grp.submissions.length})
                </Button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {isRelatedLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ) : relatedGroups.length === 0 ||
            relatedGroups.every((g) => g.submissions.length === 0) ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-xs">
                이 레코드를 참조하는 연결된 내역이 없습니다.
              </p>
            </div>
          ) : (
            (() => {
              const activeGroup = relatedGroups[selectedGroupIndex] ?? relatedGroups[0];
              if (!activeGroup) {
                return null;
              }
              return <RelatedSubmissionSubtable group={activeGroup} />;
            })()
          )}
        </CardContent>
      </Card>

      {/* 6. 하단 복귀 버튼 */}
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
