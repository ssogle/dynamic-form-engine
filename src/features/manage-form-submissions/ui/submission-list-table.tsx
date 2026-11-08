"use client";

import * as React from "react";
import type { Form } from "@/entities/form";
import { extractActiveFields } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { useFormSubmissionsQuery, useDeleteSubmissionMutation } from "@/entities/form-submission";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDateTime } from "@/shared/lib/utils";
import { EditSubmissionDialog } from "./edit-submission-dialog";

export interface SubmissionListTableProps {
  form: Form;
}

/**
 * 폼 응답 목록 데이터 테이블 컴포넌트
 */
export function SubmissionListTable({ form }: SubmissionListTableProps) {
  const { data: submissions, isLoading, isError, error } = useFormSubmissionsQuery(form.id);
  const { mutateAsync: deleteSubmission } = useDeleteSubmissionMutation(form.id);

  const [editingSubmission, setEditingSubmission] = React.useState<FormSubmission | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const activeFields = extractActiveFields(form);

  const handleDelete = async (submissionId: string) => {
    if (!window.confirm("정말 이 응답을 삭제하시겠습니까?")) return;

    try {
      setDeletingId(submissionId);
      await deleteSubmission(submissionId);
    } catch (err) {
      console.error("응답 삭제 실패:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // 1. 로딩 스켈레톤
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );
  }

  // 2. 에러 상태
  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
        <CardHeader>
          <CardTitle className="text-destructive text-sm font-semibold">
            응답 데이터를 불러오지 못했습니다
          </CardTitle>
          <CardDescription className="text-destructive/80 text-xs">
            {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 3. 빈 상태
  if (!submissions || submissions.length === 0) {
    return (
      <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
        <CardContent className="space-y-2">
          <p className="text-foreground text-sm font-medium">제출된 응답이 아직 없습니다</p>
          <p className="text-muted-foreground text-xs">
            첫 번째 응답을 작성하거나 다른 참여자에게 링크를 공유해 보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 4. 정상 응답 목록 테이블
  return (
    <>
      <div className="border-border/60 bg-card overflow-hidden rounded-lg border shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-border/60 text-muted-foreground border-b font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                {activeFields.map((field) => (
                  <th key={field.id} className="px-4 py-3 font-semibold">
                    {field.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">제출 일시</th>
                <th className="px-4 py-3 text-right font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-border/40 divide-y">
              {submissions.map((sub, idx) => (
                <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground px-4 py-3 font-mono">{idx + 1}</td>
                  {activeFields.map((field) => {
                    const rawVal = sub.data?.[field.name];
                    const displayVal =
                      rawVal !== undefined && rawVal !== null && rawVal !== ""
                        ? String(rawVal)
                        : "-";

                    return (
                      <td key={field.id} className="max-w-50 truncate px-4 py-3">
                        {displayVal}
                      </td>
                    );
                  })}
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {formatDateTime(sub.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingSubmission(sub)}
                      >
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                        onClick={() => handleDelete(sub.id)}
                        disabled={deletingId === sub.id}
                      >
                        {deletingId === sub.id ? "삭제 중..." : "삭제"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수정 다이얼로그 */}
      <EditSubmissionDialog
        form={form}
        submission={editingSubmission}
        isOpen={Boolean(editingSubmission)}
        onClose={() => setEditingSubmission(null)}
      />
    </>
  );
}
