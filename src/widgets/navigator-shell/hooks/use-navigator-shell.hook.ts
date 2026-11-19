"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useNavigatorMutation,
  type NavigatorAction,
  type NavigatorAttachmentDto,
  type NavigatorClientContext,
  type NavigatorMode,
  type NavigatorProgressMeta,
} from "@/features/execute-navigator-action";
import {
  analysisViewKeys,
  extractAnalysisBlocks,
  useAnalysisViewRefreshStore,
  type AnalysisView,
} from "@/entities/analysis-view";
import {
  formKeys,
  type Form,
  extractActiveFields,
  extractPrimaryFieldId,
  extractPrimaryFieldValue,
} from "@/entities/form";
import {
  formSubmissionsKeys,
  useConsumerFormDraftStore,
  type FormSubmission,
} from "@/entities/form-submission";
import { toUtcIso } from "@/shared/lib/date";
import {
  useNavigatorChatStore,
  type NavigatorChatConfirmationItem,
  type NavigatorChatMessage,
} from "../store/navigator-chat.store";
import { MAX_IMAGE_ATTACHMENTS, resizeImageFileToAttachment } from "../lib/image-attachment";
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
   * 다중 스텝 실행 중 서버 스트림으로부터 수신한 현재 진행 단계 메시지
   */
  progressMessage: string | null;
  /**
   * 현재 응답 생성 중 누적된 실제 수행 단계 목록 (heartbeat 제외)
   */
  progressSteps: string[];
  /**
   * 메시지별 수행 과정 패널 펼침 상태 맵 (`{ [messageId]: boolean }`)
   */
  expandedStepMessageIds: Record<string, boolean>;
  /**
   * 특정 메시지의 수행 과정 펼침/접힘 상태를 토글하는 핸들러
   */
  toggleStepsExpanded: (messageId: string) => void;
  /**
   * 입력창 텍스트 상태
   */
  inputValue: string;
  /**
   * 입력창 텍스트 변경 디스패처
   */
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  /**
   * 전송 대기 중인 멀티모달 이미지 첨부 목록
   */
  attachments: NavigatorAttachmentDto[];
  /**
   * 이미지 파일 선택/붙여넣기 첨부 핸들러
   */
  handleAddAttachmentFiles: (files: FileList | File[]) => Promise<void>;
  /**
   * 대기 중인 첨부 이미지 제거 핸들러
   */
  handleRemoveAttachment: (index: number) => void;
  /**
   * 입력창 클립보드 이미지 붙여넣기 핸들러
   */
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  /**
   * 고위험 액션 인라인 승인 핸들러
   */
  handleApproveConfirmation: (
    messageId: string,
    confirmation: NavigatorChatConfirmationItem
  ) => Promise<void>;
  /**
   * 고위험 액션 인라인 취소 핸들러
   */
  handleRejectConfirmation: (messageId: string, confirmationId: string) => void;
  /**
   * 최하단 자동 스크롤 앵커 ref
   */
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  /**
   * 입력창 포커스 제어 ref
   */
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /**
   * 숨김 이미지 파일 입력 ref
   */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
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
  const progressMessage = useNavigatorChatStore((state) => state.progressMessage);
  const progressSteps = useNavigatorChatStore((state) => state.progressSteps);
  const addMessage = useNavigatorChatStore((state) => state.addMessage);
  const updateConfirmationStatus = useNavigatorChatStore((state) => state.updateConfirmationStatus);
  const setIsGenerating = useNavigatorChatStore((state) => state.setIsGenerating);
  const setProgressMessage = useNavigatorChatStore((state) => state.setProgressMessage);
  const appendProgressStep = useNavigatorChatStore((state) => state.appendProgressStep);

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
  const [attachments, setAttachments] = React.useState<NavigatorAttachmentDto[]>([]);
  const [expandedStepMessageIds, setExpandedStepMessageIds] = React.useState<
    Record<string, boolean>
  >({});

  const toggleStepsExpanded = React.useCallback((messageId: string) => {
    setExpandedStepMessageIds((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  }, []);

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  /**
   * 스트림 진행 이벤트 핸들러
   * - `progressMessage`는 heartbeat를 포함해 항상 최신 상태로 갱신하여 로딩 인디케이터에 표시합니다.
   * - `progressSteps`에는 heartbeat를 제외한 실제 수행 단계만 누적해 채팅 기록으로 남깁니다.
   */
  const handleProgress = React.useCallback(
    (statusText: string, meta?: NavigatorProgressMeta) => {
      setProgressMessage(statusText);
      if (!meta?.isHeartbeat) {
        appendProgressStep(statusText);
      }
    },
    [setProgressMessage, appendProgressStep]
  );

  // 4. AI 통신 훅 (스트리밍 진행 메시지 수신 연동) 및 분석 뷰 AI 재집계 요청 구독
  const { mutateAsync: executeAction, isPending } = useNavigatorMutation({
    onProgress: handleProgress,
  });
  const isBusy = isGenerating || isPending;
  const pendingRefresh = useAnalysisViewRefreshStore((state) => state.pendingRefresh);
  const clearPendingRefresh = useAnalysisViewRefreshStore((state) => state.clearPendingRefresh);
  const setIsRefreshingByAi = useAnalysisViewRefreshStore((state) => state.setIsRefreshingByAi);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, isBusy, progressSteps.length]);

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
        case "NAVIGATE": {
          const currentLocationPath = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
          if (action.targetPath && action.targetPath !== currentLocationPath) {
            router.push(action.targetPath);
          }
          break;
        }

        case "CREATE_FORM":
          if (action.formId) {
            router.push(`/builder/forms/${action.formId}`);
          }
          toast.success(action.message ?? "새로운 폼을 생성했습니다.");
          break;

        case "UPDATE_SCHEMA":
          if (action.formId) {
            queryClient.invalidateQueries({ queryKey: formKeys.detail(action.formId) });
          }
          toast.success(action.message ?? "폼 구조를 업데이트했습니다.");
          break;

        case "DELETE_FORMS":
          queryClient.invalidateQueries({ queryKey: formKeys.all });
          router.push("/builder/forms");
          toast.success(action.message ?? "선택한 폼을 삭제했습니다.");
          break;

        case "PUBLISH_FORM":
          queryClient.invalidateQueries({ queryKey: formKeys.all });
          toast.success(
            action.message ??
              (action.isPublished ? "폼을 공식 발행했습니다." : "폼 발행을 취소했습니다.")
          );
          break;

        case "FILL_FIELDS": {
          const formIdMatch = pathname.match(/^\/consumer\/forms\/([^/]+)/);
          const targetFormId = action.formId || formIdMatch?.[1] || currentDraftFormId || "";
          if (targetFormId && action.fields) {
            applyDraftFields(targetFormId, action.fields);
            toast.success(action.message ?? "입력 필드에 값을 채웠습니다.");
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
          toast.success(action.message ?? "선택한 제출 응답을 삭제했습니다.");
          break;

        case "CREATE_ANALYSIS_VIEW":
          queryClient.invalidateQueries({ queryKey: analysisViewKeys.all });
          if (action.viewId) {
            router.push(`/analyst/views/${action.viewId}`);
          }
          toast.success(action.message ?? "새로운 분석 뷰를 생성했습니다.");
          break;

        case "UPDATE_ANALYSIS_VIEW":
          queryClient.invalidateQueries({ queryKey: analysisViewKeys.all });
          toast.success(action.message ?? "분석 뷰를 업데이트했습니다.");
          break;

        case "PUBLISH_ANALYSIS_VIEW":
          queryClient.invalidateQueries({ queryKey: analysisViewKeys.all });
          toast.success(
            action.message ??
              (action.isPublished ? "분석 뷰를 공식 발행했습니다." : "분석 뷰 발행을 취소했습니다.")
          );
          break;

        case "DELETE_ANALYSIS_VIEWS":
          queryClient.invalidateQueries({ queryKey: analysisViewKeys.all });
          router.push("/analyst/views");
          toast.success(action.message ?? "선택한 분석 뷰를 삭제했습니다.");
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
            version: cachedForm.version,
            title: cachedForm.title,
            description: cachedForm.description ?? undefined,
            isPublished: Boolean(cachedForm.publishedAt),
            primaryFieldId: extractPrimaryFieldId(cachedForm),
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
          createdAt: toUtcIso(f.createdAt) ?? undefined,
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
            multiple: f.multiple,
            description: f.description,
            options: f.options ?? undefined,
            relationConfig: f.relationConfig,
          }));
        }
      }

      // 1-1. 응답 상세/수정 화면에서는 캐시된 기존 submission.data를 currentDraftValues의 베이스로 병합 전달합니다.
      const submissionMatch = pathname.match(
        /^\/consumer\/forms\/[^/]+\/submissions\/([^/]+)(?:\/edit)?$/
      );
      const cachedSubmission =
        submissionMatch && submissionMatch[1]
          ? queryClient.getQueryData<FormSubmission>(formSubmissionsKeys.detail(submissionMatch[1]))
          : undefined;

      context.currentDraftValues = cachedSubmission?.data
        ? {
            ...cachedSubmission.data,
            ...(currentDraftValues ?? {}),
          }
        : currentDraftValues;

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

      if (cachedSubmissions && Array.isArray(cachedSubmissions) && cachedSubmissions.length > 0) {
        const cachedConsumerForm = activeFormId
          ? queryClient.getQueryData<Form>(formKeys.detail(activeFormId))
          : undefined;

        context.visibleSubmissions = cachedSubmissions.slice(0, 10).map((s, idx) => {
          const dataObj = (s.data as Record<string, unknown>) ?? {};
          const summaryKeys = Object.keys(dataObj);
          const firstKey = summaryKeys[0];
          const primaryVal = cachedConsumerForm
            ? extractPrimaryFieldValue(cachedConsumerForm, s)
            : firstKey
              ? String(dataObj[firstKey] ?? "")
              : "";
          return {
            id: s.id,
            title: primaryVal ? `응답 #${idx + 1} (${primaryVal})` : `응답 #${idx + 1}`,
            createdAt: toUtcIso(s.createdAt) ?? undefined,
            summary: summaryKeys
              .slice(0, 3)
              .map((k) => `${k}: ${String(dataObj[k] ?? "")}`)
              .join(", "),
          };
        });
      }
    } else if (mode === "analyst") {
      // 1. 개별 분석 뷰 문서 상세 화면일 때
      const match = pathname.match(/\/analyst\/views\/([^/]+)/);
      if (match && match[1]) {
        const viewId = match[1];
        const cachedView = queryClient.getQueryData<AnalysisView>(
          analysisViewKeys.detail(viewId, false)
        );
        if (cachedView) {
          context.currentAnalysisView = {
            id: cachedView.id,
            version: cachedView.version,
            title: cachedView.title,
            description: cachedView.description ?? undefined,
            isPublished: Boolean(cachedView.publishedAt),
            blocks: extractAnalysisBlocks(cachedView),
          };
        }
      }

      // 2. 분석 뷰 목록 캐시가 존재할 때 (상위 10개 요약 주입)
      const cachedViews = queryClient.getQueryData<AnalysisView[]>(analysisViewKeys.lists());
      if (cachedViews && cachedViews.length > 0) {
        context.visibleAnalysisViews = cachedViews.slice(0, 10).map((v) => ({
          id: v.id,
          title: v.title,
          summary: v.description ?? undefined,
          createdAt: toUtcIso(v.createdAt) ?? undefined,
        }));
      }
    }

    return context;
  }, [mode, pathname, queryClient, currentDraftFormId, currentDraftValues]);

  /**
   * 이미지 파일 선택/드롭/붙여넣기 첨부 처리 핸들러
   */
  const handleAddAttachmentFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const remainingSlots = MAX_IMAGE_ATTACHMENTS - attachments.length;
      if (remainingSlots <= 0) {
        toast.error(`이미지는 최대 ${MAX_IMAGE_ATTACHMENTS}장까지 첨부할 수 있습니다.`);
        return;
      }

      const targets = fileArray.slice(0, remainingSlots);
      if (fileArray.length > remainingSlots) {
        toast.warning(`한 번에 최대 ${MAX_IMAGE_ATTACHMENTS}장까지 첨부되어 초과분은 제외됩니다.`);
      }

      const converted: NavigatorAttachmentDto[] = [];
      for (const file of targets) {
        try {
          const dto = await resizeImageFileToAttachment(file);
          converted.push(dto);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "이미지를 첨부할 수 없습니다.");
        }
      }

      if (converted.length > 0) {
        setAttachments((prev) => [...prev, ...converted].slice(0, MAX_IMAGE_ATTACHMENTS));
      }
    },
    [attachments.length]
  );

  const handleRemoveAttachment = React.useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const imageFiles: File[] = [];
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        void handleAddAttachmentFiles(imageFiles);
      }
    },
    [handleAddAttachmentFiles]
  );

  /**
   * 사용자 명령 실행 핸들러
   */
  const handleExecutePrompt = React.useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      const pendingAttachments = [...attachments];
      if ((!trimmed && pendingAttachments.length === 0) || isBusy) return;

      const resolvedPrompt =
        trimmed || "첨부한 이미지를 분석하여 현재 폼 또는 대상 폼에 적절히 입력해 주세요.";

      addMessage({
        role: "user",
        content: resolvedPrompt,
        ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
      });
      setInputValue("");
      setAttachments([]);
      setProgressMessage("요청을 준비하고 있습니다...");
      setIsGenerating(true);

      try {
        // 과도한 과거 대화 누적으로 인한 LLM 토큰·레이턴시 급증을 방지하기 위해 최근 6개 메시지만 전달합니다.
        const historyMessages = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const currentContext = resolveCurrentContext();

        const response = await executeAction({
          mode,
          prompt: resolvedPrompt,
          messages: historyMessages,
          ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
          currentContext,
        });

        // 비동기 스트리밍 중 누적된 최신 단계 목록을 스토어에서 직접 읽어 Stale Closure를 방지합니다.
        const recordedSteps = useNavigatorChatStore.getState().progressSteps;
        const replyText =
          response.reply || response.message || response.action?.message || "요청을 처리했습니다.";
        const confirmationItems: NavigatorChatConfirmationItem[] | undefined =
          response.pendingConfirmations && response.pendingConfirmations.length > 0
            ? response.pendingConfirmations.map((c) => ({
                ...c,
                status: "pending",
              }))
            : undefined;

        addMessage({
          role: "assistant",
          content: replyText,
          steps: recordedSteps.length > 0 ? [...recordedSteps] : undefined,
          ...(confirmationItems ? { pendingConfirmations: confirmationItems } : {}),
          action: response.action ?? undefined,
        });

        if (response.updatedAnalysisView) {
          queryClient.setQueryData?.(
            analysisViewKeys.detail(response.updatedAnalysisView.id, false),
            response.updatedAnalysisView
          );
        }

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
        const recordedSteps = useNavigatorChatStore.getState().progressSteps;
        const errMsg =
          "죄송합니다. 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        addMessage({
          role: "assistant",
          content: errMsg,
          steps: recordedSteps.length > 0 ? [...recordedSteps] : undefined,
        });
        toast.error("AI 요청 처리 중 오류가 발생했습니다.");
      } finally {
        setIsGenerating(false);
        setProgressMessage(null);
      }
    },
    [
      attachments,
      isBusy,
      addMessage,
      setIsGenerating,
      setProgressMessage,
      messages,
      resolveCurrentContext,
      executeAction,
      mode,
      queryClient,
      dispatchAction,
    ]
  );

  /**
   * 고위험 액션 인라인 확인 카드 [승인] 처리 핸들러
   */
  const handleApproveConfirmation = React.useCallback(
    async (messageId: string, confirmation: NavigatorChatConfirmationItem) => {
      if (isBusy || confirmation.status !== "pending") return;

      updateConfirmationStatus(messageId, confirmation.confirmationId, "executing");
      setProgressMessage("승인하신 작업을 실행하고 있습니다...");
      setIsGenerating(true);

      try {
        const currentContext = resolveCurrentContext();
        const response = await executeAction({
          mode,
          prompt: `[승인] ${confirmation.title}`,
          confirmedAction: {
            confirmationId: confirmation.confirmationId,
            toolName: confirmation.toolName,
            payload: confirmation.payload,
          },
          currentContext,
        });

        const actionsToExecute: NavigatorAction[] =
          response.actions && response.actions.length > 0
            ? response.actions
            : response.action
              ? [response.action]
              : [];

        if (actionsToExecute.length === 0) {
          const errorText = response.reply || "승인된 작업을 실행하지 못했습니다.";
          updateConfirmationStatus(messageId, confirmation.confirmationId, "error", errorText);
          toast.error(errorText);
          return;
        }

        updateConfirmationStatus(messageId, confirmation.confirmationId, "approved");

        if (response.updatedAnalysisView) {
          queryClient.setQueryData?.(
            analysisViewKeys.detail(response.updatedAnalysisView.id, false),
            response.updatedAnalysisView
          );
        }

        for (const act of actionsToExecute) {
          dispatchAction(act);
        }
      } catch (err) {
        const errorText =
          err instanceof Error ? err.message : "승인된 작업 실행 중 오류가 발생했습니다.";
        updateConfirmationStatus(messageId, confirmation.confirmationId, "error", errorText);
        toast.error(errorText);
      } finally {
        setIsGenerating(false);
        setProgressMessage(null);
      }
    },
    [
      isBusy,
      updateConfirmationStatus,
      setProgressMessage,
      setIsGenerating,
      resolveCurrentContext,
      executeAction,
      mode,
      queryClient,
      dispatchAction,
    ]
  );

  /**
   * 고위험 액션 인라인 확인 카드 [취소] 처리 핸들러
   */
  const handleRejectConfirmation = React.useCallback(
    (messageId: string, confirmationId: string) => {
      updateConfirmationStatus(messageId, confirmationId, "rejected");
      toast.info("요청하신 작업 실행을 취소했습니다.");
    },
    [updateConfirmationStatus]
  );

  const handleSubmit = React.useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      handleExecutePrompt(inputValue);
    },
    [handleExecutePrompt, inputValue]
  );

  React.useEffect(() => {
    setIsRefreshingByAi(mode === "analyst" && isBusy);
  }, [mode, isBusy, setIsRefreshingByAi]);

  React.useEffect(() => {
    if (mode !== "analyst" || !pendingRefresh || isBusy) {
      return;
    }
    if (!pathname.includes(pendingRefresh.viewId)) {
      return;
    }
    const promptToRun = pendingRefresh.prompt;
    clearPendingRefresh();
    queueMicrotask(() => {
      void handleExecutePrompt(promptToRun);
    });
  }, [mode, pendingRefresh, isBusy, pathname, clearPendingRefresh, handleExecutePrompt]);

  return {
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
    handleExecutePrompt,
    handleSubmit,
  };
}
