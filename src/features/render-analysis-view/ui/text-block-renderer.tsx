"use client";

import type { TextAnalysisBlock } from "@/entities/analysis-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { MarkdownContent } from "@/shared/ui/markdown-content";
import { BlockSourceLinksFooter } from "./block-source-links-footer";

export interface TextBlockRendererProps {
  block: TextAnalysisBlock;
}

/**
 * 분석 뷰 문서의 서술형 텍스트/인사이트 블록 렌더러
 *
 * 공용 GFM 마크다운 렌더러(MarkdownContent)를 통해 표, 목록, 코드 블록, 강조 등을 렌더링합니다.
 */
export function TextBlockRenderer({ block }: TextBlockRendererProps) {
  return (
    <Card>
      {block.title ? (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={block.title ? "text-sm" : "pt-6 text-sm"}>
        <MarkdownContent content={block.content} emptyFallback="내용이 비어 있습니다." />
      </CardContent>
      <BlockSourceLinksFooter block={block} />
    </Card>
  );
}
