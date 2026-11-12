"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useNavigatorMutation,
  type NavigatorAction,
  type NavigatorClientContext,
  type NavigatorMode,
} from "@/features/execute-navigator-action";
import { formKeys, type Form, extractActiveFields } from "@/entities/form";
import {
  formSubmissionsKeys,
  useConsumerFormDraftStore,
  type FormSubmission,
} from "@/entities/form-submission";
import { useNavigatorChatStore, type NavigatorChatMessage } from "../store/navigator-chat.store";
import { NAVIGATOR_SHELL_CONFIGS, type NavigatorShellConfig } from "../lib/navigator-shell-config";

export interface UseNavigatorShellParams {
  /**
   * 쉘 동작 모드 ("builder" 또는 "consumer")
   */
  mode: NavigatorMode;
}

export interface UseNavigatorShellReturn {
  /**
   * 모드별 쉘 설정 객체
   */
  config: NavigatorShellConfig;
  /**
   * 현재 대화 메시지 목록
   */
  messages: NavigatorChatMessage[];
  /**
   * AI 생성 또는 백엔드 요청 진행 중 여부
   */
  isBusy: boolean;
  /**
   * 입력창 텍스트 상태
   */
  inputValue: string;
  /**
   * 입력창 텍스트 변경 디스패처
   */
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  /**
   * 최하단 자동 스크롤 앵커 ref
   */
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  /**
   * 입력창 포커스 제어 ref
   */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /**
   * 프롬프트 텍스트 직접 실행 핸들러
   */
  handleExecutePrompt: (promptText: string) => Promise<void>;
  /**
   * 폼 서밋 이벤트 기반 프롬프트 제출 핸들러
   */
  handleSubmit: (e: React.SyntheticEvent) => void;
}

/**
 * AI Navigator 상주 쉘 비즈니스 오케스트레이션 전용 커스텀 훅 (useNavigatorShell)
 *
 * 대화 스토어 모드 동기화, 초안 스토어 연동, AI 뮤테이션 실행,
 * 화면 맥락(Context) 조립, 액션 디스패치 및 자동 스크롤/포커스 관리를 캡슐화합니다.
 */
export function useNavigatorShell({ mode }: UseNavigatorShellParams): UseNavigatorShellReturn {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const config = NAVIGATOR_SHELL_CONFIGS[mode];

  // 1. 대화 스토어 구독 및 모드 동기화
  const currentMode = useNavigatorChatStore((state) => state.currentMode);
  const setMode = useNavigatorChatStore((state) => state.setMode);
  const messages = useNavigatorChatStore((state) => state.messages);
  const isGenerating = useNavigatorChatStore((state) => state.isGenerating);
  const addMessage = useNavigatorChatStore((state) => state.addMessage);
  const setIsGenerating = useNavigatorChatStore((state) => state.setIsGenerating);

  React.useEffect(() => {
    if (currentMode !== mode) {
      setMode(mode);
    }
  }, [mode, currentMode, setMode]);

  // 2. 컨슈머 전용 초안 스토어 훅 바인딩
  const applyDraftFields = useConsumerFormDraftStore((state) => state.applyDraftFields);
  const triggerSubmit = useConsumerFormDraftStore((state) => state.triggerSubmit);
  const currentDraftFormId = useConsumerFormDraftStore((state) => state.currentFormId);
  const currentDraftValues = useConsumerFormDraftStore((state) => state.draftValues);

  // 3. UI 로컬 상태
  const [inputValue, setInputValue] = React.useState("");

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // 4. AI 통신 훅
  const { mutateAsync: executeAction, isPending } = useNavigatorMutation();
  const isBusy = isGenerating || isPending;

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, isBusy]);

  // AI 응답 완료 및 disabled 해제 시 입력창으로 포커스 자동 복원
  React.useEffect(() => {
    if (!isBusy) {
      inputRef.current?.focus();
    }
  }, [isBusy]);

  /**
   * AI 응답 액션을 해석하여 브라우저 화면 조작 디스패치
   */
  const dispatchAction = React.useCallback(
    (action: NavigatorAction) => {
      switch (action.type) {
        case "NAVIGATE":
          if (action.targetPath && action.targetPath !== pathname) {
            router.push(action.targetPath);
          }
          break;

        case "CREATE_FORM":
          if (action.formId) {
            router.push(`/builder/forms/${action.formId}`);
          }
          break;

        case "DELETE_FORMS":
          queryClient.invalidateQueries({ queryKey: formKeys.all });
          router.push("/builder/forms");
          break;

        case "PUBLISH_FORM":
          queryClient.invalidateQueries({ queryKey: formKeys.all });
          break;

        case "FILL_FIELDS": {
          const formIdMatch = pathname.match(/^\/consumer\/forms\/([^/]+)/);
          const targetFormId = action.formId || formIdMatch?.[1] || currentDraftFormId || "";
          if (targetFormId && action.fields) {
            applyDraftFields(targetFormId, action.fields);
          }
          break;
        }

        case "SUBMIT_FORM": {
          const formIdMatch = pathname.match(/^\/consumer\/forms\/([^/]+)/);
          const targetFormId = action.formId || formIdMatch?.[1] || currentDraftFormId || "";
          if (targetFormId) {
            triggerSubmit(targetFormId);
          }
          break;
        }

        case "DELETE_SUBMISSIONS":
          queryClient.invalidateQueries({ queryKey: formSubmissionsKeys.all });
          break;

        default:
          break;
      }
    },
    [pathname, router, queryClient, currentDraftFormId, applyDraftFields, triggerSubmit]
  );

  /**
   * 현재 화면 맥락(Context)을 모드에 맞게 추출 (React Query 캐시 연동)
   */
  const resolveCurrentContext = React.useCallback((): NavigatorClientContext => {
    const context: NavigatorClientContext = {
      currentPath: pathname,
    };

    if (mode === "builder") {
      // 1. 개별 폼 상세 화면일 때
      const match = pathname.match(/\/builder\/forms\/([^/]+)/);
      if (match && match[1]) {
        const formId = match[1];
        const cachedForm = queryClient.getQueryData<Form>(formKeys.detail(formId));
        if (cachedForm) {
          const fields = extractActiveFields(cachedForm);
          context.currentForm = {
            id: cachedForm.id,
            title: cachedForm.title,
            description: cachedForm.description ?? undefined,
            isPublished: Boolean(cachedForm.publishedAt),
            fields,
          };
        }
      }

      // 2. 폼 목록 캐시가 존재할 때 (In-View 빠른 조회를 위해 상위 10개 주입)
      const cachedForms = queryClient.getQueryData<Form[]>(formKeys.lists());
      if (cachedForms && cachedForms.length > 0) {
        context.visibleForms = cachedForms.slice(0, 10).map((f) => ({
          id: f.id,
          title: f.title,
          summary: f.description ?? undefined,
          createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : undefined,
        }));
      }
    } else if (mode === "consumer") {
      // 1. 현재 열려있는 폼 파악
      const match = pathname.match(/^\/consumer\/forms\/([^/]+)/);
      const activeFormId = match ? match[1] : (currentDraftFormId ?? undefined);

      if (activeFormId) {
        context.currentFormId = activeFormId;
        const cachedForm = queryClient.getQueryData<Form>(formKeys.detail(activeFormId));
        if (cachedForm) {
          context.currentFormTitle = cachedForm.title;
          const activeFields = extractActiveFields(cachedForm);
          context.availableFields = activeFields.map((f) => ({
            id: f.id,
            label: f.label,
            type: f.type,
            required: f.required ?? false,
            description: f.description,
            options: f.options ?? undefined,
          }));
        }
      }
      context.currentDraftValues = currentDraftValues;

      // 2. 현재 화면의 기제출 응답 목록 캐시가 존재할 때 (단순 캐시 또는 무한 스크롤 캐시)
      let cachedSubmissions: FormSubmission[] | undefined;
      if (activeFormId) {
        cachedSubmissions = queryClient.getQueryData<FormSubmission[]>(
          formSubmissionsKeys.byForm(activeFormId)
        );
      }
      if (!cachedSubmissions || cachedSubmissions.length === 0) {
        const queries = queryClient.getQueriesData<unknown>({
          queryKey: formSubmissionsKeys.all,
        });
        for (const [, queryData] of queries) {
          if (Array.isArray(queryData) && queryData.length > 0) {
            cachedSubmissions = queryData as FormSubmission[];
            break;
          }
          if (
            queryData &&
            typeof queryData === "object" &&
            "pages" in queryData &&
            Array.isArray((queryData as { pages: unknown[] }).pages)
          ) {
            const pages = (queryData as { pages: { items?: FormSubmission[] }[] }).pages;
            const flattened = pages.flatMap((p) => p.items ?? []);
            if (flattened.length > 0) {
              cachedSubmissions = flattened;
              break;
            }
          }
        }
      }

      if (cachedSubmissions && cachedSubmissions.length > 0) {
        context.visibleSubmissions = cachedSubmissions.slice(0, 10).map((s, idx) => {
          const dataObj = (s.data as Record<string, unknown>) ?? {};
          const summaryKeys = Object.keys(dataObj);
          const firstKey = summaryKeys[0];
          const firstVal = firstKey ? String(dataObj[firstKey] ?? "") : "";
          return {
            id: s.id,
            title: firstVal ? `응답 #${idx + 1} (${firstVal})` : `응답 #${idx + 1}`,
            createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
            summary: summaryKeys
              .slice(0, 3)
              .map((k) => `${k}: ${String(dataObj[k] ?? "")}`)
              .join(", "),
          };
        });
      }
    }

    return context;
  }, [mode, pathname, queryClient, currentDraftFormId, currentDraftValues]);

  /**
   * 사용자 명령 실행 핸들러
   */
  const handleExecutePrompt = React.useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || isBusy) return;

      addMessage({
        role: "user",
        content: trimmed,
      });
      setInputValue("");
      setIsGenerating(true);

      try {
        const historyMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const currentContext = resolveCurrentContext();

        const response = await executeAction({
          mode,
          prompt: trimmed,
          messages: historyMessages,
          currentContext,
        });

        const replyText =
          response.reply || response.message || response.action?.message || "요청을 처리했습니다.";
        addMessage({
          role: "assistant",
          content: replyText,
          action: response.action ?? undefined,
        });

        // 복합 액션 및 단일 액션 추출
        const actionsToExecute: NavigatorAction[] =
          response.actions && response.actions.length > 0
            ? response.actions
            : response.action
              ? [response.action]
              : [];

        // 원샷 복합 명령 지원: 초안값 선주입(FILL_FIELDS)을 화면 이동(NAVIGATE)보다 먼저 실행
        const sortedActions = [...actionsToExecute].sort((a, b) => {
          if (a.type === "FILL_FIELDS" && b.type === "NAVIGATE") return -1;
          if (a.type === "NAVIGATE" && b.type === "FILL_FIELDS") return 1;
          return 0;
        });

        for (const act of sortedActions) {
          dispatchAction(act);
        }
      } catch (err) {
        console.error("AI Navigator 통신 오류:", err);
        addMessage({
          role: "assistant",
          content:
            "죄송합니다. 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [
      isBusy,
      addMessage,
      setIsGenerating,
      messages,
      resolveCurrentContext,
      executeAction,
      mode,
      dispatchAction,
    ]
  );

  const handleSubmit = React.useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      handleExecutePrompt(inputValue);
    },
    [handleExecutePrompt, inputValue]
  );

  return {
    config,
    messages,
    isBusy,
    inputValue,
    setInputValue,
    messagesEndRef,
    inputRef,
    handleExecutePrompt,
    handleSubmit,
  };
}
