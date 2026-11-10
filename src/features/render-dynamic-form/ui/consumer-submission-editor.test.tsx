import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Form } from "@/entities/form";
import { type FormSubmission, useConsumerFormDraftStore } from "@/entities/form-submission";
import { ConsumerSubmissionEditor } from "./consumer-submission-editor";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockForm: Form = {
  id: "form-uuid-1",
  title: "개발자 채용 지원서",
  description: "멋진 팀에서 일해요",
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
        required: false,
      },
    ],
  },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
};

const mockSubmission: FormSubmission = {
  id: "sub-uuid-1",
  formId: "form-uuid-1",
  data: {
    f1: "홍길동",
    f2: 5,
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

describe("ConsumerSubmissionEditor (features/render-dynamic-form)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("폼 및 응답 데이터가 로드되면 기존 제출 데이터가 폼 필드에 채워져 렌더링되어야 한다", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/submissions/sub-uuid-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ success: true, data: mockSubmission }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockForm }),
      } as unknown as Response);
    });
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<ConsumerSubmissionEditor formId="form-uuid-1" submissionId="sub-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByText(/개발자 채용 지원서.*응답 수정/)).toBeDefined();
    });

    expect(screen.getByDisplayValue("홍길동")).toBeDefined();
    expect(screen.getByDisplayValue("5")).toBeDefined();
  });

  it("폼 데이터 수정 후 제출 버튼을 클릭하면 PATCH API가 호출되고 성공 화면이 표시되어야 한다", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: {
              ...mockSubmission,
              data: { f1: "이순신", f2: 5 },
            },
          }),
        } as unknown as Response);
      }
      if (url.includes("/submissions/sub-uuid-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ success: true, data: mockSubmission }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockForm }),
      } as unknown as Response);
    });
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<ConsumerSubmissionEditor formId="form-uuid-1" submissionId="sub-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("홍길동")).toBeDefined();
    });

    const nameInput = screen.getByDisplayValue("홍길동");
    fireEvent.change(nameInput, { target: { value: "이순신" } });

    const submitBtn = screen.getByRole("button", { name: "응답 제출하기" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("응답이 성공적으로 수정되었습니다!")).toBeDefined();
    });
  });

  it("AI Navigator 초안 스토어에 의해 필드값이 외부에서 주입되면 폼에 즉각 반영되어야 한다", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/submissions/sub-uuid-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ success: true, data: mockSubmission }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: mockForm }),
      } as unknown as Response);
    });
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<ConsumerSubmissionEditor formId="form-uuid-1" submissionId="sub-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("홍길동")).toBeDefined();
    });

    // AI Navigator가 store에 새 필드값을 주입한 상황 시뮬레이션
    act(() => {
      useConsumerFormDraftStore.getState().applyDraftFields("form-uuid-1", {
        f1: "강감찬",
      });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("강감찬")).toBeDefined();
    });
  });
});
