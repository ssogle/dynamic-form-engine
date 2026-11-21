import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./use-debounced-value";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("지정된 지연 시간이 경과한 뒤에만 최신 값으로 갱신하고 중간 입력은 무시한다", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: "초기", delay: 300 },
    });

    expect(result.current).toBe("초기");

    rerender({ value: "ㅁ", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe("초기");

    rerender({ value: "마케팅", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("초기");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("마케팅");
  });
});
