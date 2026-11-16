"use client";

import * as React from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";
import { useNavigatorShell } from "../hooks/use-navigator-shell.hook";
import type { NavigatorShellProps } from "../types/navigator-shell.types";

/**
 * AI Navigator 통합 상주 패널 위젯 (Persistent Shell)
 *
 * Builder 및 Consumer 두 모드를 단일 쉘로 수용하며,
 * 비즈니스 로직(AI 통신, 액션 디스패치, 화면 맥락 조립 등)은 useNavigatorShell 훅에 전담 위임하고,
 * 대화 타임라인 및 프롬프트 입력 UI만 렌더링하는 순수 얇은 뷰(Thin View)입니다.
 */
export function NavigatorShell({ mode, className }: NavigatorShellProps) {
  const {
    config,
    messages,
    isBusy,
    progressMessage,
    inputValue,
    setInputValue,
    messagesEndRef,
    inputRef,
    handleSubmit,
  } = useNavigatorShell({ mode });

  return (
    <aside
      aria-label={`${config.badgeLabel} AI Navigator`}
      className={cn("bg-card border-border/80 flex h-full flex-col border-r shadow-xs", className)}
    >
      {/* 상단 헤더 */}
      <header className="border-border/60 bg-muted/20 flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-2 animate-pulse rounded-full" />
          <h2 className="text-foreground text-sm font-semibold tracking-tight">AI Navigator</h2>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {config.badgeLabel}
          </Badge>
        </div>
      </header>

      {/* 대화 메시지 목록 영역 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1 text-xs/relaxed",
              msg.role === "user" ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-lg px-3 py-2 text-xs",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/70 text-foreground border-border/40 border"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isBusy && (
          <div className="flex items-start">
            <div className="bg-muted/50 text-muted-foreground border-border/40 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs">
              <span className="size-1.5 animate-bounce rounded-full bg-current" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px]">{progressMessage || "생각 중..."}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 하단 입력 폼 영역 */}
      <footer className="border-border/60 bg-background/80 shrink-0 border-t p-3 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={config.inputPlaceholder}
            disabled={isBusy}
            className="focus-visible:ring-primary/30 h-9 flex-1 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isBusy || !inputValue.trim()}
            className="h-9 px-3 text-xs"
          >
            전송
          </Button>
        </form>
      </footer>
    </aside>
  );
}
