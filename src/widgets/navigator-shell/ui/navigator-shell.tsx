"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useNavigatorActionMutation,
  type NavigatorAction,
} from "@/features/execute-navigator-action";
import { formKeys, type Form, type CoreFormField } from "@/entities/form";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { useNavigatorChatStore } from "../store/navigator-chat.store";

/**
 * 네비게이터 쉘 프로퍼티 인터페이스
 */
export interface NavigatorShellProps {
  /**
   * 외부 커스텀 스타일 클래스
   */
  className?: string | undefined;
}

/**
 * AI Navigator 상주 패널 위젯 (Persistent Shell)
 *
 * 화면 전체의 자율주행 관제탑 역할을 수행하며, 사용자의 자연어 발화를 실시간 액션으로 변환하고
 * 화면 라우팅 이동 및 스키마 변경을 총괄 지휘합니다.
 */
export function NavigatorShell({ className }: NavigatorShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const messages = useNavigatorChatStore((state) => state.messages);
  const isGenerating = useNavigatorChatStore((state) => state.isGenerating);
  const addMessage = useNavigatorChatStore((state) => state.addMessage);
  const setIsGenerating = useNavigatorChatStore((state) => state.setIsGenerating);
  const clearMessages = useNavigatorChatStore((state) => state.clearMessages);

  const [inputValue, setInputValue] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { mutateAsync: executeAction, isPending } = useNavigatorActionMutation();

  const isBusy = isGenerating || isPending;

  // 새 메시지 수신 시 스크롤을 맨 아래로 이동
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, isBusy]);

  /**
   * AI 응답 액션을 해석하여 브라우저 화면 조작 디스패치
   */
  const dispatchAction = React.useCallback(
    (action: NavigatorAction) => {
      switch (action.type) {
        case "NAVIGATE":
          router.push(action.targetPath);
          break;

        case "CREATE_FORM":
          router.push(`/builder/forms/${action.slug}`);
          break;

        case "UPDATE_SCHEMA":
          if (!pathname.includes(`/builder/forms/${action.formSlug}`)) {
            router.push(`/builder/forms/${action.formSlug}`);
          }
          break;
      }
    },
    [router, pathname]
  );

  /**
   * 사용자 메시지 전송 및 AI 액션 오케스트레이션 핸들러
   */
  const handleSendMessage = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();

    const trimmed = inputValue.trim();
    if (!trimmed || isBusy) return;

    // 1. 사용자 메시지 스토어에 추가
    addMessage({
      role: "user",
      content: trimmed,
    });
    setInputValue("");
    setIsGenerating(true);

    try {
      // 현재 화면 URL로부터 활성 폼 슬러그 및 캐시 스키마 추출
      const activeSlugMatch = pathname.match(/\/builder\/forms\/([a-z0-9-]+)/);
      const activeSlug = activeSlugMatch?.[1];

      let currentFormContext = undefined;
      if (activeSlug) {
        const cached = queryClient.getQueryData<
          Form | { slug: string; title: string; description?: string; fields: CoreFormField[] }
        >(formKeys.detail(activeSlug));
        if (cached) {
          const rawFields =
            "fields" in cached && Array.isArray(cached.fields)
              ? cached.fields
              : "schemaDefinition" in cached &&
                  cached.schemaDefinition !== null &&
                  typeof cached.schemaDefinition === "object" &&
                  Array.isArray((cached.schemaDefinition as { fields?: unknown }).fields)
                ? (cached.schemaDefinition as { fields: CoreFormField[] }).fields
                : [];

          currentFormContext = {
            slug: cached.slug,
            title: cached.title,
            description: cached.description ?? undefined,
            fields: rawFields,
          };
        }
      }

      // 2. 백엔드 AI 액션 API 호출 (이전 대화 히스토리 및 현재 폼 스키마 컨텍스트 동봉)
      // 시스템 안내 문구 및 웰컴 메시지를 제외한 실제 사용자/어시스턴트 대화 내역 추출
      const historyMessages = messages
        .filter(
          (m): m is typeof m & { role: "user" | "assistant" } =>
            m.id !== "msg_welcome" && (m.role === "user" || m.role === "assistant")
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await executeAction({
        prompt: trimmed,
        messages: historyMessages.length > 0 ? historyMessages : undefined,
        currentContext: {
          currentPath: pathname,
          currentForm: currentFormContext,
        },
      });

      // 3. AI 응답 메시지 스토어에 추가
      const replyContent =
        response.reply || response.action?.message || "요청하신 작업을 완료했습니다.";
      addMessage({
        role: "assistant",
        content: replyContent,
        action: response.action ?? undefined,
      });

      // 4. 액션에 따른 화면 제어 디스패치
      if (response.action) {
        dispatchAction(response.action);
      }
    } catch (error) {
      addMessage({
        role: "system",
        content:
          error instanceof Error
            ? `명령 처리 중 오류가 발생했습니다: ${error.message}`
            : "명령 처리 중 알 수 없는 오류가 발생했습니다.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Enter 키 입력 시 즉시 전송 (Shift+Enter는 줄바꿈)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <aside
      aria-label="AI Navigator 패널"
      className={cn(
        "border-border/80 bg-background/95 flex size-full flex-col border-r backdrop-blur-sm",
        className
      )}
    >
      {/* 패널 상단 관제탑 헤더 */}
      <header className="border-border/60 flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="font-heading text-foreground text-sm font-semibold tracking-tight">
            AI Navigator
          </span>
          <Badge variant="secondary" className="text-[10px] tracking-wide uppercase">
            Autonomous
          </Badge>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={clearMessages}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          대화 비우기
        </Button>
      </header>

      {/* 메시지 스트림 목록 영역 */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isSystem = message.role === "system";

          if (isSystem) {
            return (
              <div
                key={message.id}
                className="bg-destructive/10 text-destructive mx-auto my-2 max-w-[90%] rounded-md p-2.5 text-center text-xs"
              >
                {message.content}
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={cn("flex flex-col gap-1 text-sm", isUser ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm/relaxed whitespace-pre-wrap",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-br-xs"
                    : "bg-muted/80 text-foreground border-border/40 rounded-bl-xs border shadow-2xs"
                )}
              >
                {message.content}
              </div>

              {/* AI 액션 실행 배지 안내 */}
              {message.action && (
                <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px]">
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {message.action.type}
                  </Badge>
                  {message.action.type === "NAVIGATE" && <span>{message.action.targetPath}</span>}
                  {message.action.type === "CREATE_FORM" && <span>{message.action.slug}</span>}
                  {message.action.type === "UPDATE_SCHEMA" && (
                    <span>{message.action.operation}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* AI 작업 중 로딩 인디케이터 */}
        {isBusy && (
          <div className="bg-muted/50 text-muted-foreground border-border/40 flex max-w-[80%] animate-pulse items-center gap-2 rounded-2xl border p-3 text-xs">
            <span className="bg-primary size-2 animate-ping rounded-full" />
            <span>화면을 조작하고 있습니다...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 발화 입력 푸터 */}
      <footer className="border-border/60 bg-muted/20 border-t p-3">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI Navigator에게 명령하세요 (예: 설문 폼 만들어줘, 이메일 필드 추가해줘)... 무엇을 도와드릴까요?"
            rows={2}
            disabled={isBusy}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px]">
              Enter로 전송, Shift+Enter로 줄바꿈
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isBusy || !inputValue.trim()}
              className="gap-1 font-medium"
            >
              전송
            </Button>
          </div>
        </form>
      </footer>
    </aside>
  );
}
