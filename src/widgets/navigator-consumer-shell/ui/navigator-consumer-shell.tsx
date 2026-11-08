"use client";

import * as React from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

/**
 * 컨슈머 네비게이터 쉘 프로퍼티 인터페이스
 */
export interface NavigatorConsumerShellProps {
  /** 외부 커스텀 스타일 클래스 */
  className?: string | undefined;
}

interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
  timestamp: string;
}

/**
 * AI Consumer Navigator 상주 패널 위젯 (Persistent Shell)
 *
 * 컨슈머(응답자) 포털 좌측(384px)에 상주하며, 엔드유저와의 자연어 대화를 통해
 * 적절한 폼으로 화면을 자동 이동시키고, 입력을 대행하며 제출까지 보조하는 대화형 도우미 쉘입니다.
 */
export function NavigatorConsumerShell({ className }: NavigatorConsumerShellProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "안녕하세요! Consumer AI Navigator입니다. 참여하고자 하는 설문이나 작성하고 싶은 신청서에 대해 말씀해 주시면, 적합한 폼을 찾아드리고 작성을 도와드립니다.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputValue, setInputValue] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // 메시지 추가 시 하단 스크롤
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: `assistant-${Date.now() + 1}`,
        sender: "assistant",
        text: `'${trimmed}'에 대한 요청을 확인했습니다. 현재 컨슈머 AI 자율주행 액션 모듈이 준비 중입니다. 상단 탭이나 목록에서 직접 폼을 선택하여 응답을 작성해 보세요.`,
        timestamp: new Date().toISOString(),
      },
    ]);
    setInputValue("");
  };

  return (
    <aside
      aria-label="Consumer AI Navigator"
      className={cn("bg-card border-border/80 flex h-full flex-col border-r shadow-xs", className)}
    >
      {/* 상단 헤더 */}
      <header className="border-border/60 bg-muted/20 flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-2 animate-pulse rounded-full" />
          <h2 className="text-foreground text-sm font-semibold tracking-tight">AI Navigator</h2>
          <Badge variant="secondary" className="text-[10px] font-normal">
            Consumer
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
              msg.sender === "user" ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-lg px-3 py-2 text-xs",
                msg.sender === "user"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/70 text-foreground border-border/40 border"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 하단 입력 영역 */}
      <footer className="border-border/60 bg-background/80 border-t p-3">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="예: 입사 지원서 작성하고 싶어"
            className="h-9 text-xs"
          />
          <Button type="submit" size="sm" className="h-9 shrink-0 px-3">
            전송
          </Button>
        </form>
      </footer>
    </aside>
  );
}
