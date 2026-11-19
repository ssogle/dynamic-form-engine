import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/shared/lib/cn";

export interface MarkdownContentProps {
  /** 렌더링할 GFM 마크다운 원문 문자열 */
  content: string;
  /** 본문이 비어 있을 때 표시할 대체 문구 */
  emptyFallback?: string | undefined;
  /** 여백/폰트 크기 프리셋 ("default": 분석 카드 본문, "compact": 채팅 버블) */
  variant?: "default" | "compact" | undefined;
  /** 추가 Tailwind 클래스명 */
  className?: string | undefined;
}

/**
 * GitHub Flavored Markdown(GFM) 기반 공용 마크다운 렌더러 컴포넌트
 *
 * AI Navigator 채팅 응답 버블(`variant="compact"`)과 Analyst 분석 뷰 서술 블록(`variant="default"`)에서
 * 제목, 목록, 표, 코드 블록, 인용구, 링크 등을 일관된 시맨틱 디자인 토큰으로 렌더링합니다.
 */
export function MarkdownContent({
  content,
  emptyFallback,
  variant = "default",
  className,
}: MarkdownContentProps) {
  const trimmed = content.trim();
  if (!trimmed) {
    return emptyFallback ? <p className="text-muted-foreground text-sm">{emptyFallback}</p> : null;
  }

  const isCompact = variant === "compact";

  const components: Components = {
    h1: ({ children }) => (
      <h3
        className={cn(
          "text-foreground font-bold tracking-tight",
          isCompact ? "mt-2 mb-1 text-sm first:mt-0" : "mt-3 mb-1.5 text-lg first:mt-0"
        )}
      >
        {children}
      </h3>
    ),
    h2: ({ children }) => (
      <h4
        className={cn(
          "text-foreground font-semibold tracking-tight",
          isCompact ? "mt-2 mb-1 text-xs first:mt-0" : "mt-2.5 mb-1 text-base first:mt-0"
        )}
      >
        {children}
      </h4>
    ),
    h3: ({ children }) => (
      <h5
        className={cn(
          "text-foreground font-semibold",
          isCompact ? "mt-1.5 mb-0.5 text-xs first:mt-0" : "mt-2 mb-1 text-sm first:mt-0"
        )}
      >
        {children}
      </h5>
    ),
    p: ({ children }) => (
      <p className={cn("leading-relaxed whitespace-pre-wrap", isCompact ? "text-xs" : "text-sm")}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        className={cn(
          "list-disc pl-4.5",
          isCompact ? "space-y-0.5 text-xs" : "text-muted-foreground space-y-1.5 pl-5 text-sm"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          "list-decimal pl-4.5",
          isCompact ? "space-y-0.5 text-xs" : "text-muted-foreground space-y-1.5 pl-5 text-sm"
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    blockquote: ({ children }) => (
      <blockquote className="border-primary/40 text-muted-foreground border-l-2 pl-3 italic">
        {children}
      </blockquote>
    ),
    code: ({ className: codeClassName, children }) => {
      const isBlock = Boolean(codeClassName && codeClassName.includes("language-"));
      if (isBlock) {
        return (
          <code className="bg-muted text-foreground block overflow-x-auto rounded-md p-2.5 font-mono text-[11px] leading-relaxed">
            {children}
          </code>
        );
      }
      return (
        <code className="bg-muted/80 text-foreground rounded px-1 py-0.5 font-mono text-[0.9em]">
          {children}
        </code>
      );
    },
    pre: ({ children }) => <pre className="my-1.5 overflow-x-auto">{children}</pre>,
    table: ({ children }) => (
      <div className="border-border/70 my-1.5 overflow-x-auto rounded-md border">
        <table
          className={cn("w-full border-collapse text-left", isCompact ? "text-[11px]" : "text-xs")}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/50 border-b">{children}</thead>,
    th: ({ children }) => (
      <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">{children}</th>
    ),
    td: ({ children }) => <td className="border-border/40 border-t px-2.5 py-1.5">{children}</td>,
    hr: () => <hr className="border-border/60 my-2" />,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    ),
  };

  return (
    <div className={cn(isCompact ? "space-y-1.5" : "space-y-3", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
