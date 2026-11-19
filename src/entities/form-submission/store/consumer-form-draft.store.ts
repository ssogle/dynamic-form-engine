import { create } from "zustand";

/**
 * 컨슈머 폼 실시간 임시 입력값 및 제출 상태 인터페이스
 */
export interface ConsumerFormDraftState {
  /**
   * 대상 폼 고유 식별자 (UUID)
   */
  currentFormId: string | null;

  /**
   * AI Navigator가 추출하여 자동 입력하도록 지시한 필드값 맵 (field.id -> value)
   */
  draftValues: Record<string, unknown>;

  /**
   * AI Navigator가 제출을 트리거했는지 여부 카운터 (증가 시 제출 효과 발동)
   */
  submitTriggerCount: number;

  /**
   * 대상 폼 설정 및 기존 임시값 초기화
   */
  setCurrentFormId: (formId: string) => void;

  /**
   * AI가 채워준 단일 또는 복수 필드값을 임시 저장소에 병합
   */
  applyDraftFields: (formId: string, fields: Record<string, unknown>) => void;

  /**
   * 사용자가 폼(RHF)에서 직접 입력·수정한 전체 현재 스냅샷을 스토어에 역동기화
   */
  syncDraftValues: (formId: string, values: Record<string, unknown>) => void;

  /**
   * AI에 의한 폼 제출 신호 발생
   */
  triggerSubmit: (formId: string) => void;

  /**
   * 임시 데이터 초기화
   */
  resetDraft: () => void;
}

function areDraftFieldValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, idx) => Object.is(item, b[idx]));
  }
  return false;
}

function areDraftRecordsEqual(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  return nextKeys.every((key) => areDraftFieldValuesEqual(prev[key], next[key]));
}

/**
 * AI Consumer Navigator와 우측 폼 입력 화면 간 실시간 양방향 데이터 바인딩을 위한 전역 Zustand 스토어
 *
 * entities/form-submission 레이어에 위치하여 AI 제어 피처와 폼 렌더링 피처 간 FSD 의존성 결합을 분리합니다.
 */
export const useConsumerFormDraftStore = create<ConsumerFormDraftState>((set) => ({
  currentFormId: null,
  draftValues: {},
  submitTriggerCount: 0,

  setCurrentFormId: (formId) =>
    set((state) => {
      if (state.currentFormId === formId) return state;
      return {
        currentFormId: formId,
        draftValues: {},
        submitTriggerCount: 0,
      };
    }),

  applyDraftFields: (formId, fields) =>
    set((state) => ({
      currentFormId: formId,
      draftValues:
        state.currentFormId === formId
          ? {
              ...state.draftValues,
              ...fields,
            }
          : { ...fields },
    })),

  syncDraftValues: (formId, values) =>
    set((state) => {
      if (state.currentFormId === formId && areDraftRecordsEqual(state.draftValues, values)) {
        return state;
      }
      return {
        currentFormId: formId,
        draftValues: { ...values },
      };
    }),

  triggerSubmit: (formId) =>
    set((state) => ({
      currentFormId: formId,
      submitTriggerCount: state.submitTriggerCount + 1,
    })),

  resetDraft: () =>
    set({
      currentFormId: null,
      draftValues: {},
      submitTriggerCount: 0,
    }),
}));
