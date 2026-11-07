import { create } from "zustand";
import type { NavigatorAction } from "@/features/execute-navigator-action";

/**
 * 네비게이터 대화 메시지 모델
 */
export interface NavigatorChatMessage {
  /**
   * 메시지 고유 식별자 (예: msg_123456789)
   */
  id: string;

  /**
   * 발화자 구분 (user: 사용자, assistant: AI Navigator, system: 시스템 알림)
   */
  role: "user" | "assistant" | "system";

  /**
   * 발화 텍스트 내용
   */
  content: string;

  /**
   * 해당 발화에서 수행된 AI 액션 메타데이터 (존재하는 경우)
   */
  action?: NavigatorAction | undefined;

  /**
   * 메시지 생성 일시 (ISO 문자열)
   */
  createdAt: string;
}

/**
 * 네비게이터 대화 스토어 상태 및 액션 인터페이스
 */
export interface NavigatorChatState {
  /**
   * 대화 내역 목록
   */
  messages: NavigatorChatMessage[];

  /**
   * LLM 추론 및 백엔드 실행 중 여부
   */
  isGenerating: boolean;

  /**
   * 현재 포커스/선택된 폼 필드 ID (Click-to-Mention 컨텍스트)
   */
  selectedFieldId: string | null;

  /**
   * 신규 메시지 추가 액션
   */
  addMessage: (message: Omit<NavigatorChatMessage, "id" | "createdAt">) => void;

  /**
   * 생성 진행 상태 플래그 갱신 액션
   */
  setIsGenerating: (isGenerating: boolean) => void;

  /**
   * 포커스 대상 필드 ID 지정 또는 해제(null)
   */
  setSelectedFieldId: (fieldId: string | null) => void;

  /**
   * 대화 내역 초기화 (기본 웰컴 메시지만 유지)
   */
  clearMessages: () => void;

  /**
   * 스토어 전체 상태 초기화
   */
  reset: () => void;
}

/**
 * 초기 기본 웰컴 메시지 상수
 */
const INITIAL_WELCOME_MESSAGE: NavigatorChatMessage = {
  id: "msg_welcome",
  role: "assistant",
  content:
    "안녕하세요! AI Navigator입니다. 마우스 클릭 없이 자연어로 원하시는 폼 생성, 필드 수정, 화면 이동을 명령해 보세요.",
  createdAt: new Date().toISOString(),
};

/**
 * AI Navigator 대화 및 인터랙션 UI 상태 관리 Zustand 스토어
 *
 * 서버 상태(폼 데이터)는 TanStack Query 캐시가 담당하며,
 * 본 스토어는 브라우저 상주 패널의 일시적 대화 내역과 UI 포커스 상태만 책임집니다.
 */
export const useNavigatorChatStore = create<NavigatorChatState>()((set) => ({
  messages: [INITIAL_WELCOME_MESSAGE],
  isGenerating: false,
  selectedFieldId: null,

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

  clearMessages: () =>
    set({
      messages: [
        {
          ...INITIAL_WELCOME_MESSAGE,
          createdAt: new Date().toISOString(),
        },
      ],
      selectedFieldId: null,
      isGenerating: false,
    }),

  reset: () =>
    set({
      messages: [
        {
          ...INITIAL_WELCOME_MESSAGE,
          createdAt: new Date().toISOString(),
        },
      ],
      isGenerating: false,
      selectedFieldId: null,
    }),
}));
