import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Form } from "@/entities/form";
import { useBuilderFormList } from "./use-builder-form-list.hook";

// entities/form 모킹
const mockUseFormsQuery = vi.fn();
const mockPublishMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/entities/form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form")>();
  return {
    ...actual,
    useFormsQuery: () => mockUseFormsQuery(),
    usePublishFormMutation: () => ({
      mutate: mockPublishMutate,
      isPending: false,
    }),
    useDeleteFormMutation: () => ({
      mutate: mockDeleteMutate,
      isPending: false,
    }),
  };
});

describe("useBuilderFormList (features/manage-builder-forms/hooks)", () => {
  const dummyForms: Form[] = [
    {
      id: "form-uuid-1",
      title: "빌더 폼 1",
      description: "설명",
      schemaDefinition: { version: "1.0", fields: [] },
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFormsQuery.mockReturnValue({
      data: dummyForms,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("폼 목록 데이터를 정상적으로 로드하고 상태를 반환해야 한다", () => {
    const { result } = renderHook(() => useBuilderFormList());

    expect(result.current.forms).toEqual(dummyForms);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("handleTogglePublish 호출 시 발행 토글 뮤테이션을 실행해야 한다", () => {
    const { result } = renderHook(() => useBuilderFormList());

    act(() => {
      result.current.handleTogglePublish("form-uuid-1", false);
    });

    expect(mockPublishMutate).toHaveBeenCalledWith({
      id: "form-uuid-1",
      isPublished: false,
    });
  });

  it("handleDeleteForm 호출 시 삭제 뮤테이션을 실행해야 한다", () => {
    const { result } = renderHook(() => useBuilderFormList());

    act(() => {
      result.current.handleDeleteForm("form-uuid-1");
    });

    expect(mockDeleteMutate).toHaveBeenCalledWith("form-uuid-1");
  });
});
