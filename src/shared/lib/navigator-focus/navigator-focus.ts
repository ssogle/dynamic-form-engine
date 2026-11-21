/**
 * AI Navigator 패널 도킹 방향 ("left": 좌측 / "right": 우측 코파일럿)
 */
export type NavigatorDockSide = "left" | "right";

/**
 * 기본 AI Navigator 도킹 방향 (본문 시선 간섭을 줄이고 코파일럿 존재감을 높이기 위해 우측 기본 배치)
 */
export const DEFAULT_NAVIGATOR_DOCK_SIDE: NavigatorDockSide = "right";

/**
 * 도킹 방향 사용자 설정 저장용 localStorage 키
 */
export const NAVIGATOR_DOCK_SIDE_STORAGE_KEY = "dfe:navigator-dock-side";

/**
 * 도킹 방향 변경 알림용 커스텀 이벤트 이름
 */
export const NAVIGATOR_DOCK_CHANGE_EVENT = "dfe:navigator-dock-change";

/**
 * 본문 영역이나 단축키에서 AI Navigator 입력창 포커스를 요청할 때 사용하는 커스텀 이벤트 이름
 */
export const NAVIGATOR_FOCUS_EVENT = "dfe:navigator-focus";

/**
 * AI Navigator 입력창 포커스 요청 페이로드
 */
export interface FocusNavigatorPayload {
  /** 포커스와 함께 입력창에 미리 채워 넣을 선택적 프롬프트/말머리 텍스트 */
  readonly prefillText?: string | undefined;
  /** true일 경우 기존 입력값 여부와 무관하게 prefillText로 교체, false(기본)면 비어 있을 때만 채움 */
  readonly replace?: boolean | undefined;
}

/**
 * 브라우저 localStorage에서 저장된 AI Navigator 도킹 방향을 안전하게 조회합니다.
 */
export function readSavedNavigatorDockSide(): NavigatorDockSide {
  if (typeof window === "undefined") {
    return DEFAULT_NAVIGATOR_DOCK_SIDE;
  }
  try {
    const saved = window.localStorage.getItem(NAVIGATOR_DOCK_SIDE_STORAGE_KEY);
    if (saved === "left" || saved === "right") {
      return saved;
    }
  } catch {
    // 프라이버시 모드 등에서 localStorage 접근이 차단되면 기본값을 반환합니다.
  }
  return DEFAULT_NAVIGATOR_DOCK_SIDE;
}

/**
 * 사용자가 선택한 AI Navigator 도킹 방향을 localStorage에 안전하게 저장합니다.
 */
export function saveNavigatorDockSide(side: NavigatorDockSide): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(NAVIGATOR_DOCK_SIDE_STORAGE_KEY, side);
  } catch {
    // 저장 불가 환경에서는 런타임 상태만 유지합니다.
  }
  window.dispatchEvent(new Event(NAVIGATOR_DOCK_CHANGE_EVENT));
}

/**
 * AI Navigator 도킹 방향 변경 이벤트를 구독합니다 (useSyncExternalStore 호환).
 */
export function subscribeNavigatorDockSide(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === NAVIGATOR_DOCK_SIDE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(NAVIGATOR_DOCK_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(NAVIGATOR_DOCK_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * 본문 작업 화면 등에서 AI Navigator 입력창으로 포커스(및 선택적 말머리 채움)를 전달합니다.
 * FSD 하향 의존 규칙을 유지하기 위해 상위 위젯을 직접 import하지 않고 브라우저 커스텀 이벤트를 발행합니다.
 */
export function dispatchFocusNavigator(payload?: FocusNavigatorPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<FocusNavigatorPayload>(NAVIGATOR_FOCUS_EVENT, {
      detail: payload ?? {},
    })
  );
}

/**
 * AI Navigator 입력창 포커스 요청 이벤트를 구독하고 해제 함수를 반환합니다.
 */
export function subscribeFocusNavigator(
  listener: (payload: FocusNavigatorPayload) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<FocusNavigatorPayload | undefined>;
    listener(customEvent.detail ?? {});
  };

  window.addEventListener(NAVIGATOR_FOCUS_EVENT, handler);
  return () => {
    window.removeEventListener(NAVIGATOR_FOCUS_EVENT, handler);
  };
}
