import { create } from "zustand";
import { nowUtcIso } from "@/shared/lib/date";
import type { NavigatorAction, NavigatorMode } from "@/features/execute-navigator-action";

export interface NavigatorChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** AI 응답 생성 중 스트림으로부터 수신·누적된 수행 단계 목록 */
  steps?: string[] | undefined;
  action?: NavigatorAction | undefined;
  createdAt: string;
}

export const INITIAL_WELCOME_MESSAGES: Record<NavigatorMode, string> = {
  builder:
    "안녕하세요! AI Navigator입니다. 마우스 클릭 없이 자연어로 원하시는 폼 생성, 필드 수정, 화면 이동을 명령해 보세요.",
  consumer:
    "안녕하세요! Consumer AI Navigator입니다. 참여하고자 하는 설문이나 작성하고 싶은 신청서에 대해 말씀해 주시면, 적합한 폼을 찾아드리고 작성을 도와드립니다.",
  analyst:
    "안녕하세요! Analyst AI Navigator입니다. 등록된 폼의 응답 데이터를 비교·집계하여 표, 차트, 요약 문단이 담긴 분석 뷰 문서를 만들고 발행할 수 있습니다.",
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
  addMessage: (message: Omit<NavigatorChatMessage, "id" | "createdAt">) => void;
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
  },

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
