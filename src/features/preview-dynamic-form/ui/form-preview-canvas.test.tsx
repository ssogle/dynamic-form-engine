import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as formEntity from "@/entities/form";
import type { ActiveForm } from "@/entities/form";
import { FormPreviewCanvas } from "./form-preview-canvas";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("FormPreviewCanvas (실시간 동적 폼 프리뷰어 캔버스)", () => {
  const mockActiveForm: ActiveForm = {
    slug: "customer-feedback",
    title: "고객 피드백 설문지",
    description: "서비스 경험에 대한 솔직한 의견을 남겨주세요.",
    fields: [
      {
        id: "field_customer_name",
        name: "customerName",
        label: "고객 성함",
        type: "text",
        placeholder: "홍길동",
        required: true,
      },
      {
        id: "field_feedback_details",
        name: "feedbackDetails",
        label: "상세 의견",
        type: "textarea",
        placeholder: "개선되었으면 하는 점을 자유롭게 적어주세요.",
        required: false,
        description: "최대 500자까지 작성할 수 있습니다.",
      },
      {
        id: "field_satisfaction_score",
        name: "satisfactionScore",
        label: "만족도 점수",
        type: "number",
        placeholder: "10",
        required: true,
      },
      {
        id: "field_contact_channel",
        name: "contactChannel",
        label: "선호 연락 경로",
        type: "select",
        options: ["이메일", "전화", "카카오톡"],
        required: false,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("폼 데이터가 prop으로 직접 주어졌을 때 4종 필드와 타이틀/설명을 정상 렌더링해야 한다", () => {
    renderWithClient(<FormPreviewCanvas form={mockActiveForm} />);

    // 타이틀 및 설명 확인
    expect(screen.getByText("고객 피드백 설문지")).toBeInTheDocument();
    expect(screen.getByText("서비스 경험에 대한 솔직한 의견을 남겨주세요.")).toBeInTheDocument();
    expect(screen.getByText("4개 항목")).toBeInTheDocument();

    // 4종 필드 라벨 확인
    expect(screen.getByText("고객 성함")).toBeInTheDocument();
    expect(screen.getByText("상세 의견")).toBeInTheDocument();
    expect(screen.getByText("만족도 점수")).toBeInTheDocument();
    expect(screen.getByText("선호 연락 경로")).toBeInTheDocument();

    // 헬퍼 텍스트 확인
    expect(screen.getByText("최대 500자까지 작성할 수 있습니다.")).toBeInTheDocument();

    // 필수 입력 마크 확인
    const requiredMarks = screen.getAllByLabelText("필수 입력");
    expect(requiredMarks.length).toBe(2);
  });

  it("필드가 비어있는 폼의 경우 등록된 질문이 없다는 안내 UI를 렌더링해야 한다", () => {
    const emptyForm: ActiveForm = {
      slug: "empty-form",
      title: "빈 폼",
      fields: [],
    };

    renderWithClient(<FormPreviewCanvas form={emptyForm} />);

    expect(screen.getByText("빈 폼")).toBeInTheDocument();
    expect(screen.getByText("0개 항목")).toBeInTheDocument();
    expect(screen.getByText("등록된 질문 항목이 없습니다")).toBeInTheDocument();
  });

  it("폼 데이터와 슬러그가 모두 제공되지 않으면 선택된 폼이 없다는 안내 UI를 표시해야 한다", () => {
    renderWithClient(<FormPreviewCanvas />);

    expect(screen.getByText("선택된 폼이 없습니다")).toBeInTheDocument();
  });

  it("slug가 주어지고 쿼리가 로딩 중일 때 스켈레톤 상태를 표시해야 한다", () => {
    vi.spyOn(formEntity, "useFormDetailQuery").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormDetailQuery>);

    const { container } = renderWithClient(<FormPreviewCanvas slug="customer-feedback" />);

    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("slug 기반 조회 시 에러가 발생하면 오류 안내 카드를 표시해야 한다", () => {
    vi.spyOn(formEntity, "useFormDetailQuery").mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("네트워크 연결 실패"),
    } as unknown as ReturnType<typeof formEntity.useFormDetailQuery>);

    renderWithClient(<FormPreviewCanvas slug="not-found" />);

    expect(screen.getByText("폼 정보를 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByText("네트워크 연결 실패")).toBeInTheDocument();
  });

  it("필드를 클릭하면 onFieldClick 콜백에 해당 필드 id가 전달되어야 한다", () => {
    const handleFieldClick = vi.fn();

    renderWithClient(<FormPreviewCanvas form={mockActiveForm} onFieldClick={handleFieldClick} />);

    const nameFieldWrapper = screen.getByText("고객 성함").closest("[data-field-id]");
    expect(nameFieldWrapper).not.toBeNull();

    if (nameFieldWrapper) {
      fireEvent.click(nameFieldWrapper);
      expect(handleFieldClick).toHaveBeenCalledWith("field_customer_name");
    }
  });

  it("selectedFieldId와 일치하는 필드 래퍼에 활성화 스타일 클래스가 적용되어야 한다", () => {
    renderWithClient(
      <FormPreviewCanvas form={mockActiveForm} selectedFieldId="field_satisfaction_score" />
    );

    const scoreFieldWrapper = screen.getByText("만족도 점수").closest("[data-field-id]");
    expect(scoreFieldWrapper).toHaveClass("border-primary/50");
  });

  it("deletedAt 속성을 가진 소프트 삭제된 필드는 렌더링 대상에서 제외되어야 한다", () => {
    const formWithDeletedField = {
      ...mockActiveForm,
      fields: [
        ...mockActiveForm.fields,
        {
          id: "field_deleted",
          name: "oldField",
          label: "삭제된 질문 항목",
          type: "text" as const,
          required: false,
          deletedAt: "2026-11-08T00:00:00Z",
        },
      ],
    };

    renderWithClient(<FormPreviewCanvas form={formWithDeletedField} />);

    expect(screen.queryByText("삭제된 질문 항목")).not.toBeInTheDocument();
  });

  it("publishedAt이 설정되어 있으면 발행됨 배지를, 없으면 초안 배지를 표시해야 한다", () => {
    const { rerender } = renderWithClient(
      <FormPreviewCanvas form={{ ...mockActiveForm, publishedAt: null }} />
    );
    expect(screen.getByText("초안 (Draft)")).toBeInTheDocument();

    rerender(
      <FormPreviewCanvas
        form={{ ...mockActiveForm, publishedAt: new Date("2026-11-08T00:00:00Z") }}
      />
    );
    expect(screen.getByText("발행됨")).toBeInTheDocument();
  });
});
