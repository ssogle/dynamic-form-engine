import { create } from "zustand";
import { nowUtcIso } from "@/shared/lib/date";
import type {
  NavigatorAction,
  NavigatorAttachmentDto,
  NavigatorMode,
  PendingNavigatorConfirmation,
} from "@/features/execute-navigator-action";

export type NavigatorConfirmationStatus =
  "pending" | "executing" | "approved" | "rejected" | "error";

export interface NavigatorChatConfirmationItem extends PendingNavigatorConfirmation {
  status: NavigatorConfirmationStatus;
  errorMessage?: string | undefined;
}

export interface NavigatorChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** 사용자가 메시지와 함께 첨부한 멀티모달 이미지 목록 */
  attachments?: NavigatorAttachmentDto[] | undefined;
  /** AI 응답 생성 중 스트림으로부터 수신·누적된 수행 단계 목록 */
  steps?: string[] | undefined;
  /** 사용자 사전 승인이 필요한 고위험 액션 확인 카드 목록 */
  pendingConfirmations?: NavigatorChatConfirmationItem[] | undefined;
  action?: NavigatorAction | undefined;
  createdAt: string;
}

export const INITIAL_WELCOME_MESSAGES: Record<NavigatorMode, string> = {
  builder:
    "안녕하세요! Builder AI Navigator입니다. 자연어로 데이터 도메인 폼 생성, 필드 설계, 관계 연결 및 화면 이동을 명령해 보세요.",
  consumer:
    "안녕하세요! Consumer AI Navigator입니다. 등록된 데이터를 조회·검색하거나 새로운 데이터를 작성(이미지 첨부 포함)해 보세요.",
  analyst:
    "안녕하세요! Analyst AI Navigator입니다. 등록된 데이터를 비교·집계하여 표, 차트, 요약 문단이 담긴 분석 뷰 문서를 만들고 발행할 수 있습니다.",
};

export interface NavigatorChatState {
  currentMode: NavigatorMode;
  messages: NavigatorChatMessage[];
  isGenerating: boolean;
  progressMessage: string | null;
  /** 현재 응답 생성 중 수신된 실제 수행 단계 누적 목록 (heartbeat 제외) */
  progressSteps: string[];
  selectedFieldId: string | null;

  setMode: (mode: NavigatorMode) => void;
  addMessage: (message: Omit<NavigatorChatMessage, "id" | "createdAt">) => string;
  updateConfirmationStatus: (
    messageId: string,
    confirmationId: string,
    status: NavigatorConfirmationStatus,
    errorMessage?: string
  ) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setProgressMessage: (progressMessage: string | null) => void;
  /** 진행 단계 목록에 새 단계를 추가합니다 (빈 문자열 및 직전과 동일한 연속 중복은 무시). */
  appendProgressStep: (step: string) => void;
  setSelectedFieldId: (fieldId: string | null) => void;
  clearMessages: () => void;
  reset: () => void;
}

export const useNavigatorChatStore = create<NavigatorChatState>()((set, get) => ({
  currentMode: "builder",
  messages: [
    {
      id: "msg_welcome_builder",
      role: "assistant",
      content: INITIAL_WELCOME_MESSAGES.builder,
      createdAt: nowUtcIso(),
    },
  ],
  isGenerating: false,
  progressMessage: null,
  progressSteps: [],
  selectedFieldId: null,

  setMode: (mode) => {
    const current = get().currentMode;
    if (current === mode) return;

    set({
      currentMode: mode,
      messages: [
        {
          id: `msg_welcome_${mode}`,
          role: "assistant",
          content: INITIAL_WELCOME_MESSAGES[mode],
          createdAt: nowUtcIso(),
        },
      ],
      selectedFieldId: null,
      isGenerating: false,
      progressMessage: null,
      progressSteps: [],
    });
  },

  addMessage: (message) => {
    const newMessage: NavigatorChatMessage = {
      ...message,
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: nowUtcIso(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    return newMessage.id;
  },

  updateConfirmationStatus: (messageId, confirmationId, status, errorMessage) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.pendingConfirmations) {
          return msg;
        }
        return {
          ...msg,
          pendingConfirmations: msg.pendingConfirmations.map((item) =>
            item.confirmationId === confirmationId
              ? { ...item, status, ...(errorMessage !== undefined ? { errorMessage } : {}) }
              : item
          ),
        };
      }),
    })),

  setIsGenerating: (isGenerating) =>
    set((state) => ({
      isGenerating,
      progressMessage: isGenerating ? state.progressMessage : null,
      progressSteps: isGenerating ? state.progressSteps : [],
    })),

  setProgressMessage: (progressMessage) => set({ progressMessage }),

  appendProgressStep: (step) =>
    set((state) => {
      const trimmed = step.trim();
      if (!trimmed) return state;

      const lastStep = state.progressSteps[state.progressSteps.length - 1];
      if (lastStep === trimmed) return state;

      return {
        progressSteps: [...state.progressSteps, trimmed],
      };
    }),

  setSelectedFieldId: (selectedFieldId) => set({ selectedFieldId }),

  clearMessages: () => {
    const mode = get().currentMode;
    set({
      messages: [
        {
          id: `msg_welcome_${mode}`,
          role: "assistant",
          content: INITIAL_WELCOME_MESSAGES[mode],
          createdAt: nowUtcIso(),
        },
      ],
      selectedFieldId: null,
      isGenerating: false,
      progressMessage: null,
      progressSteps: [],
    });
  },

  reset: () => {
    const mode = get().currentMode;
    set({
      messages: [
        {
          id: `msg_welcome_${mode}`,
          role: "assistant",
          content: INITIAL_WELCOME_MESSAGES[mode],
          createdAt: nowUtcIso(),
        },
      ],
      isGenerating: false,
      progressMessage: null,
      progressSteps: [],
      selectedFieldId: null,
    });
  },
}));
