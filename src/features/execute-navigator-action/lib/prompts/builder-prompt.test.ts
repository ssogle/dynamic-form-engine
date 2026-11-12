import { describe, it, expect } from "vitest";
import { BUILDER_NAVIGATOR_SYSTEM_PROMPT, formatBuilderContextPrompt } from "./builder-prompt";

describe("builder-prompt (features/execute-navigator-action/lib/prompts)", () => {
  it("시스템 프롬프트에 options 객체 배열 규격({ label, value, description, disabled })과 문자열 배열 금지 지침이 포함되어야 한다", () => {
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("label");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("value");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("description");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("disabled");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("문자열 배열");
  });

  it("시스템 프롬프트에 옵션별 선택 기준을 설명하는 description 필수 작성 지침이 포함되어야 한다", () => {
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain('"description"');
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("선택 기준");
  });

  it("시스템 프롬프트에 발행 이후(isPublished) 옵션 삭제 금지 및 DISABLE_OPTION 사용 지침이 포함되어야 한다", () => {
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("REMOVE_OPTION");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("DISABLE_OPTION");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("발행");
  });

  it("시스템 프롬프트에 section 필드 타입이 제거되고 모든 필드의 description 필수 작성 지침이 포함되어야 한다", () => {
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).not.toContain("'section'");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("description");
    expect(BUILDER_NAVIGATOR_SYSTEM_PROMPT).toContain("1문장");
  });

  it("formatBuilderContextPrompt는 현재 열려있는 폼의 발행 상태(isPublished)를 컨텍스트에 포함해야 한다", () => {
    const prompt = formatBuilderContextPrompt("옵션 수정해줘", {
      currentPath: "/builder/forms/form-1",
      currentForm: {
        id: "form-1",
        title: "비용 정산서",
        isPublished: true,
        fields: [],
      },
    });

    expect(prompt).toContain('"isPublished":true');
  });
});
