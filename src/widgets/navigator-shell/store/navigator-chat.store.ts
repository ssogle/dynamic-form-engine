import { create } from "zustand";
import type { NavigatorAction, NavigatorMode } from "@/features/execute-navigator-action";

export interface NavigatorChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  action?: NavigatorAction | undefined;
  createdAt: string;
}

export const INITIAL_WELCOME_MESSAGES: Record<NavigatorMode, string> = {
  builder:
    "안녕하세요! AI Navigator입니다. 마우스 클릭 없이 자연어로 원하시는 폼 생성, 필드 수정, 화면 이동을 명령해 보세요.",
  consumer:
    "안녕하세요! Consumer AI Navigator입니다. 참여하고자 하는 설문이나 작성하고 싶은 신청서에 대해 말씀해 주시면, 적합한 폼을 찾아드리고 작성을 도와드립니다.",
};

export interface NavigatorChatState {
  currentMode: NavigatorMode;
  messages: NavigatorChatMessage[];
  isGenerating: boolean;
  selectedFieldId: string | null;

  setMode: (mode: NavigatorMode) => void;
  addMessage: (message: Omit<NavigatorChatMessage, "id" | "createdAt">) => void;
  setIsGenerating: (isGenerating: boolean) => void;
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
      createdAt: new Date().toISOString(),
    },
  ],
  isGenerating: false,
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
          createdAt: new Date().toISOString(),
        },
      ],
      selectedFieldId: null,
      isGenerating: false,
    });
  },

  addMessage: (message) => {
    const newMessage: NavigatorChatMessage = {
      ...message,
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setSelectedFieldId: (selectedFieldId) => set({ selectedFieldId }),

  clearMessages: () => {
    const mode = get().currentMode;
    set({
      messages: [
        {
          id: `msg_welcome_${mode}`,
          role: "assistant",
          content: INITIAL_WELCOME_MESSAGES[mode],
          createdAt: new Date().toISOString(),
        },
      ],
      selectedFieldId: null,
      isGenerating: false,
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
          createdAt: new Date().toISOString(),
        },
      ],
      isGenerating: false,
      selectedFieldId: null,
    });
  },
}));
