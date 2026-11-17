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

  it("setProgressMessage로 단계별 진행 상태를 기록하고 생성 종료(setIsGenerating(false)) 시 초기화해야 한다", () => {
    useNavigatorChatStore.getState().setIsGenerating(true);
    useNavigatorChatStore.getState().setProgressMessage("데이터 집계 중...");
    expect(useNavigatorChatStore.getState().progressMessage).toBe("데이터 집계 중...");

    useNavigatorChatStore.getState().setIsGenerating(false);
    expect(useNavigatorChatStore.getState().progressMessage).toBeNull();
  });

  it("appendProgressStep은 연속 중복 및 공백을 제외하고 단계를 누적하며 생성 종료 시 초기화해야 한다", () => {
    const store = useNavigatorChatStore.getState();
    store.setIsGenerating(true);
    store.appendProgressStep("  폼 목록 조회 중...  ");
    store.appendProgressStep("폼 목록 조회 중...");
    store.appendProgressStep("   ");
    store.appendProgressStep("응답 데이터를 집계하는 중...");

    expect(useNavigatorChatStore.getState().progressSteps).toEqual([
      "폼 목록 조회 중...",
      "응답 데이터를 집계하는 중...",
    ]);

    useNavigatorChatStore.getState().setIsGenerating(false);
    expect(useNavigatorChatStore.getState().progressSteps).toEqual([]);
  });

  it("addMessage는 수행 단계 기록(steps)을 포함하여 메시지에 저장할 수 있어야 한다", () => {
    useNavigatorChatStore.getState().addMessage({
      role: "assistant",
      content: "분석을 완료했습니다.",
      steps: ["폼 목록 조회 중...", "응답 데이터를 집계하는 중..."],
    });

    const { messages } = useNavigatorChatStore.getState();
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage?.steps).toEqual(["폼 목록 조회 중...", "응답 데이터를 집계하는 중..."]);
  });
});
