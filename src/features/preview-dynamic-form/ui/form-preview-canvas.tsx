"use client";

import * as React from "react";
import type { Form, ActiveForm, CoreFormField } from "@/entities/form";
import { useFormDetailQuery } from "@/entities/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { DynamicField } from "./field-registry";

/**
 * 폼 프리뷰어 캔버스 프로퍼티 인터페이스
 *
 * exactOptionalPropertyTypes 설정에 대응하기 위해
 * 선택적 속성에는 명시적으로 `| undefined`를 유니온으로 허용합니다.
 */
export interface FormPreviewCanvasProps {
  /**
   * 직접 주입할 폼 스키마 데이터 (우선순위 1위)
   */
  form?: ActiveForm | Form | null | undefined;

  /**
   * 폼 슬러그 또는 UUID (form이 전달되지 않은 경우 쿼리로 자동 조회)
   */
  slug?: string | undefined;

  /**
   * AI 네비게이터 또는 사용자가 현재 선택/집중하고 있는 필드 ID
   */
  selectedFieldId?: string | undefined;

  /**
   * 필드 클릭 핸들러 (네비게이터 대화 패널과 컨텍스트 연동)
   */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /**
   * 외부 커스텀 스타일 클래스
   */
  className?: string | undefined;
}

/**
 * 폼 객체에서 코어 필드 목록을 안전하게 추출하는 순수 유틸리티
 * 소프트 삭제(deletedAt)된 필드는 렌더링 대상에서 제외합니다.
 */
function extractFields(form: ActiveForm | Form): CoreFormField[] {
  let rawFields: CoreFormField[] = [];

  if ("fields" in form && Array.isArray(form.fields)) {
    rawFields = form.fields;
  } else if (
    "schemaDefinition" in form &&
    form.schemaDefinition !== null &&
    typeof form.schemaDefinition === "object"
  ) {
    const rawSchema = form.schemaDefinition as { fields?: unknown };
    if (Array.isArray(rawSchema.fields)) {
      rawFields = rawSchema.fields as CoreFormField[];
    }
  }

  return rawFields.filter((f) => !f.deletedAt);
}

/**
 * 실시간 동적 폼 프리뷰어 캔버스 (Live Previewer)
 *
 * 테슬라 자율주행 대시보드 철학에 따라 마우스 수동 편집 UI를 전면 배제하고,
 * AI Navigator가 생성 및 수정한 스키마를 100% 결정론적으로 실시간 렌더링하는 순수 뷰어입니다.
 */
export function FormPreviewCanvas({
  form: propForm,
  slug,
  selectedFieldId,
  onFieldClick,
  className,
}: FormPreviewCanvasProps) {
  // props.slug가 존재하고 propForm이 없는 경우 TanStack Query로 폼 상세 정보 조회
  const shouldFetch = Boolean(slug && !propForm);
  const {
    data: fetchedForm,
    isLoading,
    isError,
    error,
  } = useFormDetailQuery(slug ?? "", { enabled: shouldFetch });

  // 최종 렌더링 대상 폼 데이터 결정
  const activeForm = propForm ?? fetchedForm;

  /**
   * 1. 로딩 상태 스켈레톤 렌더링
   */
  if (shouldFetch && isLoading) {
    return (
      <div className={cn("mx-auto w-full max-w-3xl space-y-6 p-6", className)}>
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
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * 2. 에러 상태 렌더링
   */
  if (shouldFetch && isError) {
    return (
      <div className={cn("mx-auto w-full max-w-3xl p-6", className)}>
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

  /**
   * 3. 폼 데이터가 없는 경우의 초기 안내 (Null State)
   */
  if (!activeForm) {
    return (
      <div className={cn("mx-auto w-full max-w-3xl p-6", className)}>
        <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="text-foreground text-sm font-semibold">선택된 폼이 없습니다</div>
            <p className="text-muted-foreground max-w-md text-xs/relaxed">
              좌측 AI Navigator에 새로운 폼 생성을 요청하거나, 기존 폼을 선택해 실시간 프리뷰를
              확인하세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 폼 필드 목록 추출
  const fields = extractFields(activeForm);
  const fieldCount = fields.length;

  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-6 p-6", className)}>
      <Card className="border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
        {/* 폼 메타데이터 헤더 */}
        <CardHeader className="border-border/40 border-b pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-foreground text-xl font-bold tracking-tight">
                {activeForm.title}
              </CardTitle>
              {activeForm.description && (
                <CardDescription className="text-muted-foreground text-sm">
                  {activeForm.description}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeForm.publishedAt ? (
                <Badge variant="default" className="bg-emerald-600 text-xs hover:bg-emerald-700">
                  발행됨
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  초안 (Draft)
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {fieldCount}개 항목
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal">
                Live Preview
              </Badge>
            </div>
          </div>
        </CardHeader>

        {/* 폼 필드 본문 렌더링 */}
        <CardContent className="pt-6">
          {fieldCount === 0 ? (
            <div className="border-border/60 bg-muted/10 rounded-lg border border-dashed py-10 text-center">
              <p className="text-foreground text-sm font-medium">등록된 질문 항목이 없습니다</p>
              <p className="text-muted-foreground mt-1 text-xs">
                AI Navigator 대화창에 원하는 입력 항목을 말씀하시면 화면에 즉시 추가됩니다.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              {fields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  onFieldClick={onFieldClick}
                />
              ))}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
