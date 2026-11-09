import { describe, it, expect, beforeEach } from "vitest";
import { useConsumerFormDraftStore } from "./consumer-form-draft.store";

describe("useConsumerFormDraftStore (entities/form-submission/store)", () => {
  beforeEach(() => {
    useConsumerFormDraftStore.getState().resetDraft();
  });

  it("슬러그가 변경되면 기존 임시 필드값과 제출 카운트가 초기화되어야 한다", () => {
    const store = useConsumerFormDraftStore.getState();
    store.setCurrentSlug("form-a");
    store.applyDraftFields("form-a", { field1: "value1" });

    expect(useConsumerFormDraftStore.getState().currentSlug).toBe("form-a");
    expect(useConsumerFormDraftStore.getState().draftValues).toEqual({ field1: "value1" });

    // 다른 슬러그 설정 시 초기화
    store.setCurrentSlug("form-b");
    expect(useConsumerFormDraftStore.getState().currentSlug).toBe("form-b");
    expect(useConsumerFormDraftStore.getState().draftValues).toEqual({});
  });

  it("applyDraftFields를 호출하면 기존 임시 필드값에 새 필드가 병합되어야 한다", () => {
    const store = useConsumerFormDraftStore.getState();
    store.setCurrentSlug("form-a");
    store.applyDraftFields("form-a", { name: "홍길동" });
    store.applyDraftFields("form-a", { age: 25 });

    expect(useConsumerFormDraftStore.getState().draftValues).toEqual({
      name: "홍길동",
      age: 25,
    });
  });

  it("triggerSubmit 호출 시 submitTriggerCount가 1씩 증가해야 한다", () => {
    const store = useConsumerFormDraftStore.getState();
    store.setCurrentSlug("form-a");

    expect(useConsumerFormDraftStore.getState().submitTriggerCount).toBe(0);
    store.triggerSubmit("form-a");
    expect(useConsumerFormDraftStore.getState().submitTriggerCount).toBe(1);
    store.triggerSubmit("form-a");
    expect(useConsumerFormDraftStore.getState().submitTriggerCount).toBe(2);
  });
});
