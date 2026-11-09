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

  const mockSubmission = {
    id: "sub-1",
    formId: "form-1",
    data: { name: "홍길동" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    it("폼 제출 성공 시 캐시를 무효화해야 한다", async () => {
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
    });
  });

  describe("useUpdateSubmissionMutation", () => {
    it("응답 수정 성공 시 캐시를 무효화해야 한다", async () => {
      const updatedSubmission = { ...mockSubmission, data: { name: "김철수" } };
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: updatedSubmission }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateSubmissionMutation("daily-report"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          submissionId: "sub-1",
          data: { name: "김철수" },
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/forms/daily-report/submissions/sub-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ data: { name: "김철수" } }),
        })
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.byForm("daily-report"),
      });
    });
  });

  describe("useDeleteSubmissionMutation", () => {
    it("응답 삭제 성공 시 캐시를 무효화해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockSubmission }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDeleteSubmissionMutation("daily-report"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("sub-1");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/forms/daily-report/submissions/sub-1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: formSubmissionsKeys.byForm("daily-report"),
      });
    });
  });
});
