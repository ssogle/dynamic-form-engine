import { beforeEach, describe, expect, it } from "vitest";
import { useCounterStore } from "./counter-store";

describe("useCounterStore (Zustand 임시 예제)", () => {
  beforeEach(() => {
    useCounterStore.getState().reset();
  });

  it("초기 count는 0이어야 한다", () => {
    expect(useCounterStore.getState().count).toBe(0);
  });

  it("increment 호출 시 count가 1 증가해야 한다", () => {
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().count).toBe(1);
  });

  it("decrement 호출 시 count가 1 감소해야 한다", () => {
    useCounterStore.getState().decrement();
    expect(useCounterStore.getState().count).toBe(-1);
  });

  it("reset 호출 시 count가 0으로 초기화되어야 한다", () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().count).toBe(2);

    useCounterStore.getState().reset();
    expect(useCounterStore.getState().count).toBe(0);
  });
});
