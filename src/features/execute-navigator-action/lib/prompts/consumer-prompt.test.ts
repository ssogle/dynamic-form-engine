import { describe, it, expect } from "vitest";
import { todayYmd } from "@/shared/lib/date";
import { CONSUMER_NAVIGATOR_SYSTEM_PROMPT, formatConsumerContextPrompt } from "./consumer-prompt";

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
    expect(prompt).toContain(`현재 서버 기준 날짜: ${todayYmd("Asia/Seoul")}`);
    expect(prompt).toContain("현재 열려있는 폼 제목: 비용 정산서");
  });

  it("시스템 프롬프트에 날짜 계산, 타깃 폼 오판 방지, submitForm 실패 안내 및 목록 필터·정렬, 데이터 검색·릴레이션 연쇄 조회 규칙이 포함되어야 한다", () => {
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("현재 서버 기준 날짜");
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("현재 열려있는 폼 제목");
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("applySubmissionListQuery");
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("searchSubmissions");
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("getRelatedSubmissions");
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("success: false");
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain('op: "in"');
    expect(CONSUMER_NAVIGATOR_SYSTEM_PROMPT).toContain("/analyst");
  });
});
