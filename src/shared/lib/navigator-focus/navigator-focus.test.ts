import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NAVIGATOR_DOCK_SIDE,
  NAVIGATOR_DOCK_SIDE_STORAGE_KEY,
  dispatchFocusNavigator,
  readSavedNavigatorDockSide,
  saveNavigatorDockSide,
  subscribeFocusNavigator,
  subscribeNavigatorDockSide,
  type FocusNavigatorPayload,
} from "./navigator-focus";

describe("navigator-focus 유틸리티", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("저장된 도킹 방향이 없거나 잘못된 값이면 기본값(right)을 반환한다", () => {
    expect(readSavedNavigatorDockSide()).toBe(DEFAULT_NAVIGATOR_DOCK_SIDE);

    window.localStorage.setItem(NAVIGATOR_DOCK_SIDE_STORAGE_KEY, "invalid-side");
    expect(readSavedNavigatorDockSide()).toBe(DEFAULT_NAVIGATOR_DOCK_SIDE);
  });

  it("도킹 방향을 저장하고 다시 조회하며 구독 리스너에게 알릴 수 있다", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeNavigatorDockSide(onChange);

    saveNavigatorDockSide("left");
    expect(readSavedNavigatorDockSide()).toBe("left");
    expect(onChange).toHaveBeenCalledTimes(1);

    saveNavigatorDockSide("right");
    expect(readSavedNavigatorDockSide()).toBe("right");
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    saveNavigatorDockSide("left");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("dispatchFocusNavigator 호출 시 구독 리스너에게 페이로드를 전달하고 구독 해제를 지원한다", () => {
    const received: FocusNavigatorPayload[] = [];
    const unsubscribe = subscribeFocusNavigator((payload) => {
      received.push(payload);
    });

    dispatchFocusNavigator({ prefillText: "신규 폼 생성: ", replace: false });
    expect(received).toEqual([{ prefillText: "신규 폼 생성: ", replace: false }]);

    unsubscribe();
    dispatchFocusNavigator({ prefillText: "무시되어야 함" });
    expect(received).toHaveLength(1);
  });
});
