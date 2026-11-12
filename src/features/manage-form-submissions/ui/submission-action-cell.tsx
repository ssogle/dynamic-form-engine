"use client";

import * as React from "react";
import Link from "next/link";
import type { FormSubmission } from "@/entities/form-submission";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export interface SubmissionActionCellProps {
  /**
   * 응답 데이터 객체
   */
  submission: FormSubmission;
  /**
   * 부모 폼 ID
   */
  formId: string;
  /**
   * 현재 삭제 진행 중인 응답 ID
   */
  deletingId: string | null;
  /**
   * 단건 응답 삭제 핸들러
   */
  onDelete: (id: string) => Promise<void>;
}

/**
 * 제출 응답 목록 테이블의 행별 관리 액션(상세, 수정, 삭제) 렌더링 컴포넌트
 */
export function SubmissionActionCell({
  submission,
  formId,
  deletingId,
  onDelete,
}: SubmissionActionCellProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDeleting = deletingId === submission.id;

  return (
    <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <Link href={`/consumer/forms/${formId}/submissions/${submission.id}`}>상세</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <Link href={`/consumer/forms/${formId}/submissions/${submission.id}/edit`}>수정</Link>
      </Button>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
            onClick={(e) => e.stopPropagation()}
            disabled={isDeleting}
          >
            {isDeleting ? "삭제 중..." : "삭제"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-56 space-y-2 p-3 text-left shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <p className="text-foreground text-xs font-semibold">응답을 삭제하시겠습니까?</p>
            <p className="text-muted-foreground text-[11px]">삭제 후에는 복구할 수 없습니다.</p>
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={async (e) => {
                e.stopPropagation();
                setIsOpen(false);
                await onDelete(submission.id);
              }}
            >
              삭제 확인
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
