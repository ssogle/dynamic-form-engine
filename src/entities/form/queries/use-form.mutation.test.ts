import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createForm,
  deleteForm,
  publishForm,
  updateForm,
  useCreateFormMutation,
  useDeleteFormMutation,
  usePublishFormMutation,
  useUpdateFormMutation,
} from "./use-form.mutation";

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
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("useFormMutation (엔티티 공용 폼 조작 뮤테이션 훅)", () => {
  let queryClient: QueryClient;

  const sampleForm = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    title: "샘플 폼",
    description: "설명",
    schemaDefinition: { fields: [] },
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

  describe("createForm & useCreateFormMutation", () => {
    it("createForm 함수가 /api/v1/forms POST 요청을 수행해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: sampleForm }),
      } as unknown as Response);
      vi.stubGlobal("fetch", mockFetch);

      const input = {
        title: "샘플 폼",
        schemaDefinition: { fields: [] },
      };

      const result = await createForm(input);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/forms",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(input),
        })
      );
      expect(result).toEqual(sampleForm);
    });

    it("useCreateFormMutation 성공 시 캐시를 무효화해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: sampleForm }),
      } as unknown as Response);

      const { result } = renderHook(() => useCreateFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          title: "샘플 폼",
          schemaDefinition: { fields: [] },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe("updateForm & useUpdateFormMutation", () => {
    it("updateForm 함수가 /api/v1/forms/[id] PATCH 요청을 수행해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { ...sampleForm, title: "수정됨" } }),
      } as unknown as Response);
      vi.stubGlobal("fetch", mockFetch);

      const result = await updateForm(sampleForm.id, { title: "수정됨" });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/forms/${sampleForm.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "수정됨" }),
        })
      );
      expect(result.title).toBe("수정됨");
    });

    it("useUpdateFormMutation 성공 시 캐시를 무효화해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { ...sampleForm, title: "수정됨" } }),
      } as unknown as Response);

      const { result } = renderHook(() => useUpdateFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: sampleForm.id,
          data: { title: "수정됨" },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe("deleteForm & useDeleteFormMutation", () => {
    it("deleteForm 함수가 /api/v1/forms/[id] DELETE 요청을 수행해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { ...sampleForm, deletedAt: "2026-01-01" } }),
      } as unknown as Response);
      vi.stubGlobal("fetch", mockFetch);

      const result = await deleteForm(sampleForm.id);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/forms/${sampleForm.id}`,
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.deletedAt).toBeDefined();
    });

    it("useDeleteFormMutation 성공 시 캐시를 무효화해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { ...sampleForm, deletedAt: "2026-01-01" } }),
      } as unknown as Response);

      const { result } = renderHook(() => useDeleteFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(sampleForm.id);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe("publishForm & usePublishFormMutation", () => {
    it("publishForm 함수가 /api/v1/forms/[id]/publish POST 요청을 수행해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { ...sampleForm, publishedAt: "2026-11-10T09:30:00Z" },
        }),
      } as unknown as Response);
      vi.stubGlobal("fetch", mockFetch);

      const result = await publishForm(sampleForm.id, true);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/forms/${sampleForm.id}/publish`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ isPublished: true }),
        })
      );
      expect(result.publishedAt).toBeDefined();
    });

    it("usePublishFormMutation 성공 시 캐시를 무효화해야 한다", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { ...sampleForm, publishedAt: "2026-11-10T09:30:00Z" },
        }),
      } as unknown as Response);

      const { result } = renderHook(() => usePublishFormMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: sampleForm.id, isPublished: true });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});
