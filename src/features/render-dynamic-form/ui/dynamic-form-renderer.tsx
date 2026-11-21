"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { PublishStatusBadge } from "@/shared/ui/publish-status-badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { dispatchFocusNavigator } from "@/shared/lib/navigator-focus";
import { extractPrimaryFieldId } from "@/entities/form";
import type { DynamicFormRendererProps } from "../types/render-dynamic-form.types";
import { useDynamicForm } from "../hooks/use-dynamic-form.hook";
import { DynamicField } from "./dynamic-field";

/**
 * 동적 폼 렌더러 통합 컴포넌트 (DynamicFormRenderer)
 *
 * 폼 빌더 미리보기(Preview)와 컨슈머 응답 제출(Submission)을 모두 수용하는 순수 프레젠테이션 뷰어입니다.
 * - 비즈니스 상태/이벤트 오케스트레이션은 useDynamicForm 훅에 전담 위임합니다.
 * - Preview 모드: 마우스 클릭으로 AI 네비게이터 대화 컨텍스트와 상호작용하며 필드 하이라이트를 지원합니다.
 * - Submission 모드: React Hook Form과 동적 Zod 스키마를 결합하여 실시간 유효성 검사 및 안전한 제출을 수행합니다.
 */
export function DynamicFormRenderer({
  form: propForm,
  formId,
  mode = "submission",
  onSubmit,
  values,
  onValuesChange,
  submitTriggerCount,
  selectedFieldId,
  onFieldClick,
  isSubmitting = false,
  disabled = false,
  className,
  renderRelationPicker,
  renderRelationSelectedTable,
}: DynamicFormRendererProps) {
  const {
    activeForm,
    activeFields,
    methods,
    isLoading,
    isError,
    error,
    isPublished,
    handleFormSubmit,
  } = useDynamicForm({
    form: propForm,
    formId,
    mode,
    values,
    onValuesChange,
    submitTriggerCount,
    onSubmit,
  });

  const fieldContainerRefs = React.useRef<Map<string, HTMLDivElement | null>>(new Map());
  const prevFieldSnapshotsRef = React.useRef<Map<string, string>>(new Map());
  const hasInitializedFieldsRef = React.useRef(false);
  const [autoHighlightFieldId, setAutoHighlightFieldId] = React.useState<string | null>(null);

  // 빌더 미리보기 모드에서 AI가 필드를 추가·수정하면 해당 필드로 자동 스크롤 및 일시 하이라이트를 적용합니다.
  React.useEffect(() => {
    if (mode !== "preview") return;

    const nextSnapshots = new Map(activeFields.map((f) => [f.id, JSON.stringify(f)]));
    if (!hasInitializedFieldsRef.current) {
      if (activeForm) {
        prevFieldSnapshotsRef.current = nextSnapshots;
        hasInitializedFieldsRef.current = true;
      }
      return;
    }

    let changedFieldId: string | null = null;
    for (const field of activeFields) {
      if (prevFieldSnapshotsRef.current.get(field.id) !== nextSnapshots.get(field.id)) {
        changedFieldId = field.id;
        break;
      }
    }

    prevFieldSnapshotsRef.current = nextSnapshots;
    if (!changedFieldId) return;

    const targetId = changedFieldId;
    const rafId = requestAnimationFrame(() => {
      setAutoHighlightFieldId(targetId);
      fieldContainerRefs.current.get(targetId)?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    });

    const timerId = setTimeout(() => {
      setAutoHighlightFieldId((curr) => (curr === targetId ? null : curr));
    }, 2400);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [mode, activeForm, activeFields]);

  // 프리뷰 모드에서 필드 카드 클릭 시 AI 네비게이터에 해당 필드를 즉시 멘션 프리필합니다.
  const handlePreviewFieldClick = React.useCallback(
    (fieldId: string) => {
      if (onFieldClick) {
        onFieldClick(fieldId);
        return;
      }
      const target = activeFields.find((f) => f.id === fieldId);
      dispatchFocusNavigator({
        prefillText: target ? `'${target.label}(${target.id})' 필드를 ` : `'${fieldId}' 필드를 `,
        replace: true,
      });
    },
    [onFieldClick, activeFields]
  );

  // 1. 쿼리 로딩 상태 스켈레톤 렌더링
  if (isLoading) {
    return (
      <div className={cn("w-full space-y-6", className)}>
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-48 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. 쿼리 에러 상태 렌더링
  if (isError) {
    return (
      <div className={cn("w-full", className)}>
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              폼 정보를 불러오지 못했습니다
            </CardTitle>
            <CardDescription className="text-destructive/80 text-sm">
              {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 3. 폼 데이터를 찾을 수 없는 경우
  if (!activeForm) {
    return (
      <div className={cn("w-full", className)}>
        <Card className="border-border/60 shadow-xs">
          <CardContent className="flex min-h-55 flex-col items-center justify-center p-8 text-center">
            <p className="text-muted-foreground text-sm font-medium">
              표시할 폼 데이터가 존재하지 않습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. 정상 폼 렌더링
  return (
    <FormProvider {...methods}>
      <div className={cn("w-full space-y-6", className)}>
        <Card className="border-border/60 shadow-xs">
          {/* 폼 메타데이터 헤더 */}
          <CardHeader className="space-y-3 pb-6">
            {mode === "preview" && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <PublishStatusBadge isPublished={isPublished} />
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    미리보기 모드
                  </Badge>
                </div>
              </div>
            )}

            <CardTitle className="text-2xl font-bold tracking-tight">{activeForm.title}</CardTitle>

            {activeForm.description && (
              <CardDescription className="text-sm/relaxed whitespace-pre-line">
                {activeForm.description}
              </CardDescription>
            )}
          </CardHeader>

          {/* 폼 본문 및 필드 렌더링 영역 */}
          <CardContent className="space-y-4">
            {activeFields.length === 0 ? (
              <div className="border-muted-foreground/25 flex min-h-55 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground text-sm font-medium">
                  등록된 폼 필드가 없습니다.
                </p>
                {mode === "preview" && (
                  <>
                    <p className="text-muted-foreground/80 mt-1 text-xs">
                      AI Navigator와 대화하여 필요한 입력 항목과 관계형 필드를 추가해 보세요.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-1.5 text-xs"
                      onClick={() =>
                        dispatchFocusNavigator({
                          prefillText: "새 필드를 추가해줘: ",
                          replace: true,
                        })
                      }
                    >
                      <Sparkles className="text-primary size-3.5" />
                      AI에게 필드 추가 요청
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  {activeFields.map((field) => {
                    const primaryFieldId = extractPrimaryFieldId(activeForm);
                    const isHighlighted = (selectedFieldId ?? autoHighlightFieldId) === field.id;

                    return (
                      <div
                        key={field.id}
                        ref={(el) => {
                          fieldContainerRefs.current.set(field.id, el);
                        }}
                        data-field-id={field.id}
                      >
                        <DynamicField
                          field={field}
                          isPrimary={Boolean(primaryFieldId && field.id === primaryFieldId)}
                          isSelected={isHighlighted}
                          onFieldClick={mode === "preview" ? handlePreviewFieldClick : undefined}
                          showTypeBadge={mode === "preview"}
                          disabled={disabled || isSubmitting}
                          renderRelationPicker={renderRelationPicker}
                          renderRelationSelectedTable={renderRelationSelectedTable}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* 컨슈머 제출 모드: 제출 버튼 노출 */}
                {mode === "submission" && (
                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={disabled || isSubmitting}
                      className="w-full font-medium"
                      size="lg"
                    >
                      {isSubmitting ? "제출 처리 중..." : "응답 제출하기"}
                    </Button>
                  </div>
                )}

                {/* 프리뷰 모드 안내 및 AI 편집 동선 */}
                {mode === "preview" && (
                  <div className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                    <p className="text-muted-foreground text-xs">
                      각 필드의 <strong className="text-foreground font-medium">AI로 수정</strong>을
                      누르거나 AI Navigator에게 필드 추가·수정·순서 변경을 요청하면 실시간으로
                      반영됩니다.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="shrink-0 gap-1.5 text-xs"
                      onClick={() =>
                        dispatchFocusNavigator({
                          prefillText: "새 필드를 추가해줘: ",
                          replace: true,
                        })
                      }
                    >
                      <Sparkles className="text-primary size-3" />
                      AI에게 필드 추가 요청
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  );
}
