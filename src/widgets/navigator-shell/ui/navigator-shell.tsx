"use client";

import * as React from "react";
import {
  ArrowUpIcon,
  CheckCircle2,
  ImagePlusIcon,
  LoaderCircleIcon,
  PanelLeft,
  PanelRight,
  ShieldAlertIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/attachment";
import { Badge } from "@/shared/ui/badge";
import { Bubble, BubbleContent } from "@/shared/ui/bubble";
import { Button } from "@/shared/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/shared/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/shared/ui/item";
import { MarkdownContent } from "@/shared/ui/markdown-content";
import { Message, MessageContent } from "@/shared/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/shared/ui/message-scroller";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/shared/ui/trace";
import { cn } from "@/shared/lib/cn";
import { subscribeFocusNavigator } from "@/shared/lib/navigator-focus";
import { useNavigatorShell } from "../hooks/use-navigator-shell.hook";
import type { NavigatorShellProps } from "../types/navigator-shell.types";

/**
 * AI Navigator 통합 상주 패널 위젯 (Persistent Shell)
 *
 * shadcn AI Elements(Message, Bubble, Attachment, Trace, Item, InputGroup)와
 * 공용 GFM 마크다운 렌더러를 조합해 대화 타임라인, 멀티모달 이미지 첨부,
 * 고위험 액션 인라인 사전 승인(HITL) UI를 렌더링하는 얇은 뷰(Thin View)입니다.
 */
export function NavigatorShell({
  mode,
  dockSide = "right",
  onToggleDockSide,
  className,
}: NavigatorShellProps) {
  const {
    config,
    messages,
    isBusy,
    progressMessage,
    progressSteps,
    expandedStepMessageIds,
    toggleStepsExpanded,
    inputValue,
    setInputValue,
    attachments,
    handleAddAttachmentFiles,
    handleRemoveAttachment,
    handlePaste,
    handleApproveConfirmation,
    handleRejectConfirmation,
    messagesEndRef,
    inputRef,
    fileInputRef,
    handleSubmit,
  } = useNavigatorShell({ mode });

  const canSubmit = !isBusy && (Boolean(inputValue.trim()) || attachments.length > 0);

  // 전역 Cmd/Ctrl + K 단축키 및 본문 포커스 트리거 수신 시 채팅 입력창으로 즉시 포커스 이동
  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    const unsubscribe = subscribeFocusNavigator(({ prefillText, replace }) => {
      if (prefillText !== undefined) {
        setInputValue((prev) => (replace || !prev.trim() ? prefillText : prev));
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      unsubscribe();
    };
  }, [inputRef, setInputValue]);

  return (
    <aside
      aria-label={`${config.badgeLabel} AI Navigator`}
      className={cn("bg-card flex h-full flex-col shadow-xs", className)}
    >
      {/* 상단 헤더 */}
      <header className="border-border/60 bg-muted/20 flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-2 animate-pulse rounded-full" />
          <h2 className="text-foreground text-sm font-semibold tracking-tight">{config.title}</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <kbd className="bg-muted text-muted-foreground border-border/70 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
            ⌘K
          </kbd>
          {onToggleDockSide && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="AI Navigator 패널 좌우 위치 전환"
              title={dockSide === "right" ? "패널을 왼쪽으로 이동" : "패널을 오른쪽으로 이동"}
              className="text-muted-foreground hover:text-foreground"
              onClick={onToggleDockSide}
            >
              {dockSide === "right" ? (
                <PanelLeft className="size-3.5" />
              ) : (
                <PanelRight className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </header>

      {/* 대화 메시지 목록 영역 (MessageScroller + Message + Bubble + Trace + Confirmation Item) */}
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="p-4">
            <MessageScrollerContent className="gap-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const isStepsExpanded = Boolean(expandedStepMessageIds[msg.id]);

                return (
                  <MessageScrollerItem key={msg.id}>
                    <Message align={isUser ? "end" : "start"}>
                      <MessageContent className="gap-2">
                        {isUser && msg.attachments && msg.attachments.length > 0 && (
                          <AttachmentGroup className="justify-end">
                            {msg.attachments.map((att, attIdx) => (
                              <Attachment
                                key={`${msg.id}-att-${attIdx}`}
                                size="xs"
                                className="max-w-44"
                              >
                                <AttachmentMedia variant="image">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={att.dataUrl} alt={att.name ?? "첨부 이미지"} />
                                </AttachmentMedia>
                                <AttachmentContent>
                                  <AttachmentTitle>{att.name ?? "이미지 첨부"}</AttachmentTitle>
                                </AttachmentContent>
                              </Attachment>
                            ))}
                          </AttachmentGroup>
                        )}

                        <Bubble
                          variant={isUser ? "default" : "muted"}
                          align={isUser ? "end" : "start"}
                          className="max-w-[92%]"
                        >
                          <BubbleContent className="space-y-2 text-xs">
                            {!isUser && msg.steps && msg.steps.length > 0 && (
                              <Trace className="border-border/50 border-b pb-2">
                                <TraceCollapsible
                                  open={isStepsExpanded}
                                  onOpenChange={() => toggleStepsExpanded(msg.id)}
                                >
                                  <TraceCollapsibleTrigger className="text-[11px]">
                                    <span>수행 과정 ({msg.steps.length}단계)</span>
                                  </TraceCollapsibleTrigger>
                                  <TraceCollapsibleContent className="text-[11px]">
                                    <div className="space-y-1">
                                      {msg.steps.map((step, index) => (
                                        <TraceLine
                                          key={`${msg.id}-step-${index}`}
                                          className="text-[11px]"
                                        >
                                          <TraceIcon>
                                            <CheckCircle2 className="text-primary/70 size-3" />
                                          </TraceIcon>
                                          <TraceTitle>{step}</TraceTitle>
                                        </TraceLine>
                                      ))}
                                    </div>
                                  </TraceCollapsibleContent>
                                </TraceCollapsible>
                              </Trace>
                            )}

                            <MarkdownContent content={msg.content} variant="compact" />
                          </BubbleContent>
                        </Bubble>

                        {/* 고위험 액션 사전 실행 확인 (HITL Confirmation Item) */}
                        {!isUser &&
                          msg.pendingConfirmations &&
                          msg.pendingConfirmations.length > 0 && (
                            <div className="w-full max-w-[92%] space-y-2">
                              {msg.pendingConfirmations.map((conf) => (
                                <Item
                                  key={conf.confirmationId}
                                  variant="outline"
                                  size="sm"
                                  className="bg-background/95 shadow-xs"
                                >
                                  <ItemMedia variant="icon">
                                    <ShieldAlertIcon className="text-amber-600 dark:text-amber-400" />
                                  </ItemMedia>
                                  <ItemContent>
                                    <ItemTitle className="text-xs font-semibold">
                                      {conf.title}
                                    </ItemTitle>
                                    <ItemDescription className="text-[11px]">
                                      {conf.errorMessage || conf.description}
                                    </ItemDescription>
                                  </ItemContent>
                                  <ItemActions className="basis-full justify-end pt-1">
                                    {conf.status === "pending" && (
                                      <>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="xs"
                                          disabled={isBusy}
                                          onClick={() =>
                                            handleRejectConfirmation(msg.id, conf.confirmationId)
                                          }
                                        >
                                          취소
                                        </Button>
                                        <Button
                                          type="button"
                                          size="xs"
                                          disabled={isBusy}
                                          onClick={() =>
                                            void handleApproveConfirmation(msg.id, conf)
                                          }
                                        >
                                          승인
                                        </Button>
                                      </>
                                    )}
                                    {conf.status === "executing" && (
                                      <Badge variant="outline" className="gap-1 text-[11px]">
                                        <LoaderCircleIcon className="size-3 animate-spin" />
                                        실행 중
                                      </Badge>
                                    )}
                                    {conf.status === "approved" && (
                                      <Badge variant="default" className="gap-1 text-[11px]">
                                        <CheckCircle2 className="size-3" />
                                        승인 완료
                                      </Badge>
                                    )}
                                    {conf.status === "rejected" && (
                                      <Badge variant="secondary" className="gap-1 text-[11px]">
                                        <XCircleIcon className="size-3" />
                                        취소됨
                                      </Badge>
                                    )}
                                    {conf.status === "error" && (
                                      <Badge variant="destructive" className="text-[11px]">
                                        실행 오류
                                      </Badge>
                                    )}
                                  </ItemActions>
                                </Item>
                              ))}
                            </div>
                          )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}

              {isBusy && (
                <MessageScrollerItem scrollAnchor>
                  <Message align="start">
                    <MessageContent>
                      <Bubble variant="muted" align="start" className="max-w-[92%]">
                        <BubbleContent className="space-y-2 text-xs">
                          {progressSteps.length > 0 && (
                            <Trace className="border-border/40 border-b pb-2">
                              {progressSteps.map((step, index) => (
                                <TraceLine key={`active-step-${index}`} className="text-[11px]">
                                  <TraceIcon>
                                    <CheckCircle2 className="text-primary/70 size-3" />
                                  </TraceIcon>
                                  <TraceTitle>{step}</TraceTitle>
                                </TraceLine>
                              ))}
                            </Trace>
                          )}
                          <Trace>
                            <TraceLine status="running" className="text-[11px]">
                              <TraceIcon>
                                <LoaderCircleIcon className="size-3 animate-spin" />
                              </TraceIcon>
                              <TraceTitle>{progressMessage || "생각 중..."}</TraceTitle>
                            </TraceLine>
                          </Trace>
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}

              <div ref={messagesEndRef} />
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* 하단 Prompt Input 입력 폼 영역 (멀티라인 + 이미지 첨부 미리보기 + 전송) */}
      <footer className="border-border/70 bg-muted/20 shrink-0 border-t p-3 backdrop-blur-sm">
        <form onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                void handleAddAttachmentFiles(e.target.files);
              }
              e.target.value = "";
            }}
          />

          <InputGroup className="bg-background border-primary/25 focus-within:border-primary/60 focus-within:ring-primary/20 shadow-xs transition-shadow focus-within:ring-2">
            {attachments.length > 0 && (
              <InputGroupAddon align="block-start" className="border-b pb-2">
                <AttachmentGroup className="w-full gap-2 py-0">
                  {attachments.map((att, idx) => (
                    <Attachment key={`pending-att-${idx}`} size="xs" className="max-w-44">
                      <AttachmentMedia variant="image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={att.dataUrl} alt={att.name ?? "첨부 이미지"} />
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>{att.name ?? `이미지 ${idx + 1}`}</AttachmentTitle>
                      </AttachmentContent>
                      <AttachmentActions>
                        <AttachmentAction
                          aria-label="첨부 이미지 삭제"
                          onClick={() => handleRemoveAttachment(idx)}
                        >
                          <XIcon className="size-3" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </AttachmentGroup>
              </InputGroupAddon>
            )}

            <InputGroupTextarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={config.inputPlaceholder}
              disabled={isBusy}
              rows={2}
              className="min-h-14 text-xs"
            />

            <InputGroupAddon align="block-end" className="justify-between border-t pt-1.5">
              <InputGroupButton
                type="button"
                variant="ghost"
                size="xs"
                disabled={isBusy || attachments.length >= 3}
                aria-label="이미지 첨부"
                title="영수증·명세서 등 이미지 첨부 (최대 3장, Ctrl/Cmd+V 붙여넣기 지원)"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlusIcon className="size-3.5" />
                <span className="text-[11px]">이미지 첨부</span>
              </InputGroupButton>

              <InputGroupButton
                type="submit"
                variant="default"
                size="xs"
                disabled={!canSubmit}
                aria-label="메시지 전송"
              >
                <ArrowUpIcon className="size-3.5" />
                <span className="text-[11px]">전송</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </footer>
    </aside>
  );
}
