import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { ManageFormSubmissions } from "./manage-form-submissions";
import type { Form } from "@/entities/form";

// 1. Entities 모킹
const mockUseFormDetailQuery = vi.fn();
vi.mock("@/entities/form", () => ({
  useFormDetailQuery: (slug: string) => mockUseFormDetailQuery(slug),
}));

// 2. SubmissionListTable 모킹
vi.mock("./submission-list-table", () => ({
  SubmissionListTable: ({ form }: { form: Form }) => (
    <div data-testid="submission-list-table">{form.title} 응답 테이블</div>
  ),
}));

describe("ManageFormSubmissions (features/manage-form-submissions)", () => {
  it("로딩 중일 때 스켈레톤을 표시해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<ManageFormSubmissions slug="test-slug" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("에러 상태이거나 폼이 없을 때 에러 카드를 표시해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("폼 불러오기 실패"),
    });

    render(<ManageFormSubmissions slug="test-slug" />);
    expect(screen.getByText("폼을 불러오지 못했습니다")).toBeDefined();
    expect(screen.getByText("폼 불러오기 실패")).toBeDefined();
  });

  it("정상 폼 데이터가 로드되면 제목과 응답 목록 테이블을 렌더링해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        slug: "survey-test",
        title: "고객 만족도 설문",
      },
      isLoading: false,
      isError: false,
    });

    render(<ManageFormSubmissions slug="survey-test" />);
    expect(screen.getByText("[고객 만족도 설문] 제출 내역")).toBeDefined();
    expect(screen.getByTestId("submission-list-table")).toBeDefined();
    expect(screen.getByText("고객 만족도 설문 응답 테이블")).toBeDefined();
  });
});
