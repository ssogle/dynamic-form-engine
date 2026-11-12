import { describe, it, expect } from "vitest";
import { formatConsumerContextPrompt } from "./consumer-prompt";

describe("formatConsumerContextPrompt (features/execute-navigator-action/lib/prompts)", () => {
  it("availableFields의 SelectOption 객체 배열을 [object Object]가 아닌 '라벨(값)' 형식으로 포맷팅하고 비활성 옵션은 제외해야 한다", () => {
    const prompt = formatConsumerContextPrompt("지출 분류 식대로 채워줘", {
      currentPath: "/consumer/forms/form-1/new",
      currentFormId: "form-1",
      currentFormTitle: "비용 정산서",
      availableFields: [
        {
          id: "f_category",
          label: "지출 분류",
          type: "select",
          required: true,
          description: "정산 대상 경비의 회계상 분류를 선택합니다.",
          options: [
            {
              label: "식대",
              value: "MEAL",
              description: "업무 관련 식사 및 음료 지출 시 선택합니다.",
              disabled: false,
            },
            {
              label: "교통비",
              value: "TRANSPORT",
              description: "외근 및 출장에 따른 대중교통/택시 이용 요금입니다.",
              disabled: false,
            },
            {
              label: "숙박비",
              value: "LODGING",
              description: "지방 출장 시 숙소 예약 비용입니다.",
              disabled: true,
            },
          ],
        },
      ],
    });

    expect(prompt).not.toContain("[object Object]");
    expect(prompt).toContain("식대(MEAL)");
    expect(prompt).toContain("업무 관련 식사 및 음료 지출 시 선택합니다.");
    expect(prompt).toContain("교통비(TRANSPORT)");
    expect(prompt).toContain("외근 및 출장에 따른 대중교통/택시 이용 요금입니다.");
    expect(prompt).not.toContain("숙박비(LODGING)");
    expect(prompt).not.toContain("지방 출장 시 숙소 예약 비용입니다.");
    expect(prompt).toContain("정산 대상 경비의 회계상 분류를 선택합니다.");
  });
});
