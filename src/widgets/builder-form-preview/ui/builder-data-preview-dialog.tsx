"use client";

import * as React from "react";
import { FileSearch, Table2 } from "lucide-react";
import { ManageFormSubmissions, SubmissionDetailView } from "@/features/manage-form-submissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useBuilderFormPreview } from "../hooks/use-builder-form-preview.hook";
import type { BuilderDataPreviewDialogProps } from "../types/builder-form-preview.types";

/**
 * 빌더 데이터 미리보기 모달 위젯 (BuilderDataPreviewDialog)
 *
 * 빌더의 메인 작업 영역은 항상 `폼 캔버스`로 유지한 채,
 * 상단 `목록 미리보기` / `상세 미리보기` 버튼을 통해 각각 독립된 모달로 테이블과 응답 상세를 확인합니다.
 */
export function BuilderDataPreviewDialog({ formId }: BuilderDataPreviewDialogProps) {
  const {
    isOpen,
    activeView,
    handleOpenView,
    handleOpenChange,
    sampleSubmissions,
    detailSubmissionId,
    detailSampleSubmission,
  } = useBuilderFormPreview({ formId });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => handleOpenView("list")}
        >
          <Table2 className="size-3.5" />
          목록 미리보기
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => handleOpenView("detail")}
        >
          <FileSearch className="size-3.5" />
          상세 미리보기
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-border/60 shrink-0 gap-1.5 border-b px-6 py-4 pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{activeView === "list" ? "목록 미리보기" : "상세 미리보기"}</DialogTitle>
              {sampleSubmissions.length > 0 && (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  샘플 데이터 기반
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs">
              {activeView === "list"
                ? "현재 폼 스키마의 대표 필드와 컬럼 구성이 데이터 목록 테이블에서 어떻게 표시되는지 확인합니다."
                : "현재 폼 스키마의 응답 상세 카드 레이아웃이 어떻게 표시되는지 확인합니다."}
            </DialogDescription>
          </DialogHeader>

          {/* 모달 본문 스크롤 영역 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {activeView === "list" && (
              <ManageFormSubmissions
                formId={formId}
                mode="preview"
                sampleSubmissions={sampleSubmissions}
              />
            )}

            {activeView === "detail" &&
              (detailSubmissionId ? (
                <SubmissionDetailView
                  formId={formId}
                  submissionId={detailSubmissionId}
                  mode="preview"
                  sampleSubmission={detailSampleSubmission}
                />
              ) : (
                <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
                  <CardContent className="space-y-1">
                    <p className="text-foreground text-sm font-medium">
                      미리볼 상세 레코드가 없습니다.
                    </p>
                    <p className="text-muted-foreground text-xs">
                      활성 필드를 추가하면 샘플 상세 화면이 자동으로 구성됩니다.
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
