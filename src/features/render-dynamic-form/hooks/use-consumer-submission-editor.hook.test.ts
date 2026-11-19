import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConsumerFormDraftStore } from "@/entities/form-submission";
import { useConsumerSubmissionEditor } from "./use-consumer-submission-editor.hook";

// 엔티티 쿼리 및 뮤테이션 모킹
const mockUpdateMutateAsync = vi.fn();
vi.mock("@/entities/form", () => ({
  useFormDetailQuery: vi.fn((formId: string) => ({
    data: {
      id: formId,
      title: "수정 테스트 설문지",
      description: "설명",
      schemaDefinition: { fields: [] },
      isPublished: true,
      publishedAt: "2026-01-01T00:00:00Z",
    },
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/entities/form-submission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form-submission")>();
  return {
    ...actual,
    useFormSubmissionDetailQuery: vi.fn((formId: string, submissionId: string) => ({
      data: {
        id: submissionId,
        formId,
        version: 1,
        data: { name: "원래이름", age: 20 },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: null,
      },
      isLoading: false,
      isError: false,
      error: null,
    })),
    useUpdateSubmissionMutation: vi.fn(() => ({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    })),
  };
});

describe("useConsumerSubmissionEditor (features/render-dynamic-form/hooks)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    useConsumerFormDraftStore.getState().resetDraft();
  });

  const createWrapper = () => {
    return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
  };

  it("초기 마운트 시 폼 및 제출 데이터를 로드하고 기본 제출값(mergedValues)을 제공해야 한다", () => {
    const formId = "form-edit-uuid-1";
    const submissionId = "sub-edit-uuid-1";

    const { result } = renderHook(() => useConsumerSubmissionEditor({ formId, submissionId }), {
      wrapper: createWrapper(),
    });

    expect(result.current.form?.id).toBe(formId);
    expect(result.current.submission?.id).toBe(submissionId);
    expect(result.current.mergedValues).toEqual({ name: "원래이름", age: 20 });
    expect(result.current.isSuccessUpdated).toBe(false);
  });

  it("드래프트 스토어에 수정 필드가 주입되면 mergedValues에 덮어씌워져야 한다", () => {
    const formId = "form-edit-uuid-2";
    const submissionId = "sub-edit-uuid-2";

    const { result } = renderHook(() => useConsumerSubmissionEditor({ formId, submissionId }), {
      wrapper: createWrapper(),
    });

    act(() => {
      useConsumerFormDraftStore.getState().applyDraftFields(formId, { name: "새이름" });
    });

    expect(result.current.mergedValues).toEqual({ name: "새이름", age: 20 });
  });

  it("handleUpdate 호출 성공 시 뮤테이션을 실행하고 isSuccessUpdated가 true로 전이되어야 한다", async () => {
    const formId = "form-edit-uuid-3";
    const submissionId = "sub-edit-uuid-3";
    mockUpdateMutateAsync.mockResolvedValueOnce({ id: submissionId });

    const { result } = renderHook(() => useConsumerSubmissionEditor({ formId, submissionId }), {
      wrapper: createWrapper(),
    });

    const updatePayload = { name: "수정완료이름", age: 25 };

    await act(async () => {
      await result.current.handleUpdate(updatePayload);
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      submissionId,
      data: updatePayload,
      expectedVersion: 1,
    });
    expect(result.current.isSuccessUpdated).toBe(true);
  });

  it("handleUpdate 호출 시 409 충돌 에러가 발생하면 updateErrorMessage가 설정되어야 한다", async () => {
    const formId = "form-edit-uuid-4";
    const submissionId = "sub-edit-uuid-4";
    mockUpdateMutateAsync.mockRejectedValueOnce({
      status: 409,
      code: "CONFLICT",
      message: "충돌 발생",
    });

    const { result } = renderHook(() => useConsumerSubmissionEditor({ formId, submissionId }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleUpdate({ name: "충돌수정" });
    });

    expect(result.current.isSuccessUpdated).toBe(false);
    expect(result.current.updateErrorMessage).toContain("최신 버전");
  });
});
