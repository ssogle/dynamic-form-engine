"use client";

import React from "react";
import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDate } from "@/shared/lib/date";
import { useBuilderFormList } from "../hooks/use-builder-form-list.hook";

/**
 * 빌더 전용 폼 목록 열람 및 소프트 삭제 기능 컴포넌트 (BuilderFormList)
 *
 * 불필요한 중첩 카드 레이어를 제거하고 각 폼을 단일 카드 그리드로 평탄화하여 표시합니다.
 * 비즈니스 로직(목록 쿼리, 발행 상태 토글, 삭제 뮤테이션 등)은 useBuilderFormList 훅에 전담 위임하는 순수 얇은 뷰(Thin View)입니다.
 */
export function BuilderFormList() {
  const {
    forms,
    isLoading,
    isError,
    error,
    isPublishPending,
    isDeletePending,
    handleTogglePublish,
    handleDeleteForm,
  } = useBuilderFormList();

  const [openDeleteId, setOpenDeleteId] = React.useState<string | null>(null);

  /* 1. 로딩 상태: 단일 카드 그리드 스켈레톤 */
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="border-border/60 shadow-xs">
            <CardHeader className="space-y-2 pb-3">
              <Skeleton className="h-5 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
            </CardHeader>
            <CardContent className="pb-3">
              <Skeleton className="h-3.5 w-2/3 rounded-md" />
            </CardContent>
            <CardFooter className="border-border border-t pt-3">
              <Skeleton className="h-8 w-24 rounded-md" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  /* 2. 에러 상태 */
  if (isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 w-full shadow-xs">
        <CardHeader>
          <CardTitle className="text-destructive text-base font-semibold">
            폼 목록을 불러오지 못했습니다
          </CardTitle>
          <CardDescription className="text-destructive/80">
            {error?.message ?? "서버와의 통신 중 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  /* 3. 빈 목록 상태 */
  if (!forms || forms.length === 0) {
    return (
      <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
        <CardContent className="flex flex-col items-center justify-center">
          <FileText className="text-muted-foreground/60 mb-3 size-10" />
          <p className="text-foreground text-sm font-medium">등록된 폼이 없습니다.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            AI Navigator 대화창에 자연어로 새로운 폼 생성을 요청해 보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  /* 4. 평탄화된 단일 카드 그리드 목록 */
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {forms.map((form) => {
        const isPublished = Boolean(form.publishedAt);
        const activeFieldCount = (form.schemaDefinition?.fields ?? []).filter(
          (field) => !field.deletedAt
        ).length;

        return (
          <Card key={form.id} className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/builder/forms/${form.id}`}
                  className="text-foreground line-clamp-1 text-base font-semibold hover:underline"
                >
                  {form.title}
                </Link>
                {isPublished ? (
                  <Badge
                    variant="default"
                    className="shrink-0 bg-emerald-600 text-[10px] hover:bg-emerald-700"
                  >
                    발행됨
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    초안
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2 min-h-10 text-xs/relaxed">
                {form.description || "설명이 등록되지 않은 동적 폼입니다."}
              </CardDescription>
            </CardHeader>

            <CardContent className="text-muted-foreground pb-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span>활성 필드 {activeFieldCount}개</span>
                {form.publishedAt ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatDate(form.publishedAt)} 발행
                  </span>
                ) : (
                  <span>미발행 초안</span>
                )}
              </div>
            </CardContent>

            <CardFooter className="border-border flex items-center justify-between gap-2 border-t pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href={`/builder/forms/${form.id}`}>캔버스 열기</Link>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isPublished ? "secondary" : "default"}
                  onClick={() => handleTogglePublish(form.id, !isPublished)}
                  disabled={isPublishPending}
                >
                  {isPublished ? "발행 취소" : "공식 발행"}
                </Button>

                <Popover
                  open={openDeleteId === form.id}
                  onOpenChange={(open) => setOpenDeleteId(open ? form.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive size-8"
                      aria-label="폼 삭제"
                      disabled={isDeletePending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 space-y-3">
                    <div className="space-y-1">
                      <p className="text-foreground text-sm font-medium">폼을 삭제할까요?</p>
                      <p className="text-muted-foreground text-xs">
                        &apos;{form.title}&apos; 폼이 보관함에서 제외됩니다.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDeleteId(null)}
                      >
                        취소
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isDeletePending}
                        onClick={() => {
                          handleDeleteForm(form.id);
                          setOpenDeleteId(null);
                        }}
                      >
                        삭제 확인
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
