import { describe, it, expect, beforeEach } from "vitest";
import { useNavigatorChatStore, INITIAL_WELCOME_MESSAGES } from "./navigator-chat.store";

describe("useNavigatorChatStore (widgets/navigator-shell/store)", () => {
  beforeEach(() => {
    useNavigatorChatStore.getState().reset();
  });

  it("초기 빌더 모드에서는 빌더 웰컴 메시지가 설정되어야 한다", () => {
    const { messages, currentMode } = useNavigatorChatStore.getState();
    expect(currentMode).toBe("builder");
    expect(messages.length).toBe(1);
    expect(messages[0]?.content).toBe(INITIAL_WELCOME_MESSAGES.builder);
  });

  it("setMode('consumer') 호출 시 컨슈머 웰컴 메시지로 전환되어야 한다", () => {
    useNavigatorChatStore.getState().setMode("consumer");

    const { messages, currentMode } = useNavigatorChatStore.getState();
    expect(currentMode).toBe("consumer");
    expect(messages.length).toBe(1);
    expect(messages[0]?.content).toBe(INITIAL_WELCOME_MESSAGES.consumer);
  });

  it("setMode('analyst') 호출 시 분석가 웰컴 메시지로 전환되어야 한다", () => {
    useNavigatorChatStore.getState().setMode("analyst");

    const { messages, currentMode } = useNavigatorChatStore.getState();
    expect(currentMode).toBe("analyst");
    expect(messages.length).toBe(1);
    expect(messages[0]?.content).toBe(INITIAL_WELCOME_MESSAGES.analyst);
  });

  it("addMessage 호출 시 순서대로 메시지가 추가되어야 한다", () => {
    useNavigatorChatStore.getState().addMessage({
      role: "user",
      content: "새로운 폼 만들어줘",
    });

    const { messages } = useNavigatorChatStore.getState();
    expect(messages.length).toBe(2);
    expect(messages[1]?.role).toBe("user");
    expect(messages[1]?.content).toBe("새로운 폼 만들어줘");
  });
});
