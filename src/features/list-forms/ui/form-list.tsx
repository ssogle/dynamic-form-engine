"use client";

import React from "react";
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
import { Skeleton } from "@/shared/ui/skeleton";
import {
  useCreateSampleFormMutation,
  useDeleteFormMutation,
  useFormsQuery,
  useUpdateFormMutation,
} from "../queries/use-forms.query";

/**
 * 폼 목록 조회, 등록, 수정, 소프트 삭제 인터랙션 카드 위젯
 *
 * Supabase DB(forms 테이블)의 전체 CRUD 사이클을 화면에서 즉각 검증할 수 있는 기준점 위젯입니다.
 */
export function FormList() {
  const { data: forms, isLoading, isError, error } = useFormsQuery();
  const createFormMutation = useCreateSampleFormMutation();
  const updateFormMutation = useUpdateFormMutation();
  const deleteFormMutation = useDeleteFormMutation();

  /**
   * 개발/테스트용 샘플 폼 생성 핸들러
   */
  const handleCreateSampleForm = () => {
    const timestamp = Date.now();
    createFormMutation.mutate({
      slug: `sample-form-${timestamp}`,
      title: `샘플 폼 (${new Date().toLocaleTimeString("ko-KR")})`,
      description: "DB 연동 파이프라인 검증을 위해 자동 생성된 샘플 폼입니다.",
      schemaDefinition: {
        fields: [
          {
            id: "user_name",
            type: "text",
            label: "작성자 성명",
            required: true,
          },
        ],
      },
    });
  };

  /**
   * 폼 제목 부분 수정 핸들러 (테스트용)
   */
  const handleUpdateForm = (id: string, currentTitle: string) => {
    const cleanTitle = currentTitle.replace(" (수정됨)", "");
    updateFormMutation.mutate({
      id,
      data: {
        title: `${cleanTitle} (수정됨)`,
      },
    });
  };

  /**
   * 폼 소프트 삭제 핸들러
   */
  const handleDeleteForm = (id: string) => {
    deleteFormMutation.mutate(id);
  };

  /* 1. 로딩 상태: shadcn 공식 Skeleton 컴포넌트 활용 */
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">폼 메타데이터 목록</CardTitle>
            <span className="text-muted-foreground text-xs">폼 목록을 불러오는 중...</span>
          </div>
          <CardDescription>
            데이터베이스로부터 등록된 폼 스키마를 로드하고 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  /* 2. 에러 상태 */
  if (isError) {
    return (
      <Card className="border-destructive/40 w-full">
        <CardHeader>
          <CardTitle className="text-destructive text-base font-semibold">
            폼 목록을 불러오지 못했습니다
          </CardTitle>
          <CardDescription>
            {error?.message ?? "서버와의 통신 중 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  /* 3. 빈 목록 상태 */
  if (!forms || forms.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">폼 메타데이터 목록</CardTitle>
          <CardDescription>
            동적으로 생성된 폼의 스키마와 메타데이터가 이곳에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground text-sm">등록된 폼이 없습니다.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            아래 버튼을 눌러 첫 번째 샘플 폼을 데이터베이스에 등록해 보세요.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={handleCreateSampleForm}
            disabled={createFormMutation.isPending}
          >
            {createFormMutation.isPending ? "생성 중..." : "샘플 폼 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* 4. 데이터 목록 및 인터랙션 상태 */
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">폼 메타데이터 목록</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateSampleForm}
            disabled={createFormMutation.isPending}
          >
            {createFormMutation.isPending ? "추가 중..." : "+ 샘플 폼 추가"}
          </Button>
        </div>
        <CardDescription>
          현재 데이터베이스에 저장된 활성 폼 총 {forms.length}개입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {forms.map((form) => (
          <div
            key={form.id}
            className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-foreground text-sm font-semibold">{form.title}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {form.slug}
              </Badge>
            </div>
            {form.description ? (
              <p className="text-muted-foreground text-xs leading-relaxed">{form.description}</p>
            ) : null}
            <div className="text-muted-foreground/80 mt-1 flex items-center justify-between text-[11px]">
              <span>ID: {form.id.slice(0, 8)}...</span>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => handleUpdateForm(form.id, form.title)}
                  disabled={updateFormMutation.isPending}
                >
                  수정
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteForm(form.id)}
                  disabled={deleteFormMutation.isPending}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="text-muted-foreground border-t pt-3 text-xs">
        Drizzle ORM 및 Supabase Transaction Pooler를 통해 실시간 동기화됩니다.
      </CardFooter>
    </Card>
  );
}
