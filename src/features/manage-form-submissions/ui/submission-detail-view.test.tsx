import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import { SubmissionDetailView } from "./submission-detail-view";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockForm: Form = {
  id: "form-uuid-1",
  title: "개발자 채용 지원서",
  description: "합류를 환영합니다.",
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
        label: "자기소개",
        type: "textarea",
        required: false,
      },
      {
        id: "f3",
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

const mockSubmission: FormSubmission = {
  id: "sub-uuid-9999",
  formId: "form-uuid-1",
  data: {
    f1: "홍길동",
    f2: "풀스택 엔지니어입니다.\n잘 부탁드립니다.",
    f3: 7,
  },
  createdAt: new Date("2026-01-02T10:00:00.000Z"),
  updatedAt: new Date("2026-01-03T15:30:00.000Z"),
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

describe("SubmissionDetailView (features/manage-form-submissions/ui)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
  });

  it("폼 정보와 제출된 응답 상세 데이터(필드값, 일시 메타데이터)를 정상 렌더링해야 한다", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/forms/form-uuid-1/submissions/sub-uuid-9999")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: mockSubmission,
          }),
        });
      }
      if (url.includes("/api/v1/forms/form-uuid-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: mockForm,
          }),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionDetailView formId="form-uuid-1" submissionId="sub-uuid-9999" />);

    // 폼 타이틀 및 설명 확인
    await waitFor(() => {
      expect(screen.getByText("개발자 채용 지원서")).toBeDefined();
      expect(screen.getByText("합류를 환영합니다.")).toBeDefined();
    });

    // 식별자 및 일시 메타데이터 확인
    expect(screen.getByText(/sub-uuid/)).toBeDefined();
    expect(screen.getByText("최초 제출 일시")).toBeDefined();
    expect(screen.getByText("최종 수정 일시")).toBeDefined();

    // 활성 필드 및 응답 값 확인
    expect(screen.getByText("지원자 이름")).toBeDefined();
    expect(screen.getByText("홍길동")).toBeDefined();
    expect(screen.getByText("자기소개")).toBeDefined();
    expect(screen.getByText(/풀스택 엔지니어입니다/)).toBeDefined();
    expect(screen.getByText("경력 연수")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();

    // 상단 네비게이션 및 수정 링크 href 확인
    const backLinks = screen.getAllByRole("link", { name: /데이터 목록/ });
    expect(backLinks.length).toBeGreaterThanOrEqual(1);
    expect(backLinks[0]?.getAttribute("href")).toBe("/consumer/forms/form-uuid-1");

    const editLink = screen.getByRole("link", { name: /수정하기/ });
    expect(editLink.getAttribute("href")).toBe(
      "/consumer/forms/form-uuid-1/submissions/sub-uuid-9999/edit"
    );
  });

  it("삭제 버튼 클릭 및 컨펌 확인 시 삭제 API를 호출하고 목록 페이지로 라우팅해야 한다", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (
        url.includes("/api/v1/forms/form-uuid-1/submissions/sub-uuid-9999") &&
        options?.method === "DELETE"
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ success: true }),
        });
      }
      if (url.includes("/api/v1/forms/form-uuid-1/submissions/sub-uuid-9999")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: mockSubmission,
          }),
        });
      }
      if (url.includes("/api/v1/forms/form-uuid-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: mockForm,
          }),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionDetailView formId="form-uuid-1" submissionId="sub-uuid-9999" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /삭제하기/ })).toBeDefined();
    });

    const deleteBtn = screen.getByRole("button", { name: /삭제하기/ });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("응답을 삭제하시겠습니까?")).toBeDefined();
      expect(screen.getByRole("button", { name: "삭제 확인" })).toBeDefined();
    });

    const confirmBtn = screen.getByRole("button", { name: "삭제 확인" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/consumer/forms/form-uuid-1");
    });
  });

  it("데이터 조회 실패 시 에러 카드와 목록 복귀 링크를 렌더링해야 한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: { code: "NOT_FOUND", message: "존재하지 않는 응답입니다." },
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    renderWithClient(<SubmissionDetailView formId="form-uuid-1" submissionId="not-found-id" />);

    await waitFor(() => {
      expect(screen.getByText("응답 상세 조회 실패")).toBeDefined();
    });

    expect(screen.getByRole("link", { name: /데이터 목록으로 돌아가기/ })).toBeDefined();
  });
});
