import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as formEntity from "@/entities/form";
import { FormList } from "./form-list";

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

describe("FormList (폼 목록 컴포넌트)", () => {
  const mockCreateMutate = vi.fn();
  const mockUpdateMutate = vi.fn();
  const mockDeleteMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(formEntity, "useCreateFormMutation").mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof formEntity.useCreateFormMutation>);

    vi.spyOn(formEntity, "useUpdateFormMutation").mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof formEntity.useUpdateFormMutation>);

    vi.spyOn(formEntity, "useDeleteFormMutation").mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof formEntity.useDeleteFormMutation>);
  });

  it("로딩 중일 때 스켈레톤 로딩 상태를 표시해야 한다", () => {
    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<FormList />);

    expect(screen.getByText("폼 목록을 불러오는 중...")).toBeInTheDocument();
  });

  it("폼 데이터가 없을 때 빈 목록 안내 문구와 샘플 생성 버튼을 표시해야 한다", () => {
    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<FormList />);

    expect(screen.getByText("등록된 폼이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /샘플 폼 생성/i })).toBeInTheDocument();
  });

  it("폼 목록이 존재할 때 제목, 슬러그, 설명이 카드에 정상 렌더링되어야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        slug: "daily-report",
        title: "일일 업무 보고서",
        description: "매일 진행한 업무 내용을 기록합니다.",
        schemaDefinition: { fields: [] },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<FormList />);

    expect(screen.getByText("일일 업무 보고서")).toBeInTheDocument();
    expect(screen.getByText("daily-report")).toBeInTheDocument();
    expect(screen.getByText("매일 진행한 업무 내용을 기록합니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "캔버스 열기" })).toHaveAttribute(
      "href",
      "/builder/forms/daily-report"
    );
  });

  it("샘플 폼 생성 버튼 클릭 시 새로운 폼 생성을 요청해야 한다", () => {
    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<FormList />);

    const button = screen.getByRole("button", { name: /샘플 폼 생성/i });
    fireEvent.click(button);

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        slug: expect.any(String),
        schemaDefinition: expect.any(Object),
      })
    );
  });

  it("수정 버튼 클릭 시 제목 부분 수정을 요청해야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        slug: "daily-report",
        title: "일일 업무 보고서",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<FormList />);

    const updateButton = screen.getByRole("button", { name: "수정" });
    fireEvent.click(updateButton);

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      data: { title: "일일 업무 보고서 (수정됨)" },
    });
  });

  it("삭제 버튼 클릭 시 소프트 삭제를 요청해야 한다", () => {
    const mockForms = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        slug: "daily-report",
        title: "일일 업무 보고서",
        description: null,
        schemaDefinition: { fields: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    vi.spyOn(formEntity, "useFormsQuery").mockReturnValue({
      data: mockForms,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof formEntity.useFormsQuery>);

    renderWithClient(<FormList />);

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteButton);

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).toHaveBeenCalledWith("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  });
});
