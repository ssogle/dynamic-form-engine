import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActiveForm, CoreFormField } from "@/entities/form";
import { DynamicFormRenderer } from "./dynamic-form-renderer";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("DynamicFormRenderer (features/render-dynamic-form/ui)", () => {
  const mockFields: CoreFormField[] = [
    {
      id: "f1",
      name: "applicantName",
      label: "지원자 이름",
      type: "text",
      required: true,
      placeholder: "이름을 입력하세요",
    },
    {
      id: "f2",
      name: "yearsOfExperience",
      label: "경력 연수",
      type: "number",
      required: false,
      placeholder: "연수를 숫자로 입력",
    },
    {
      id: "f3",
      name: "targetPosition",
      label: "지원 직무",
      type: "select",
      required: true,
      options: ["Frontend", "Backend"],
    },
  ];

  const mockForm: ActiveForm = {
    slug: "job-application",
    title: "개발자 채용 지원서",
    description: "멋진 개발팀에 합류하세요.",
    publishedAt: new Date("2026-11-08T00:00:00.000Z"),
    fields: mockFields,
  };

  it("폼 제목, 설명, 발행 배지 및 필드 목록이 정상 렌더링되어야 한다", () => {
    renderWithClient(<DynamicFormRenderer form={mockForm} mode="preview" />);

    expect(screen.getByText("개발자 채용 지원서")).toBeDefined();
    expect(screen.getByText("멋진 개발팀에 합류하세요.")).toBeDefined();
    expect(screen.getByText("발행됨")).toBeDefined();
    expect(screen.getByText("지원자 이름")).toBeDefined();
    expect(screen.getByText("경력 연수")).toBeDefined();
    expect(screen.getByText("지원 직무")).toBeDefined();
  });

  it("등록된 필드가 없는 경우 빈 상태 안내 메시지를 렌더링해야 한다", () => {
    const emptyForm: ActiveForm = {
      ...mockForm,
      fields: [],
    };

    renderWithClient(<DynamicFormRenderer form={emptyForm} mode="preview" />);

    expect(screen.getByText("등록된 폼 필드가 없습니다.")).toBeDefined();
    expect(
      screen.getByText("좌측 AI Navigator와 대화하여 필요한 입력 항목을 추가해 보세요.")
    ).toBeDefined();
  });

  describe("미리보기 모드 (mode='preview')", () => {
    it("제출 버튼이 노출되지 않고 미리보기 안내 배지와 문구가 표시되어야 한다", () => {
      renderWithClient(<DynamicFormRenderer form={mockForm} mode="preview" />);

      expect(screen.getByText("미리보기 모드")).toBeDefined();
      expect(
        screen.getByText("현재 미리보기 모드입니다. 입력값 인터랙션과 디자인을 점검할 수 있습니다.")
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: "응답 제출하기" })).toBeNull();
    });

    it("필드 영역을 클릭하면 onFieldClick 콜백에 해당 필드 ID가 전달되어야 한다", () => {
      const handleFieldClick = vi.fn();
      renderWithClient(
        <DynamicFormRenderer form={mockForm} mode="preview" onFieldClick={handleFieldClick} />
      );

      const fieldWrapper = screen.getByText("지원자 이름").closest("[data-field-id='f1']");
      expect(fieldWrapper).not.toBeNull();

      if (fieldWrapper) {
        fireEvent.click(fieldWrapper);
        expect(handleFieldClick).toHaveBeenCalledWith("f1");
      }
    });

    it("selectedFieldId와 일치하는 필드에 하이라이트 스타일이 적용되어야 한다", () => {
      renderWithClient(<DynamicFormRenderer form={mockForm} mode="preview" selectedFieldId="f1" />);

      const fieldWrapper = screen.getByText("지원자 이름").closest("[data-field-id='f1']");
      expect(fieldWrapper?.className).toContain("ring-primary");
    });
  });

  describe("제출 모드 (mode='submission')", () => {
    it("응답 제출하기 버튼이 노출되어야 한다", () => {
      renderWithClient(<DynamicFormRenderer form={mockForm} mode="submission" />);

      const submitButton = screen.getByRole("button", { name: "응답 제출하기" });
      expect(submitButton).toBeDefined();
    });

    it("필수 입력 항목을 채우지 않고 제출 시 에러 피드백이 표시되고 onSubmit이 호출되지 않아야 한다", async () => {
      const handleSubmit = vi.fn();
      renderWithClient(
        <DynamicFormRenderer form={mockForm} mode="submission" onSubmit={handleSubmit} />
      );

      const submitButton = screen.getByRole("button", { name: "응답 제출하기" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("지원자 이름 항목은 필수 입력입니다.")).toBeDefined();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("isSubmitting이 true인 경우 제출 버튼에 로딩 상태가 표시되고 비활성화되어야 한다", () => {
      renderWithClient(
        <DynamicFormRenderer form={mockForm} mode="submission" isSubmitting={true} />
      );

      const submitButton = screen.getByRole("button", { name: "제출 처리 중..." });
      expect(submitButton).toBeDefined();
      expect(submitButton.hasAttribute("disabled")).toBe(true);
    });

    it("submitTriggerCount가 증가하면 외부 신호로 폼 제출이 자동 발동되어야 한다", async () => {
      const handleSubmit = vi.fn();
      const validValues = {
        applicantName: "홍길동",
        targetPosition: "Frontend",
      };

      const { rerender } = renderWithClient(
        <DynamicFormRenderer
          form={mockForm}
          mode="submission"
          values={validValues}
          onSubmit={handleSubmit}
          submitTriggerCount={0}
        />
      );

      expect(handleSubmit).not.toHaveBeenCalled();

      // submitTriggerCount 증가 (AI Navigator 제출 신호 모사)
      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <DynamicFormRenderer
            form={mockForm}
            mode="submission"
            values={validValues}
            onSubmit={handleSubmit}
            submitTriggerCount={1}
          />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });
});
