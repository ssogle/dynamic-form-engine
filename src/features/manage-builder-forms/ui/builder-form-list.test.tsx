import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as formEntity from "@/entities/form";
import { BuilderFormList } from "./builder-form-list";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("BuilderFormList (features/manage-builder-forms)", () => {
  const mockDeleteMutate = vi.fn();
  const mockPublishMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(formEntity, "useDeleteFormMutation").mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof formEntity.useDeleteFormMutation>);
    vi.spyOn(formEntity, "usePublishFormMutation").mockReturnValue({
      mutate: mockPublishMutate,
      isPending: false,
    } as unknown as ReturnType<typeof formEntity.usePublishFormMutation>);
  });

  it("로딩 중일 때 스켈레톤 로딩 상태를 표시해야 한다", () => {
    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<BuilderFormList />);

    expect(screen.getByText("폼 목록을 불러오는 중...")).toBeInTheDocument();
  });

  it("폼 데이터가 없을 때 빈 목록 안내 문구를 표시해야 한다", () => {
    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<BuilderFormList />);

    expect(screen.getByText("등록된 폼이 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByText(/AI Navigator 대화창에 자연어로 새로운 폼 생성을 요청해 보세요/)
    ).toBeInTheDocument();
  });

  it("폼 목록이 존재할 때 제목, ID 요약, 설명이 카드에 정상 렌더링되어야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "일일 업무 보고서",
        description: "매일 진행한 업무 내용을 기록합니다.",
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        publishedAt: new Date("2026-11-08T00:00:00Z"),
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<BuilderFormList />);

    expect(screen.getByText("일일 업무 보고서")).toBeInTheDocument();
    expect(screen.getByText(/ID: a0eebc99\.\.\./)).toBeInTheDocument();
    expect(screen.getByText("매일 진행한 업무 내용을 기록합니다.")).toBeInTheDocument();
    expect(screen.getByText("발행됨")).toBeInTheDocument();
    expect(screen.getByText(/2026\.11\.08 발행/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "캔버스 열기" })).toHaveAttribute(
      "href",
      "/builder/forms/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    );
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("삭제 버튼 클릭 시 소프트 삭제를 요청해야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "일일 업무 보고서",
        description: "매일 진행한 업무 내용을 기록합니다.",
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        publishedAt: null,
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<BuilderFormList />);

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  });

  it("미발행 폼의 발행 버튼 클릭 시 발행 뮤테이션을 호출해야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "일일 업무 보고서",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        publishedAt: null,
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<BuilderFormList />);

    const publishButton = screen.getByRole("button", { name: "발행" });
    fireEvent.click(publishButton);

    expect(mockPublishMutate).toHaveBeenCalledWith({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      isPublished: true,
    });
  });

  it("이미 발행된 폼의 발행 취소 버튼 클릭 시 회수 뮤테이션을 호출해야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "일일 업무 보고서",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        publishedAt: new Date("2026-11-10T00:00:00Z"),
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<BuilderFormList />);

    const unpublishButton = screen.getByRole("button", { name: "발행 취소" });
    fireEvent.click(unpublishButton);

    expect(mockPublishMutate).toHaveBeenCalledWith({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      isPublished: false,
    });
  });
});
