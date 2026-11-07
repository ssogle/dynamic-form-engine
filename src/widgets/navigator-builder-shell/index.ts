/**
 * 상주형 AI Builder Navigator 쉘 위젯 Public API
 *
 * FSD 단방향 의존성 규칙에 따라 app 레이어는
 * 내부 파일 경로 대신 본 index.ts를 통해서만 컴포넌트와 상태 스토어를 참조합니다.
 */
export {
  NavigatorBuilderShell,
  NavigatorShell,
  type NavigatorBuilderShellProps,
  type NavigatorShellProps,
} from "./ui/navigator-builder-shell";

export {
  useNavigatorBuilderChatStore,
  useNavigatorChatStore,
  type NavigatorBuilderChatMessage,
  type NavigatorChatMessage,
  type NavigatorBuilderChatState,
  type NavigatorChatState,
} from "./store/navigator-builder-chat.store";
