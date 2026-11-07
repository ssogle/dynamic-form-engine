import { beforeEach, describe, expect, it } from "vitest";
import { useNavigatorChatStore } from "./navigator-chat.store";

describe("navigatorChatStore (AI Navigator 대화 및 UI 상태 스토어)", () => {
  beforeEach(() => {
    useNavigatorChatStore.getState().reset();
  });

  it("초기 상태에 기본 웰컴 메시지가 포함되어 있어야 한다", () => {
    const state = useNavigatorChatStore.getState();

    expect(state.messages.length).toBeGreaterThan(0);
    expect(state.messages[0]?.role).toBe("assistant");
    expect(state.isGenerating).toBe(false);
    expect(state.selectedFieldId).toBeNull();
  });

  it("addMessage를 호출하면 새 메시지가 순서대로 추가되어야 한다", () => {
    const store = useNavigatorChatStore.getState();

    store.addMessage({
      role: "user",
      content: "고객 피드백 설문지 만들어줘",
    });

    const messages = useNavigatorChatStore.getState().messages;
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage?.role).toBe("user");
    expect(lastMessage?.content).toBe("고객 피드백 설문지 만들어줘");
    expect(lastMessage?.id).toBeDefined();
    expect(lastMessage?.createdAt).toBeDefined();
  });

  it("setIsGenerating을 통해 생성 중 상태 플래그를 변경할 수 있어야 한다", () => {
    const store = useNavigatorChatStore.getState();

    expect(store.isGenerating).toBe(false);
    store.setIsGenerating(true);
    expect(useNavigatorChatStore.getState().isGenerating).toBe(true);
    store.setIsGenerating(false);
    expect(useNavigatorChatStore.getState().isGenerating).toBe(false);
  });

  it("setSelectedFieldId로 집중/포커스 필드를 설정하고 해제할 수 있어야 한다", () => {
    const store = useNavigatorChatStore.getState();

    store.setSelectedFieldId("field_customer_name");
    expect(useNavigatorChatStore.getState().selectedFieldId).toBe("field_customer_name");

    store.setSelectedFieldId(null);
    expect(useNavigatorChatStore.getState().selectedFieldId).toBeNull();
  });

  it("clearMessages 호출 시 대화 내역이 웰컴 메시지만 남고 초기화되어야 한다", () => {
    const store = useNavigatorChatStore.getState();

    store.addMessage({ role: "user", content: "첫 번째 질문" });
    store.addMessage({ role: "assistant", content: "답변입니다." });

    expect(useNavigatorChatStore.getState().messages.length).toBeGreaterThan(1);

    store.clearMessages();
    expect(useNavigatorChatStore.getState().messages.length).toBe(1);
    expect(useNavigatorChatStore.getState().messages[0]?.role).toBe("assistant");
  });
});
