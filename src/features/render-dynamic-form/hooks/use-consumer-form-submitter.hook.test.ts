import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConsumerFormDraftStore } from "@/entities/form-submission";
import { useConsumerFormSubmitter } from "./use-consumer-form-submitter.hook";

// 1. 엔티티 쿼리 및 뮤테이션 모킹
const mockMutateAsync = vi.fn();
vi.mock("@/entities/form", () => ({
  useFormDetailQuery: vi.fn((formId: string) => ({
    data: {
      id: formId,
      title: "테스트 설문지",
      description: "테스트 설명",
      schemaDefinition: { fields: [] },
      isPublished: true,
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
    useSubmitFormMutation: vi.fn(() => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })),
  };
});

describe("useConsumerFormSubmitter (features/render-dynamic-form/hooks)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // 스토어 상태 초기화
    useConsumerFormDraftStore.getState().resetDraft();
  });

  const createWrapper = () => {
    return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
  };

  it("초기 마운트 시 폼 정보를 반환하고 드래프트 스토어의 폼 식별자를 동기화해야 한다", () => {
    const formId = "form-test-uuid-1";
    const { result } = renderHook(() => useConsumerFormSubmitter({ formId }), {
      wrapper: createWrapper(),
    });

    expect(result.current.form?.id).toBe(formId);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccessSubmitted).toBe(false);
    expect(useConsumerFormDraftStore.getState().currentFormId).toBe(formId);
  });

  it("언마운트 시 드래프트 스토어를 초기화(resetDraft)해야 한다", () => {
    const formId = "form-test-uuid-2";
    useConsumerFormDraftStore.getState().applyDraftFields(formId, { username: "홍길동" });

    const { unmount } = renderHook(() => useConsumerFormSubmitter({ formId }), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(useConsumerFormDraftStore.getState().draftValues).toEqual({});
  });

  it("handleSubmit 호출 시 서버 뮤테이션을 실행하고 성공 상태로 전이되어야 한다", async () => {
    const formId = "form-test-uuid-3";
    mockMutateAsync.mockResolvedValueOnce({ id: "sub-created-1" });

    const { result } = renderHook(() => useConsumerFormSubmitter({ formId }), {
      wrapper: createWrapper(),
    });

    const submitData = { answer: "좋습니다" };

    await act(async () => {
      await result.current.handleSubmit(submitData);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(submitData);
    expect(result.current.isSuccessSubmitted).toBe(true);
  });

  it("handleSubmit 실패 시 에러를 안전하게 방어하고 성공 상태로 전이되지 않아야 한다", async () => {
    const formId = "form-test-uuid-4";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockMutateAsync.mockRejectedValueOnce(new Error("네트워크 오류"));

    const { result } = renderHook(() => useConsumerFormSubmitter({ formId }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleSubmit({ answer: "에러테스트" });
    });

    expect(result.current.isSuccessSubmitted).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("원샷 이동(FILL_FIELDS + NAVIGATE)으로 마운트 전 선주입된 초안 데이터는 마운트 시 보존되어야 한다", () => {
    const formId = "form-test-uuid-5";
    useConsumerFormDraftStore.getState().applyDraftFields(formId, { title: "선주입 프로젝트" });

    const { result } = renderHook(() => useConsumerFormSubmitter({ formId }), {
      wrapper: createWrapper(),
    });

    expect(result.current.activeDraftValues).toEqual({ title: "선주입 프로젝트" });
  });
});
