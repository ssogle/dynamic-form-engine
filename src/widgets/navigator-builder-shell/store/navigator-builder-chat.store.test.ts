import { beforeEach, describe, expect, it } from "vitest";
import { useNavigatorBuilderChatStore } from "./navigator-builder-chat.store";

describe("navigatorBuilderChatStore (AI Builder Navigator 대화 및 UI 상태 스토어)", () => {
  beforeEach(() => {
    useNavigatorBuilderChatStore.getState().reset();
  });

  it("초기 상태에 기본 웰컴 메시지가 포함되어 있어야 한다", () => {
    const state = useNavigatorBuilderChatStore.getState();

    expect(state.messages.length).toBeGreaterThan(0);
    expect(state.messages[0]?.role).toBe("assistant");
    expect(state.isGenerating).toBe(false);
    expect(state.selectedFieldId).toBeNull();
  });

  it("addMessage를 호출하면 새 메시지가 순서대로 추가되어야 한다", () => {
    const store = useNavigatorBuilderChatStore.getState();

    store.addMessage({
      role: "user",
      content: "고객 피드백 설문지 만들어줘",
    });

    const messages = useNavigatorBuilderChatStore.getState().messages;
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage?.role).toBe("user");
    expect(lastMessage?.content).toBe("고객 피드백 설문지 만들어줘");
    expect(lastMessage?.id).toBeDefined();
    expect(lastMessage?.createdAt).toBeDefined();
  });

  it("setIsGenerating을 통해 생성 중 상태 플래그를 변경할 수 있어야 한다", () => {
    const store = useNavigatorBuilderChatStore.getState();

    expect(store.isGenerating).toBe(false);
    store.setIsGenerating(true);
    expect(useNavigatorBuilderChatStore.getState().isGenerating).toBe(true);
    store.setIsGenerating(false);
    expect(useNavigatorBuilderChatStore.getState().isGenerating).toBe(false);
  });

  it("setSelectedFieldId로 집중/포커스 필드를 설정하고 해제할 수 있어야 한다", () => {
    const store = useNavigatorBuilderChatStore.getState();

    store.setSelectedFieldId("field_customer_name");
    expect(useNavigatorBuilderChatStore.getState().selectedFieldId).toBe("field_customer_name");

    store.setSelectedFieldId(null);
    expect(useNavigatorBuilderChatStore.getState().selectedFieldId).toBeNull();
  });

  it("clearMessages를 호출하면 사용자 메시지가 모두 지워지고 초기 웰컴 메시지만 남아야 한다", () => {
    const store = useNavigatorBuilderChatStore.getState();

    store.addMessage({ role: "user", content: "폼 만들어줘" });
    store.addMessage({ role: "assistant", content: "생성했습니다." });
    store.setSelectedFieldId("field_1");

    expect(useNavigatorBuilderChatStore.getState().messages.length).toBe(3);

    store.clearMessages();

    const state = useNavigatorBuilderChatStore.getState();
    expect(state.messages.length).toBe(1);
    expect(state.messages[0]?.id).toBe("msg_welcome");
    expect(state.selectedFieldId).toBeNull();
  });
});
