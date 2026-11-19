import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActiveForm } from "@/entities/form";
import { useDynamicForm } from "./use-dynamic-form.hook";

// React Query 및 entities/form 모듈 모킹
const mockMutate = vi.fn();
const mockUseFormDetailQuery = vi.fn();
const mockUsePublishFormMutation = vi.fn();

vi.mock("@/entities/form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/form")>();
  return {
    ...actual,
    useFormDetailQuery: (id: string, options: { enabled: boolean }) =>
      mockUseFormDetailQuery(id, options),
    usePublishFormMutation: () => mockUsePublishFormMutation(),
  };
});

describe("useDynamicForm (features/render-dynamic-form/hooks)", () => {
  const dummyForm: ActiveForm = {
    id: "form-uuid-1",
    title: "설문조사 폼",
    description: "테스트 설문조사입니다.",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    fields: [
      {
        id: "field-1",
        label: "이름",
        type: "text",
        placeholder: "이름을 입력하세요",
        required: true,
        description: "응답자의 실명을 입력합니다.",
      },
      {
        id: "field-2",
        label: "나이",
        type: "number",
        required: false,
        description: "응답자의 만 나이를 입력합니다.",
      },
      {
        id: "field-deleted",
        label: "삭제된 필드",
        type: "text",
        required: false,
        description: "더 이상 수집하지 않는 항목입니다.",
        deletedAt: "2026-01-02T00:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockReset();
    mockUsePublishFormMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    mockUseFormDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("직접 주입된 form 객체로부터 활성 필드를 필터링하고 RHF 기본값(field.id 키 기반)을 올바르게 설정해야 한다", () => {
    const { result } = renderHook(() =>
      useDynamicForm({
        form: dummyForm,
        mode: "submission",
      })
    );

    expect(result.current.activeForm).toEqual(dummyForm);
    // 삭제된 필드 제외 2개 필드만 추출되어야 함
    expect(result.current.activeFields).toHaveLength(2);
    expect(result.current.activeFields.map((f) => f.label)).toEqual(["이름", "나이"]);
    expect(result.current.isPublished).toBe(true);

    // React Hook Form 초기 기본값 확인 (field.id 기준 매핑)
    expect(result.current.methods.getValues()).toEqual({
      "field-1": "",
      "field-2": undefined,
    });
  });

  it("values prop이 변경되어 전달되면 React Hook Form 내부 값에 동기화되어야 한다", async () => {
    const { result, rerender } = renderHook(
      (props: { values?: Record<string, unknown> | undefined }) =>
        useDynamicForm({
          form: dummyForm,
          values: props.values,
          mode: "submission",
        }),
      {
        initialProps: { values: undefined as Record<string, unknown> | undefined },
      }
    );

    expect(result.current.methods.getValues("field-1")).toBe("");

    // 외부에서 새 값 주입 (field.id 키 기준)
    rerender({
      values: {
        "field-1": "홍길동",
        "field-2": 30,
      },
    });

    await waitFor(() => {
      expect(result.current.methods.getValues("field-1")).toBe("홍길동");
      expect(result.current.methods.getValues("field-2")).toBe(30);
    });
  });

  it("submitTriggerCount가 증가하면 자동으로 폼 유효성 검사 후 onSubmit을 호출해야 한다", async () => {
    const onSubmitMock = vi.fn();
    const { rerender } = renderHook(
      ({ triggerCount }: { triggerCount: number }) =>
        useDynamicForm({
          form: dummyForm,
          mode: "submission",
          onSubmit: onSubmitMock,
          submitTriggerCount: triggerCount,
          values: { "field-1": "홍길동" },
        }),
      {
        initialProps: { triggerCount: 0 },
      }
    );

    expect(onSubmitMock).not.toHaveBeenCalled();

    // submitTriggerCount 증가 시뮬레이션
    rerender({ triggerCount: 1 });

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          "field-1": "홍길동",
        })
      );
    });
  });

  it("formId만 주어졌을 때 useFormDetailQuery를 활성화하고 발행 토글을 호출할 수 있어야 한다", () => {
    mockUseFormDetailQuery.mockReturnValue({
      data: dummyForm,
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useDynamicForm({
        formId: "form-uuid-1",
        mode: "preview",
      })
    );

    expect(result.current.activeForm).toEqual(dummyForm);
    expect(result.current.isPublished).toBe(true);

    // 발행 토글 실행
    act(() => {
      result.current.handlePublishToggle();
    });

    expect(mockMutate).toHaveBeenCalledWith({
      id: "form-uuid-1",
      isPublished: false,
    });
  });

  it("사용자 직접 입력(RHF 변경)은 onValuesChange로 역동기화하고 외부 values prop 주입은 재방출하지 않아야 한다", async () => {
    const onValuesChangeMock = vi.fn();
    const { result, rerender } = renderHook(
      (props: { values?: Record<string, unknown> | undefined }) =>
        useDynamicForm({
          form: dummyForm,
          mode: "submission",
          values: props.values,
          onValuesChange: onValuesChangeMock,
        }),
      {
        initialProps: { values: undefined as Record<string, unknown> | undefined },
      }
    );

    // 1. 외부 values prop 반영 시 onValuesChange 루프 재방출이 없어야 함
    rerender({ values: { "field-1": "AI입력" } });
    await waitFor(() => {
      expect(result.current.methods.getValues("field-1")).toBe("AI입력");
    });
    expect(onValuesChangeMock).not.toHaveBeenCalled();

    // 2. 사용자가 직접 폼 값을 변경하면 onValuesChange가 최신 스냅샷과 함께 호출되어야 함
    act(() => {
      result.current.methods.setValue("field-1", "사용자직접수정", {
        shouldDirty: true,
        shouldValidate: true,
      });
    });

    expect(onValuesChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        "field-1": "사용자직접수정",
      })
    );
  });
});
