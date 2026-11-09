"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { CoreFormField } from "@/entities/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { FormFieldWrapper } from "./form-field-wrapper";

/**
 * 동적 필드 컴포넌트 Props 인터페이스
 */
export interface DynamicFieldProps {
  /** 렌더링 대상 코어 폼 필드 정의 */
  field: CoreFormField;

  /** 현재 네비게이터 또는 사용자가 선택한 필드 여부 */
  isSelected?: boolean | undefined;

  /** 필드 클릭 핸들러 (네비게이터 대화 패널에 타깃 필드 컨텍스트 전달용) */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /** 외부에서 직접 주입하는 에러 메시지 (React Hook Form 외부 사용 시) */
  error?: string | undefined;

  /** 비활성화 여부 */
  disabled?: boolean | undefined;
}

/**
 * 폼 필드 렌더러 컴포넌트
 *
 * 필드의 type 속성("text" | "textarea" | "number" | "select")에 따라
 * 최적화된 shadcn/ui 기반 입력 컴포넌트를 매핑하여 렌더링합니다.
 * React Hook Form 컨텍스트(FormProvider)가 존재하는 경우 자동 바인딩을 수행합니다.
 */
export function DynamicField({
  field,
  isSelected,
  onFieldClick,
  error: propError,
  disabled = false,
}: DynamicFieldProps) {
  const { id, name, label, type, placeholder, required, options, description } = field;

  // React Hook Form 컨텍스트 획득 (컨슈머 제출 모드 또는 FormProvider 래핑 시 유효)
  const formContext = useFormContext();

  // 에러 메시지 우선순위: React Hook Form 에러 > 외부 주입 에러
  const formError = formContext?.formState?.errors?.[name]?.message;
  const displayError = (typeof formError === "string" ? formError : undefined) ?? propError;

  /**
   * 필드 타입별 입력 컨트롤 렌더링
   */
  const renderControl = () => {
    // 1. React Hook Form 컨텍스트가 주입된 경우: register / Controller 기반 바인딩
    if (formContext) {
      switch (type) {
        case "text":
          return (
            <Input
              id={id}
              placeholder={placeholder}
              disabled={disabled}
              {...formContext.register(name)}
            />
          );

        case "textarea":
          return (
            <Textarea
              id={id}
              placeholder={placeholder}
              disabled={disabled}
              className="min-h-24 resize-y"
              {...formContext.register(name)}
            />
          );

        case "number":
          return (
            <Input
              id={id}
              type="number"
              placeholder={placeholder}
              disabled={disabled}
              {...formContext.register(name)}
            />
          );

        case "select": {
          const selectOptions = options && options.length > 0 ? options : ["선택 옵션 없음"];
          return (
            <Controller
              name={name}
              control={formContext.control}
              render={({ field: controllerField }) => (
                <Select
                  value={typeof controllerField.value === "string" ? controllerField.value : ""}
                  onValueChange={controllerField.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={placeholder || "선택해 주세요"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          );
        }

        default:
          return (
            <Input
              id={id}
              placeholder={placeholder}
              disabled={disabled}
              {...formContext.register(name)}
            />
          );
      }
    }

    // 2. 프리뷰 모드 등 FormProvider 없이 단순 미리보기로 렌더링되는 경우
    switch (type) {
      case "text":
        return (
          <Input
            id={id}
            name={name}
            type="text"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={id}
            name={name}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="min-h-24 resize-y"
          />
        );

      case "number":
        return (
          <Input
            id={id}
            name={name}
            type="number"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );

      case "select": {
        const selectOptions = options && options.length > 0 ? options : ["선택 옵션 없음"];
        return (
          <Select disabled={disabled}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={placeholder || "선택해 주세요"} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      default:
        return (
          <Input
            id={id}
            name={name}
            type="text"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <FormFieldWrapper
      id={id}
      name={name}
      label={label}
      required={required}
      description={description}
      error={displayError}
      isSelected={isSelected}
      onFieldClick={onFieldClick}
    >
      {renderControl()}
    </FormFieldWrapper>
  );
}
