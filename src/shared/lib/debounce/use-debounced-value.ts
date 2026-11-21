import * as React from "react";

/**
 * 입력값 변경 후 지정된 지연 시간(`delayMs`) 동안 추가 변경이 없을 때만 최신 값을 반영하는 디바운스 훅
 *
 * 검색 입력창에서 키 입력(한글 자모 조합 포함)마다 불필요한 서버 요청이 발생하는 것을 방지합니다.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
