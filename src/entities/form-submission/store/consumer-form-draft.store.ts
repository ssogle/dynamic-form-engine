import { create } from "zustand";

/**
 * 컨슈머 폼 실시간 임시 입력값 및 제출 상태 인터페이스
 */
export interface ConsumerFormDraftState {
  /**
   * 대상 폼 슬러그
   */
  currentSlug: string | null;

  /**
   * AI Navigator가 추출하여 자동 입력하도록 지시한 필드값 맵 (field.name -> value)
   */
  draftValues: Record<string, unknown>;

  /**
   * AI Navigator가 제출을 트리거했는지 여부 카운터 (증가 시 제출 효과 발동)
   */
  submitTriggerCount: number;

  /**
   * 대상 폼 설정 및 기존 임시값 초기화
   */
  setCurrentSlug: (slug: string) => void;

  /**
   * AI가 채워준 단일 또는 복수 필드값을 임시 저장소에 병합
   */
  applyDraftFields: (slug: string, fields: Record<string, unknown>) => void;

  /**
   * AI에 의한 폼 제출 신호 발생
   */
  triggerSubmit: (slug: string) => void;

  /**
   * 임시 데이터 초기화
   */
  resetDraft: () => void;
}

/**
 * AI Consumer Navigator와 우측 폼 입력 화면 간 실시간 양방향 데이터 바인딩을 위한 전역 Zustand 스토어
 *
 * entities/form-submission 레이어에 위치하여 AI 제어 피처와 폼 렌더링 피처 간 FSD 의존성 결합을 분리합니다.
 */
export const useConsumerFormDraftStore = create<ConsumerFormDraftState>((set) => ({
  currentSlug: null,
  draftValues: {},
  submitTriggerCount: 0,

  setCurrentSlug: (slug) =>
    set((state) => {
      if (state.currentSlug === slug) return state;
      return {
        currentSlug: slug,
        draftValues: {},
        submitTriggerCount: 0,
      };
    }),

  applyDraftFields: (slug, fields) =>
    set((state) => ({
      currentSlug: slug,
      draftValues:
        state.currentSlug === slug
          ? {
              ...state.draftValues,
              ...fields,
            }
          : { ...fields },
    })),

  triggerSubmit: (slug) =>
    set((state) => ({
      currentSlug: slug,
      submitTriggerCount: state.submitTriggerCount + 1,
    })),

  resetDraft: () =>
    set({
      currentSlug: null,
      draftValues: {},
      submitTriggerCount: 0,
    }),
}));
