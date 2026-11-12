import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useSubmitFormMutation,
  useUpdateSubmissionMutation,
  useDeleteSubmissionMutation,
} from "./use-form-submissions.mutation";
import { formSubmissionsKeys } from "./form-submissions.keys";
import type { PaginatedSubmissionsResponse } from "../schema/submission-query.schema";
import type { FormSubmission } from "../schema/form-submission.schema";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
    },
  });

const createWrapper = (queryClient: QueryClient) => {
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("Submission Mutations (entities/form-submission/queries)", () => {
  let queryClient: QueryClient;

  const mockSubmission: FormSubmission = {
    id: "sub-1",
    formId: "form-1",
    data: { name: "홍길동" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
  };

  const mockSubmission2: FormSubmission = {
    id: "sub-2",
    formId: "form-1",
    data: { name: "이순신" },
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useSubmitFormMutation", () => {
    it("폼 제출 성공 시 단순 목록 및 무한 스크롤 목록 캐시를 무효화해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockSubmission }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSubmitFormMutation("daily-report"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ name: "홍길동" });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/forms/daily-report/submissions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: { name: "홍길동" } }),
        })
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.byForm("daily-report"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.infiniteRoot("daily-report"),
      });
    });
  });

  describe("useUpdateSubmissionMutation", () => {
    it("응답 수정 성공 시 무한 스크롤 캐시 내 해당 항목을 즉시 갱신해야 한다", async () => {
      const updatedSubmission = { ...mockSubmission, data: { name: "김철수" } };
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: updatedSubmission }),
      });
      vi.stubGlobal("fetch", mockFetch);

      // 사전 무한 스크롤 캐시 주입 (2개 아이템)
      const initialInfiniteData: InfiniteData<PaginatedSubmissionsResponse> = {
        pages: [
          {
            items: [mockSubmission, mockSubmission2],
            page: 1,
            limit: 20,
            totalCount: 2,
            totalPages: 1,
            hasMore: false,
          },
        ],
        pageParams: [1],
      };
      queryClient.setQueryData(formSubmissionsKeys.infinite("daily-report"), initialInfiniteData);

      const { result } = renderHook(() => useUpdateSubmissionMutation("daily-report"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          submissionId: "sub-1",
          data: { name: "김철수" },
        });
      });

      // 캐시 내 sub-1 아이템이 김철수로 변경되었는지 확인
      const cached = queryClient.getQueryData<InfiniteData<PaginatedSubmissionsResponse>>(
        formSubmissionsKeys.infinite("daily-report")
      );
      expect(cached?.pages[0]?.items[0]?.data).toEqual({ name: "김철수" });
      // 다른 아이템(sub-2)은 보존되어야 함
      expect(cached?.pages[0]?.items[1]?.id).toBe("sub-2");
    });
  });

  describe("useDeleteSubmissionMutation", () => {
    it("응답 삭제 성공 시 단건 캐시를 제거하고 무한 스크롤 캐시에서 해당 아이템만 정밀 삭제해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockSubmission }),
      });
      vi.stubGlobal("fetch", mockFetch);

      // 사전 무한 스크롤 캐시 주입 (1페이지에 sub-1, sub-2 존재)
      const initialInfiniteData: InfiniteData<PaginatedSubmissionsResponse> = {
        pages: [
          {
            items: [mockSubmission, mockSubmission2],
            page: 1,
            limit: 20,
            totalCount: 2,
            totalPages: 1,
            hasMore: false,
          },
        ],
        pageParams: [1],
      };
      queryClient.setQueryData(formSubmissionsKeys.infinite("daily-report"), initialInfiniteData);

      // 단건 상세 캐시도 사전 주입
      queryClient.setQueryData(formSubmissionsKeys.detail("sub-1"), mockSubmission);

      const removeQueriesSpy = vi.spyOn(queryClient, "removeQueries");
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDeleteSubmissionMutation("daily-report"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("sub-1");
      });

      // 1. 단건 상세 캐시 삭제 호출 검증
      expect(removeQueriesSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.detail("sub-1"),
      });

      // 2. 무한 스크롤 캐시에서 sub-1만 제거되고 sub-2는 온전히 남아있는지 검증
      const cached = queryClient.getQueryData<InfiniteData<PaginatedSubmissionsResponse>>(
        formSubmissionsKeys.infinite("daily-report")
      );
      expect(cached?.pages[0]?.items).toHaveLength(1);
      expect(cached?.pages[0]?.items[0]?.id).toBe("sub-2");
      expect(cached?.pages[0]?.totalCount).toBe(1);

      // 3. 백그라운드 무효화 호출 검증
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.byForm("daily-report"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.infiniteRoot("daily-report"),
        refetchType: "none",
      });
    });
  });
});
