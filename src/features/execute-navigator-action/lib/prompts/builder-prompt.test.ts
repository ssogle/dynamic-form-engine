import { describe, expect, it } from "vitest";
import { BUILDER_NAVIGATOR_SYSTEM_PROMPT } from "./builder-prompt";

describe("builder-prompt (features/execute-navigator-action/lib/prompts)", () => {
  it("시스템 프롬프트에 트랜잭션 폼 date 필드 제안 및 마스터 폼 강제 금지 가이드가 포함되어야 한다", () => {
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("'date'");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("비용 정산");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("createdAt");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("억지로 추가하지 마세요");
  });

  it("발행 상태 폼 수정 요청 시 임의로 발행을 취소하지 않고 먼저 사용자 승인을 받도록 안내해야 한다", () => {
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("사용자 확인 없이 임의로");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("명시적 승인을 받은 다음");
  });
});
