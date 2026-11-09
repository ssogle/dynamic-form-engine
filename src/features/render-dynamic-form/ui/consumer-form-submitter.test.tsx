import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { ConsumerFormSubmitter } from "./consumer-form-submitter";
import type { Form } from "@/entities/form";

// 1. Entities 모킹
const mockUseFormDetailQuery = vi.fn();
vi.mock("@/entities/form", () => ({
  useFormDetailQuery: (slug: string) => mockUseFormDetailQuery(slug),
}));

const mockSubmitResponse = vi.fn();
vi.mock("@/entities/form-submission", () => ({
  useSubmitFormMutation: () => ({
    mutateAsync: mockSubmitResponse,
    isPending: false,
  }),
  useConsumerFormDraftStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentSlug: "survey-test",
      draftValues: { title: "테스트" },
      submitTriggerCount: 0,
      setCurrentSlug: vi.fn(),
    }),
}));

// 2. DynamicFormRenderer 모킹
vi.mock("./dynamic-form-renderer", () => ({
  DynamicFormRenderer: ({ form }: { form: Form }) => (
    <div data-testid="dynamic-form-renderer">{form.title} 렌더러</div>
  ),
}));

describe("ConsumerFormSubmitter (features/render-dynamic-form)", () => {
  it("로딩 중일 때 스켈레톤을 표시해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<ConsumerFormSubmitter slug="test-slug" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("에러 상태이거나 폼이 없을 때 에러 카드를 표시해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("폼 조회 실패"),
    });

    render(<ConsumerFormSubmitter slug="test-slug" />);
    expect(screen.getByText("폼을 불러오지 못했습니다")).toBeDefined();
    expect(screen.getByText("폼 조회 실패")).toBeDefined();
  });

  it("미발행 폼(publishedAt 없음)인 경우 안내 카드를 표시해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        slug: "unpub-form",
        title: "미발행 설문",
        publishedAt: null,
      },
      isLoading: false,
      isError: false,
    });

    render(<ConsumerFormSubmitter slug="unpub-form" />);
    expect(screen.getByText("아직 발행되지 않은 폼입니다")).toBeDefined();
  });

  it("발행된 정상 폼인 경우 DynamicFormRenderer를 렌더링해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        slug: "published-form",
        title: "입사 지원서",
        publishedAt: "2026-11-08T00:00:00Z",
      },
      isLoading: false,
      isError: false,
    });

    render(<ConsumerFormSubmitter slug="published-form" />);
    expect(screen.getByTestId("dynamic-form-renderer")).toBeDefined();
    expect(screen.getByText("입사 지원서 렌더러")).toBeDefined();
  });
});
