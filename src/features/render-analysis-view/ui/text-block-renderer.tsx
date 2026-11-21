"use client";

import * as React from "react";
import type { TextAnalysisBlock } from "@/entities/analysis-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { MarkdownContent } from "@/shared/ui/markdown-content";
import { BlockSourceLinksFooter } from "./block-source-links-footer";

export interface TextBlockRendererProps {
  block: TextAnalysisBlock;
  /** 카드 헤더 우측에 삽입할 추가 액션 (예: 분석가 캔버스 AI 수정 버튼) */
  headerAction?: React.ReactNode | undefined;
}

/**
 * 분석 뷰 문서의 서술형 텍스트/인사이트 블록 렌더러
 *
 * 공용 GFM 마크다운 렌더러(MarkdownContent)를 통해 표, 목록, 코드 블록, 강조 등을 렌더링합니다.
 */
export function TextBlockRenderer({ block, headerAction }: TextBlockRendererProps) {
  return (
    <Card>
      {block.title ? (
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
          {headerAction}
        </CardHeader>
      ) : headerAction ? (
        <div className="flex justify-end px-6 pt-4 pb-0">{headerAction}</div>
      ) : null}
      <CardContent className={block.title || headerAction ? "text-sm" : "pt-6 text-sm"}>
        <MarkdownContent content={block.content} emptyFallback="내용이 비어 있습니다." />
      </CardContent>
      <BlockSourceLinksFooter block={block} />
    </Card>
  );
}
