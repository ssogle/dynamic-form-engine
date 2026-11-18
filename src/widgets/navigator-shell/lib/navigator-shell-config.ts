import type { NavigatorMode } from "@/features/execute-navigator-action";

/**
 * AI Navigator 모드별 UI 표시 설정 인터페이스
 */
export interface NavigatorShellConfig {
  /** 패널 상단 헤더에 표시되는 앱별 Navigator 타이틀 */
  title: string;
  /** 접근성 라벨 및 모드 식별용 뱃지 명칭 */
  badgeLabel: string;
  /** 프롬프트 입력창 플레이스홀더 */
  inputPlaceholder: string;
}

/**
 * Builder / Consumer / Analyst 3개 작업 공간 모드별 Navigator 설정 맵
 */
export const NAVIGATOR_SHELL_CONFIGS: Record<NavigatorMode, NavigatorShellConfig> = {
  builder: {
    title: "Builder AI Navigator",
    badgeLabel: "Builder",
    inputPlaceholder: "메시지를 입력해 주세요.",
  },
  consumer: {
    title: "Consumer AI Navigator",
    badgeLabel: "Consumer",
    inputPlaceholder: "메시지를 입력해 주세요.",
  },
  analyst: {
    title: "Analyst AI Navigator",
    badgeLabel: "Analyst",
    inputPlaceholder: "메시지를 입력해 주세요.",
  },
};
