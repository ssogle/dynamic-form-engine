import type { NavigatorMode } from "@/features/execute-navigator-action";
import type { NavigatorDockSide } from "@/shared/lib/navigator-focus";

export interface NavigatorShellProps {
  /**
   * 네비게이터 동작 모드 (빌더 캔버스 모드 or 컨슈머 참여 모드 or 분석가 모드)
   */
  mode: NavigatorMode;

  /**
   * 현재 패널 도킹 위치 ("left" | "right")
   */
  dockSide?: NavigatorDockSide | undefined;

  /**
   * 패널 좌/우 도킹 위치 전환 콜백
   */
  onToggleDockSide?: (() => void) | undefined;

  /**
   * 외부 커스텀 스타일 클래스
   */
  className?: string | undefined;
}
