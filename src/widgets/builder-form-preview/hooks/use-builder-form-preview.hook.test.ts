import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Form } from "@/entities/form";
import { useBuilderFormPreview } from "./use-builder-form-preview.hook";

const mockUseFormDetailQuery = vi.fn();

vi.mock("@/entities/form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form")>();
  return {
    ...actual,
    useFormDetailQuery: (formId: string) => mockUseFormDetailQuery(formId),
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("useBuilderFormPreview (widgets/builder-form-preview/hooks)", () => {
  const dummyForm: Form = {
    id: "form-uuid-1",
    title: "빌더 프리뷰 폼",
    description: "설명",
    schemaDefinition: {
      version: "1.0",
      primaryFieldId: "f_title",
      fields: [
        {
          id: "f_title",
          label: "제목",
          type: "text",
          required: true,
          description: "제목 입력",
          order: 0,
        },
      ],
    },
    publishedAt: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFormDetailQuery.mockReturnValue({
      data: dummyForm,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("초기 상태는 모달이 닫혀 있고(false), 스키마 기반 샘플 데이터와 상세 대상을 생성해야 한다", () => {
    const { result } = renderHook(() => useBuilderFormPreview({ formId: "form-uuid-1" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeView).toBe("list");
    expect(result.current.sampleSubmissions).toHaveLength(3);
    expect(result.current.detailSubmissionId).toBe("sample-preview-1");
    expect(result.current.detailSampleSubmission?.id).toBe("sample-preview-1");

    act(() => {
      result.current.handleOpenView("list");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeView).toBe("list");
  });

  it("상세 미리보기 모달을 닫아도 닫힘 애니메이션 동안 직전 activeView('detail')가 유지되어야 한다", () => {
    const { result } = renderHook(() => useBuilderFormPreview({ formId: "form-uuid-1" }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleOpenView("detail");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeView).toBe("detail");
    expect(result.current.detailSubmissionId).toBe("sample-preview-1");
    expect(result.current.detailSampleSubmission?.id).toBe("sample-preview-1");

    act(() => {
      result.current.handleOpenChange(false);
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeView).toBe("detail");
  });

  it("활성 필드가 없는 폼이면 빈 샘플 목록과 빈 detailSubmissionId를 반환해야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: {
        ...dummyForm,
        schemaDefinition: {
          version: "1.0",
          primaryFieldId: "f_title",
          fields: [
            {
              id: "f_title",
              label: "제목",
              type: "text",
              required: true,
              description: "제목 입력",
              deletedAt: "2026-11-02T00:00:00.000Z",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() => useBuilderFormPreview({ formId: "form-uuid-1" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.sampleSubmissions).toEqual([]);
    expect(result.current.detailSubmissionId).toBe("");
    expect(result.current.detailSampleSubmission).toBeUndefined();
  });
});
