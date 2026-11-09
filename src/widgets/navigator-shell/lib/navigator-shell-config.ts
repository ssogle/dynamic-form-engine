import type { NavigatorMode } from "@/features/execute-navigator-action";

export interface NavigatorShellConfig {
  badgeLabel: string;
  inputPlaceholder: string;
}

export const NAVIGATOR_SHELL_CONFIGS: Record<NavigatorMode, NavigatorShellConfig> = {
  builder: {
    badgeLabel: "Builder",
    inputPlaceholder: "메시지를 입력해 주세요.",
  },
  consumer: {
    badgeLabel: "Consumer",
    inputPlaceholder: "메시지를 입력해 주세요.",
  },
};
