import type { NavigatorMode } from "@/features/execute-navigator-action";

export interface NavigatorShellProps {
  /**
   * 네비게이터 동작 모드 (빌더 캔버스 모드 or 컨슈머 참여 모드)
   */
  mode: NavigatorMode;

  /**
   * 외부 커스텀 스타일 클래스
   */
  className?: string | undefined;
}
