"use client";

import * as React from "react";
import type { TextAnalysisBlock } from "@/entities/analysis-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { parseTextContent, type TextInlineSegment } from "../lib/parse-text-content";

export interface TextBlockRendererProps {
  block: TextAnalysisBlock;
}

function renderInlineSegments(segments: TextInlineSegment[]) {
  return segments.map((seg, index) =>
    seg.bold ? (
      <strong key={index} className="text-foreground font-semibold">
        {seg.text}
      </strong>
    ) : (
      <React.Fragment key={index}>{seg.text}</React.Fragment>
    )
  );
}

/**
 * 분석 뷰 문서의 서술형 텍스트/인사이트 블록 렌더러
 */
export function TextBlockRenderer({ block }: TextBlockRendererProps) {
  const nodes = React.useMemo(() => parseTextContent(block.content), [block.content]);

  return (
    <Card>
      {block.title ? (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent
        className={
          block.title
            ? "space-y-3 text-sm leading-relaxed"
            : "space-y-3 pt-6 text-sm leading-relaxed"
        }
      >
        {nodes.length === 0 ? (
          <p className="text-muted-foreground">내용이 비어 있습니다.</p>
        ) : (
          nodes.map((node, idx) => {
            if (node.kind === "heading") {
              if (node.level === 1) {
                return (
                  <h3 key={idx} className="text-foreground text-lg font-bold">
                    {renderInlineSegments(node.segments)}
                  </h3>
                );
              }
              if (node.level === 2) {
                return (
                  <h4 key={idx} className="text-foreground text-base font-semibold">
                    {renderInlineSegments(node.segments)}
                  </h4>
                );
              }
              return (
                <h5 key={idx} className="text-foreground text-sm font-semibold">
                  {renderInlineSegments(node.segments)}
                </h5>
              );
            }

            if (node.kind === "bulletList") {
              return (
                <ul key={idx} className="text-muted-foreground list-disc space-y-1.5 pl-5">
                  {node.items.map((itemSegments, itemIdx) => (
                    <li key={itemIdx}>{renderInlineSegments(itemSegments)}</li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={idx} className="text-muted-foreground">
                {renderInlineSegments(node.segments)}
              </p>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
