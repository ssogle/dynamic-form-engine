import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateSampleFormMutation,
  useDeleteFormMutation,
  useFormsQuery,
  useUpdateFormMutation,
} from "./use-forms.query";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const createWrapper = (queryClient: QueryClient) => {
  return function TestWrapper({ children }: { readonly children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("useFormsQuery & Mutations (폼 쿼리 및 뮤테이션 훅)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useFormsQuery", () => {
    it("서버로부터 폼 목록을 성공적으로 받아와야 한다", async () => {
      const mockForms = [
        {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          slug: "sample-form",
          title: "샘플 폼 제목",
          description: "샘플 폼 설명",
          schemaDefinition: { fields: [] },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: mockForms,
        }),
      } as Response);

      const { result } = renderHook(() => useFormsQuery(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0]?.slug).toBe("sample-form");
      expect(result.current.data?.[0]?.title).toBe("샘플 폼 제목");
    });
  });

  describe("useCreateSampleFormMutation", () => {
    it("샘플 폼 생성 요청 성공 시 쿼리를 무효화하고 생성된 데이터를 반환해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const createdForm = {
        id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        slug: "new-sample",
        title: "새로운 샘플",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: createdForm,
        }),
      } as Response);

      const { result } = renderHook(() => useCreateSampleFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          slug: "new-sample",
          title: "새로운 샘플",
          schemaDefinition: { fields: [] },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.id).toBe(createdForm.id);
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe("useUpdateFormMutation", () => {
    it("폼 수정 성공 시 쿼리를 무효화하고 수정된 데이터를 반환해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const formId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

      const updatedForm = {
        id: formId,
        slug: "sample-form",
        title: "수정된 폼 제목",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: updatedForm,
        }),
      } as Response);

      const { result } = renderHook(() => useUpdateFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: formId,
          data: { title: "수정된 폼 제목" },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.title).toBe("수정된 폼 제목");
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe("useDeleteFormMutation", () => {
    it("폼 소프트 삭제 성공 시 쿼리를 무효화해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const formId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: formId, deletedAt: new Date().toISOString() },
        }),
      } as Response);

      const { result } = renderHook(() => useDeleteFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(formId);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});
