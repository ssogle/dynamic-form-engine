"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AnalysisBlock } from "@/entities/analysis-view";
import { CardFooter } from "@/shared/ui/card";
import { buildBlockSourceLinks } from "../lib/build-source-links";

export interface BlockSourceLinksFooterProps {
  /** 원천 데이터 뷰 바로가기 링크를 표시할 분석 블록 */
  block: AnalysisBlock;
}

/**
 * 분석 블록 하단에 원천 폼 데이터 뷰(`/consumer/forms/[id]`) 새 탭 바로가기 링크를
 * 렌더링하는 공통 푸터 컴포넌트입니다.
 */
export function BlockSourceLinksFooter({ block }: BlockSourceLinksFooterProps) {
  const links = buildBlockSourceLinks(block);

  if (links.length === 0) {
    return null;
  }

  return (
    <CardFooter className="text-muted-foreground flex flex-wrap items-center gap-2 py-2.5 text-xs">
      <span className="font-medium">원본 데이터 보기:</span>
      {links.map((link) => {
        const periodSuffix =
          link.startDate || link.endDate
            ? ` (${link.startDate ?? ""} ~ ${link.endDate ?? ""})`
            : "";
        const filterSuffix =
          link.filters && link.filters.length > 0 ? ` · 필터 ${link.filters.length}개` : "";

        return (
          <Link
            key={link.key}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-background text-foreground hover:border-primary/40 hover:text-primary inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors"
          >
            <span>
              {link.label}
              {periodSuffix || filterSuffix ? (
                <span className="text-muted-foreground ml-0.5">
                  {periodSuffix}
                  {filterSuffix}
                </span>
              ) : null}
            </span>
            <ExternalLink className="size-3 shrink-0" />
          </Link>
        );
      })}
    </CardFooter>
  );
}
