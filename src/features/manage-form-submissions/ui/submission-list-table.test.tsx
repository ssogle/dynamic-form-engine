import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { SubmissionListTable, SYSTEM_COLUMN_LABELS } from "./submission-list-table";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSubmissions: FormSubmission[] = [
  {
    id: "sub-1",
    formId: "form-uuid-1",
    data: {
      f1: "홍길동",
      f2: 5,
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
  },
];

const mockForm: Form = {
  id: "form-uuid-1",
  title: "개발자 채용 지원서",
  description: "멋진 개발팀에 합류하세요.",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  schemaDefinition: {
    fields: [
      {
        id: "f1",
        label: "지원자 이름",
        type: "text",
        required: true,
      },
      {
        id: "f2",
        label: "경력 연수",
        type: "number",
        required: true,
      },
    ],
  },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("SubmissionListTable (features/manage-form-submissions/ui)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("제출된 응답 목록과 필드 값이 화면 테이블에 렌더링되어야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: {
          items: mockSubmissions,
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("홍길동")).toBeDefined();
      expect(screen.getByText("5")).toBeDefined();
    });

    expect(screen.getByText("지원자 이름")).toBeDefined();
    expect(screen.getByText("경력 연수")).toBeDefined();
    expect(screen.getByText(SYSTEM_COLUMN_LABELS.createdAt)).toBeDefined();
    expect(screen.getByText(SYSTEM_COLUMN_LABELS.updatedAt)).toBeDefined();
    expect(screen.getByText(SYSTEM_COLUMN_LABELS.actions)).toBeDefined();
  });

  it("컬럼 표시 팝오버에서 영문 컬럼 ID 대신 친화적인 한글 레이블을 노출해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: {
          items: mockSubmissions,
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("컬럼 표시")).toBeDefined();
    });

    // 컬럼 표시 버튼 클릭하여 팝오버 열기
    const columnVisibilityBtn = screen.getByRole("button", { name: /컬럼 표시/ });
    fireEvent.click(columnVisibilityBtn);

    await waitFor(() => {
      expect(screen.getByText("표시할 컬럼 선택")).toBeDefined();
    });

    // 체크박스 레이블에 'createdAt', 'updatedAt' 영문 ID 대신 한글 명칭이 노출되는지 검증
    expect(screen.getAllByText(SYSTEM_COLUMN_LABELS.createdAt).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(SYSTEM_COLUMN_LABELS.updatedAt).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("createdAt")).toBeNull();
    expect(screen.queryByText("updatedAt")).toBeNull();
  });

  it("제출된 응답이 없는 경우 빈 상태 카드를 렌더링해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: {
          items: [],
          page: 1,
          limit: 20,
          totalCount: 0,
          totalPages: 0,
          hasMore: false,
        },
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("제출된 응답이 아직 없습니다")).toBeDefined();
    });
  });

  it("상세 버튼 및 수정 버튼이 해당 응답의 상세/수정 링크로 렌더링되어야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: {
          items: mockSubmissions,
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("상세")).toBeDefined();
      expect(screen.getByText("수정")).toBeDefined();
    });

    const detailLink = screen.getByRole("link", { name: "상세" });
    expect(detailLink.getAttribute("href")).toBe(
      `/consumer/forms/${mockForm.id}/submissions/sub-1`
    );

    const editLink = screen.getByRole("link", { name: "수정" });
    expect(editLink.getAttribute("href")).toBe(
      `/consumer/forms/${mockForm.id}/submissions/sub-1/edit`
    );
  });

  it("삭제 버튼 클릭 시 확인 팝오버가 표시되고, 삭제 확인 클릭 시 DELETE API가 호출되어야 한다", async () => {
    let deleteCalled = false;
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ success: true }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            items: mockSubmissions,
            page: 1,
            limit: 20,
            totalCount: 1,
            totalPages: 1,
            hasMore: false,
          },
        }),
      } as unknown as Response);
    });
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("삭제")).toBeDefined();
    });

    const deleteTrigger = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteTrigger);

    await waitFor(() => {
      expect(screen.getByText("응답을 삭제하시겠습니까?")).toBeDefined();
      expect(screen.getByText("삭제 확인")).toBeDefined();
    });

    const confirmButton = screen.getByRole("button", { name: "삭제 확인" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });
});
