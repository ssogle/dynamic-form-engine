"use client";

import * as React from "react";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFormDetailQuery,
  usePublishFormMutation,
  extractActiveFields,
  buildDynamicFormSchema,
  type ActiveForm,
  type Form,
  type CoreFormField,
} from "@/entities/form";
import { buildDefaultValues } from "../lib/build-default-values";

export interface UseDynamicFormOptions {
  /**
   * 직접 전달된 폼 상세 데이터 (부모에서 이미 로드된 경우)
   */
  form?: ActiveForm | Form | null | undefined;
  /**
   * 폼 조회를 위한 식별자 (form이 없는 경우 useFormDetailQuery 실행)
   */
  formId?: string | undefined;
  /**
   * 렌더링 모드 ("submission": 제출 모드, "preview": 미리보기 인터랙션 모드)
   */
  mode?: "preview" | "submission" | undefined;
  /**
   * 외부 또는 AI Navigator로부터 주입되는 동적 필드 값 객체
   */
  values?: Record<string, unknown> | undefined;
  /**
   * 사용자가 키보드·마우스로 폼 입력값을 변경했을 때 현재 전체 값 스냅샷을 알리는 콜백
   */
  onValuesChange?: ((values: Record<string, unknown>) => void) | undefined;
  /**
   * AI Navigator 또는 상위에서 프로그래밍 방식으로 폼 제출을 트리거하는 카운터
   */
  submitTriggerCount?: number | undefined;
  /**
   * 폼 유효성 검사 통과 시 실행될 최종 제출 콜백 함수
   */
  onSubmit?: ((data: Record<string, unknown>) => void | Promise<void>) | undefined;
}

export interface UseDynamicFormReturn {
  /**
   * 최종 확정된 폼 상세 데이터 (props 또는 query 결과)
   */
  activeForm: ActiveForm | Form | null;
  /**
   * 소프트 삭제가 제외된 유효 활성 필드 목록
   */
  activeFields: CoreFormField[];
  /**
   * React Hook Form 인스턴스 (FormProvider 전달 및 필드 바인딩용)
   */
  methods: UseFormReturn<FieldValues>;
  /**
   * 폼 상세 정보 쿼리 로딩 상태
   */
  isLoading: boolean;
  /**
   * 폼 상세 정보 쿼리 실패 여부
   */
  isError: boolean;
  /**
   * 폼 상세 정보 쿼리 에러 객체
   */
  error: unknown;
  /**
   * 폼 발행 완료 여부
   */
  isPublished: boolean;
  /**
   * 폼 발행/취소 뮤테이션 진행 중 여부
   */
  isPublishPending: boolean;
  /**
   * 폼 발행/취소 상태 토글 핸들러
   */
  handlePublishToggle: () => void;
  /**
   * 폼 제출 이벤트 핸들러
   */
  handleFormSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

function areFieldValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, idx) => Object.is(item, b[idx]));
  }
  return false;
}

function areDefaultValueMapsEqual(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  return nextKeys.every((key) => areFieldValuesEqual(prev[key], next[key]));
}

/**
 * 동적 폼 렌더링 및 유효성 검사, 비즈니스 오케스트레이션 전용 커스텀 훅 (useDynamicForm)
 *
 * 폼 상세 쿼리 조회, Zod 유효성 스키마 동적 조립, React Hook Form 인스턴스 라이프사이클,
 * 외부 값(AI Navigator) 및 사용자 수동 입력 양방향 동기화, 자동 제출 트리거 로직을 캡슐화합니다.
 */
export function useDynamicForm({
  form: propForm,
  formId,
  mode = "submission",
  values,
  onValuesChange,
  submitTriggerCount,
  onSubmit,
}: UseDynamicFormOptions): UseDynamicFormReturn {
  // 1. props.formId가 존재하고 propForm이 없는 경우 TanStack Query로 폼 상세 정보 자동 조회
  const shouldFetch = Boolean(formId && !propForm);
  const publishFormMutation = usePublishFormMutation();
  const {
    data: fetchedForm,
    isLoading,
    isError,
    error,
  } = useFormDetailQuery(formId ?? "", { enabled: shouldFetch });

  // 2. 최종 렌더링 대상 폼 데이터 결정
  const activeForm = propForm ?? fetchedForm ?? null;

  // 3. 소프트 삭제 제외된 활성 필드 목록 추출
  const activeFields = React.useMemo(() => extractActiveFields(activeForm), [activeForm]);

  // 4. 활성 필드 메타데이터 기반 동적 Zod 스키마 조립
  const validationSchema = React.useMemo(
    () => buildDynamicFormSchema(activeFields),
    [activeFields]
  );

  // 5. 기본값 객체 계산
  const defaultValues = React.useMemo(() => buildDefaultValues(activeFields), [activeFields]);

  // 6. React Hook Form 인스턴스 초기화
  const methods = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
    mode: "onBlur",
  });

  const isApplyingExternalValuesRef = React.useRef(false);
  const hasPopulatedValuesRef = React.useRef(false);
  const prevDefaultValuesRef = React.useRef<Record<string, unknown>>(defaultValues);
  const onValuesChangeRef = React.useRef(onValuesChange);
  React.useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);

  // 7. 외부 또는 AI Navigator로부터 주입된 필드값 동기화 (동일 값 덮어쓰기 및 역동기화 루프 방지)
  React.useEffect(() => {
    const defaultsChanged = !areDefaultValueMapsEqual(prevDefaultValuesRef.current, defaultValues);
    prevDefaultValuesRef.current = defaultValues;

    isApplyingExternalValuesRef.current = true;
    try {
      if (values && Object.keys(values).length > 0) {
        hasPopulatedValuesRef.current = true;
        for (const [key, val] of Object.entries(values)) {
          if (val !== undefined && !areFieldValuesEqual(methods.getValues(key), val)) {
            methods.setValue(key, val, { shouldValidate: true, shouldDirty: true });
          }
        }
      } else if (hasPopulatedValuesRef.current || defaultsChanged) {
        hasPopulatedValuesRef.current = false;
        methods.reset(defaultValues);
      }
    } finally {
      isApplyingExternalValuesRef.current = false;
    }
  }, [values, methods, defaultValues]);

  // 7-1. 사용자의 마우스·키보드 직접 입력/수정 내역을 상위 초안 스토어로 역동기화
  // React Compiler 호환성을 위해 `watch` 대신 공식 비렌더링 구독 API(`subscribe`)를 사용합니다.
  React.useEffect(() => {
    if (mode !== "submission") {
      return;
    }
    return methods.subscribe({
      formState: { values: true },
      callback: ({ values: watchedValues }) => {
        if (isApplyingExternalValuesRef.current) {
          return;
        }
        onValuesChangeRef.current?.({ ...(watchedValues as Record<string, unknown>) });
      },
    });
  }, [methods, mode]);

  // 8. 폼 제출 이벤트 핸들러
  const handleFormSubmit = methods.handleSubmit(async (data) => {
    if (mode === "preview" || !onSubmit) return;
    await onSubmit(data);
  });

  // 9. AI Navigator 또는 외부 신호에 의한 프로그래밍 방식 폼 제출 트리거
  const prevSubmitTriggerRef = React.useRef(submitTriggerCount);
  React.useEffect(() => {
    if (
      typeof submitTriggerCount === "number" &&
      submitTriggerCount > 0 &&
      submitTriggerCount !== prevSubmitTriggerRef.current
    ) {
      prevSubmitTriggerRef.current = submitTriggerCount;
      handleFormSubmit();
    }
  }, [submitTriggerCount, handleFormSubmit]);

  // 10. 폼 발행 상태 및 토글 핸들러
  const isPublished = Boolean(activeForm?.publishedAt);

  const handlePublishToggle = React.useCallback(() => {
    if (!formId) return;
    publishFormMutation.mutate({
      id: formId,
      isPublished: !isPublished,
    });
  }, [formId, isPublished, publishFormMutation]);

  return {
    activeForm,
    activeFields,
    methods,
    isLoading: shouldFetch && isLoading,
    isError: shouldFetch && isError,
    error,
    isPublished,
    isPublishPending: publishFormMutation.isPending,
    handlePublishToggle,
    handleFormSubmit,
  };
}
