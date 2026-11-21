"use client";

import * as React from "react";
import { Globe, RotateCcw } from "lucide-react";
import { extractActiveFields, useFormDetailQuery, usePublishFormMutation } from "@/entities/form";
import { Button } from "@/shared/ui/button";

export interface BuilderFormPublishButtonProps {
  /** 대상 폼 식별자 (UUID) */
  readonly formId: string;
}

/**
 * 빌더 폼 캔버스(`/builder/forms/[id]`) 상단 제어 바에 배치되는 공식 발행/발행 취소 토글 버튼입니다.
 * 분석 뷰 상세 상단 제어 바(`AnalysisViewActionBar`)와 동일한 문구·아이콘·배치 규격을 따릅니다.
 */
export function BuilderFormPublishButton({ formId }: BuilderFormPublishButtonProps) {
  const { data: form } = useFormDetailQuery(formId);
  const publishFormMutation = usePublishFormMutation();

  if (!form) {
    return null;
  }

  const isPublished = Boolean(form.publishedAt);
  const activeFieldCount = extractActiveFields(form).length;
  const cannotPublish = !isPublished && activeFieldCount === 0;

  return (
    <Button
      type="button"
      variant={isPublished ? "outline" : "default"}
      size="sm"
      className="gap-1.5"
      disabled={publishFormMutation.isPending || cannotPublish}
      title={cannotPublish ? "최소 1개 이상의 활성 필드가 있어야 발행할 수 있습니다." : undefined}
      onClick={() => publishFormMutation.mutate({ id: form.id, isPublished: !isPublished })}
    >
      {isPublished ? (
        <>
          <RotateCcw className="size-3.5" />
          발행 취소
        </>
      ) : (
        <>
          <Globe className="size-3.5" />
          공식 발행
        </>
      )}
    </Button>
  );
}
