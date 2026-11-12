import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { useSubmissionDetailView } from "./use-submission-detail-view.hook";

// Router 모킹
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// entities 모킹
const mockUseFormDetailQuery = vi.fn();
const mockUseFormSubmissionDetailQuery = vi.fn();
const mockUseRelatedSubmissionsQuery = vi.fn();
const mockDeleteSubmission = vi.fn();

vi.mock("@/entities/form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form")>();
  return {
    ...actual,
    useFormDetailQuery: (formId: string) => mockUseFormDetailQuery(formId),
  };
});

vi.mock("@/entities/form-submission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form-submission")>();
  return {
    ...actual,
    useFormSubmissionDetailQuery: (formId: string, subId: string) =>
      mockUseFormSubmissionDetailQuery(formId, subId),
    useRelatedSubmissionsQuery: (subId: string) => mockUseRelatedSubmissionsQuery(subId),
    useDeleteSubmissionMutation: () => ({
      mutateAsync: mockDeleteSubmission,
    }),
  };
});

describe("useSubmissionDetailView (features/manage-form-submissions/hooks)", () => {
  const dummyForm: Form = {
    id: "form-uuid-1",
    title: "상세 테스트 폼",
    description: "설명",
    schemaDefinition: {
      version: "1.0",
      fields: [
        {
          id: "field-1",
          label: "이름",
          type: "text",
          required: true,
          description: "응답자의 이름을 기록합니다.",
          order: 0,
        },
      ],
    },
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };

  const dummySubmission: FormSubmission = {
    id: "sub-1",
    formId: "form-uuid-1",
    data: { "field-1": "홍길동" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
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
    mockUseFormSubmissionDetailQuery.mockReturnValue({
      data: dummySubmission,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseRelatedSubmissionsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  it("폼과 제출 데이터가 성공적으로 로드되면 activeFields와 submittedData를 올바르게 계산해야 한다", () => {
    const { result } = renderHook(() =>
      useSubmissionDetailView({
        formId: "form-uuid-1",
        submissionId: "sub-1",
      })
    );

    expect(result.current.form).toEqual(dummyForm);
    expect(result.current.submission).toEqual(dummySubmission);
    expect(result.current.activeFields).toHaveLength(1);
    expect(result.current.submittedData).toEqual({ "field-1": "홍길동" });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("handleDelete 호출 성공 시 삭제 뮤테이션을 실행하고 목록 페이지로 라우팅해야 한다", async () => {
    mockDeleteSubmission.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() =>
      useSubmissionDetailView({
        formId: "form-uuid-1",
        submissionId: "sub-1",
      })
    );

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(mockDeleteSubmission).toHaveBeenCalledWith("sub-1");
    expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-uuid-1");
  });

  it("selectedGroupIndex 변경 및 delete 팝오버 상태 제어가 정상 동작해야 한다", () => {
    const { result } = renderHook(() =>
      useSubmissionDetailView({
        formId: "form-uuid-1",
        submissionId: "sub-1",
      })
    );

    expect(result.current.selectedGroupIndex).toBe(0);
    expect(result.current.isDeleteOpen).toBe(false);

    act(() => {
      result.current.setSelectedGroupIndex(2);
      result.current.setIsDeleteOpen(true);
    });

    expect(result.current.selectedGroupIndex).toBe(2);
    expect(result.current.isDeleteOpen).toBe(true);
  });
});
