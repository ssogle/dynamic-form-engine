import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { SubmissionListTable } from "./submission-list-table";

const mockSubmissions: FormSubmission[] = [
  {
    id: "sub-1",
    formId: "form-uuid-1",
    data: {
      applicantName: "홍길동",
      yearsOfExperience: 5,
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
  },
];

const mockForm: Form = {
  id: "form-uuid-1",
  slug: "job-application",
  title: "개발자 채용 지원서",
  description: "멋진 개발팀에 합류하세요.",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  schemaDefinition: {
    fields: [
      {
        id: "f1",
        name: "applicantName",
        label: "지원자 이름",
        type: "text",
        required: true,
      },
      {
        id: "f2",
        name: "yearsOfExperience",
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
        data: mockSubmissions,
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
  });

  it("제출된 응답이 없는 경우 빈 상태 카드를 렌더링해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: [],
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("제출된 응답이 아직 없습니다")).toBeDefined();
    });
  });

  it("수정 버튼을 누르면 수정 다이얼로그가 열려야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: mockSubmissions,
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionListTable form={mockForm} />);

    await waitFor(() => {
      expect(screen.getByText("수정")).toBeDefined();
    });

    fireEvent.click(screen.getByText("수정"));

    expect(screen.getByText("제출된 응답 수정")).toBeDefined();
  });
});
